import type {
  EventMode,
  PhotoFilterSection,
  PhotoItemDto,
  PhotoListResponse,
  PhotoSection,
  PhotoSort,
  SessionStatusDto,
  ToggleVoteResponse,
  UploadPhotosResponse,
} from '@wedding/shared';

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code = 'API_ERROR', status = 500) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data?.error?.message ?? 'Ocurrió un inconveniente de conexión. Intentá de nuevo.';
    const code = data?.error?.code ?? 'HTTP_ERROR';
    throw new ApiClientError(message, code, res.status);
  }
  return data as T;
}

export async function fetchSessionStatus(): Promise<SessionStatusDto> {
  const res = await fetch('/api/session', { credentials: 'include' });
  return parseJsonOrThrow<SessionStatusDto>(res);
}

export async function updateGuestAlias(alias: string): Promise<SessionStatusDto> {
  const res = await fetch('/api/session/alias', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias }),
  });
  return parseJsonOrThrow<SessionStatusDto>(res);
}

export async function fetchPhotos(
  section: PhotoFilterSection,
  sort: PhotoSort = 'recent',
): Promise<PhotoListResponse> {
  const params = new URLSearchParams({ section, sort });
  const res = await fetch(`/api/photos?${params.toString()}`, {
    credentials: 'include',
  });
  return parseJsonOrThrow<PhotoListResponse>(res);
}

export function uploadPhotosWithProgress(input: {
  section: PhotoSection;
  files: File[];
  caption?: string;
  alias?: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadPhotosResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('section', input.section);
    if (input.caption && input.caption.trim().length > 0) {
      formData.append('caption', input.caption.trim());
    }
    if (input.alias && input.alias.trim().length > 0) {
      formData.append('alias', input.alias.trim());
    }
    for (const file of input.files) {
      formData.append('files', file, file.name);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/photos');
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && input.onProgress) {
        const pct = Math.round((event.loaded / event.total) * 100);
        input.onProgress(pct);
      }
    };

    xhr.onload = () => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && parsed) {
        resolve(parsed as UploadPhotosResponse);
      } else {
        reject(
          new ApiClientError(
            parsed?.error?.message ?? 'No pudimos subir las fotos. Revisá tu señal e intentá de nuevo.',
            parsed?.error?.code ?? 'UPLOAD_FAILED',
            xhr.status,
          ),
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new ApiClientError(
          'La señal está débil y se cortó el envío. Tocá reintentar.',
          'NETWORK_ERROR',
          0,
        ),
      );
    };

    xhr.send(formData);
  });
}

export async function togglePhotoVote(photoId: string): Promise<ToggleVoteResponse> {
  const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}/vote`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseJsonOrThrow<ToggleVoteResponse>(res);
}

export async function deletePhotoById(
  photoId: string,
): Promise<{ deleted: boolean; id: string }> {
  const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJsonOrThrow<{ deleted: boolean; id: string }>(res);
}

export async function loginModerator(pin: string): Promise<SessionStatusDto> {
  const res = await fetch('/api/moderator/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return parseJsonOrThrow<SessionStatusDto>(res);
}

export async function logoutModerator(): Promise<void> {
  await fetch('/api/moderator/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function changeEventMode(mode: EventMode): Promise<{ mode: EventMode }> {
  const res = await fetch('/api/moderator/event-mode', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  return parseJsonOrThrow<{ mode: EventMode }>(res);
}

export type { PhotoItemDto };
