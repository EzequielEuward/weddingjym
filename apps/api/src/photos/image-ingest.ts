import sharp from 'sharp';

export class InvalidImageError extends Error {
  constructor(message = 'El archivo seleccionado no es una imagen válida.') {
    super(message);
    this.name = 'InvalidImageError';
  }
}

export interface ProcessedImageResult {
  fullBuffer: Buffer;
  thumbBuffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

const MAX_INPUT_PIXELS = 64_000_000;
const FULL_MAX_DIMENSION = 1920;
const THUMB_MAX_WIDTH = 480;

/**
 * Deep module: validates magic bytes & pixel stream via sharp, auto-rotates,
 * strips EXIF/GPS metadata by re-encoding, and generates full + 480px WebP variants.
 */
export async function processUploadedImage(
  rawBuffer: Buffer,
): Promise<ProcessedImageResult> {
  if (!rawBuffer || rawBuffer.byteLength < 16) {
    throw new InvalidImageError();
  }

  try {
    const pipeline = sharp(rawBuffer, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    }).rotate();

    const { data: fullBuffer, info: fullInfo } = await pipeline
      .clone()
      .resize({
        width: FULL_MAX_DIMENSION,
        height: FULL_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const thumbBuffer = await pipeline
      .clone()
      .resize({
        width: THUMB_MAX_WIDTH,
        withoutEnlargement: true,
      })
      .webp({ quality: 76 })
      .toBuffer();

    if (!fullInfo.width || !fullInfo.height) {
      throw new InvalidImageError();
    }

    return {
      fullBuffer,
      thumbBuffer,
      width: fullInfo.width,
      height: fullInfo.height,
      sizeBytes: fullBuffer.byteLength,
    };
  } catch (err) {
    if (err instanceof InvalidImageError) {
      throw err;
    }
    throw new InvalidImageError();
  }
}
