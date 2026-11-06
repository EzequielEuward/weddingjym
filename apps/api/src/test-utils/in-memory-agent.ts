import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { PassThrough } from 'node:stream';
import type { Express } from 'express';

export interface InMemoryResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: any;
  rawBody: Buffer;
}

export interface MultipartFilePart {
  fieldName: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
}

function buildMultipartBody(
  fields: Record<string, string>,
  files: MultipartFilePart[],
): { buffer: Buffer; contentType: string } {
  const boundary = `----WeddingTestBoundary${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        'utf8',
      ),
    );
  }

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
        'utf8',
      ),
    );
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));

  return {
    buffer: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export class TestHttpAgent {
  private readonly cookies = new Map<string, string>();

  constructor(
    private readonly app: Express,
    private readonly remoteAddress = '10.0.0.10',
  ) {}

  private getCookieHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private storeSetCookies(setCookieHeader: string | string[] | undefined): void {
    if (!setCookieHeader) return;
    const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const raw of list) {
      const firstSegment = raw.split(';')[0] ?? '';
      const eqIdx = firstSegment.indexOf('=');
      if (eqIdx <= 0) continue;
      const name = firstSegment.slice(0, eqIdx).trim();
      const val = firstSegment.slice(eqIdx + 1).trim();
      if (!val) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, val);
      }
    }
  }

  async request(options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    json?: unknown;
    fields?: Record<string, string>;
    files?: MultipartFilePart[];
  }): Promise<InMemoryResponse> {
    let bodyBuffer: Buffer = Buffer.alloc(0);
    const headers: Record<string, string> = {
      host: 'localhost',
    };

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }

    if (options.files || options.fields) {
      const mp = buildMultipartBody(options.fields ?? {}, options.files ?? []);
      bodyBuffer = mp.buffer;
      headers['content-type'] = mp.contentType;
      headers['content-length'] = String(bodyBuffer.byteLength);
    } else if (options.json !== undefined) {
      bodyBuffer = Buffer.from(JSON.stringify(options.json), 'utf8');
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(bodyBuffer.byteLength);
    }

    const fakeSocket = Object.assign(new PassThrough(), {
      remoteAddress: this.remoteAddress,
      encrypted: false,
      destroy() {
        return this;
      },
    }) as unknown as Socket;

    const req = new IncomingMessage(fakeSocket);
    req.method = options.method;
    req.url = options.url;
    req.headers = headers;

    const res = new ServerResponse(req);
    res.assignSocket(fakeSocket);

    const outputChunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, encoding?: any, cb?: any) => {
      if (chunk) {
        outputChunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding),
        );
      }
      return origWrite(chunk, encoding, cb);
    }) as typeof res.write;

    return new Promise<InMemoryResponse>((resolve, reject) => {
      res.end = ((chunk?: any, encoding?: any, cb?: any) => {
        if (chunk && typeof chunk !== 'function') {
          outputChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding),
          );
        }
        const result = origEnd(chunk, encoding, cb);

        const rawFull = Buffer.concat(outputChunks);
        // ServerResponse writes HTTP status line + headers into socket stream; strip HTTP header block if present
        const headerSep = rawFull.indexOf('\r\n\r\n');
        const rawBody = headerSep >= 0 ? rawFull.subarray(headerSep + 4) : rawFull;

        const outHeaders: Record<string, string | string[] | undefined> = {};
        for (const [k, v] of Object.entries(res.getHeaders())) {
          outHeaders[k.toLowerCase()] =
            typeof v === 'number' ? String(v) : (v as string | string[] | undefined);
        }

        this.storeSetCookies(outHeaders['set-cookie']);

        const ct = String(outHeaders['content-type'] ?? '');
        let parsedBody: any = rawBody;
        if (ct.includes('application/json') && rawBody.byteLength > 0) {
          try {
            parsedBody = JSON.parse(rawBody.toString('utf8'));
          } catch {
            parsedBody = rawBody.toString('utf8');
          }
        } else if (ct.includes('text/')) {
          parsedBody = rawBody.toString('utf8');
        }

        resolve({
          status: res.statusCode,
          headers: outHeaders,
          body: parsedBody,
          rawBody,
        });
        return result;
      }) as typeof res.end;

      req.on('error', reject);
      res.on('error', reject);

      this.app(req, res);

      queueMicrotask(() => {
        if (bodyBuffer.byteLength > 0) {
          req.push(bodyBuffer);
        }
        req.push(null);
      });
    });
  }

  get(url: string) {
    return this.request({ method: 'GET', url });
  }

  post(url: string, json?: unknown) {
    return this.request({ method: 'POST', url, json });
  }

  put(url: string, json?: unknown) {
    return this.request({ method: 'PUT', url, json });
  }

  delete(url: string) {
    return this.request({ method: 'DELETE', url });
  }
}

export function createTestAgent(app: Express, remoteAddress?: string): TestHttpAgent {
  return new TestHttpAgent(app, remoteAddress);
}
