import imageCompression from 'browser-image-compression';

function isHeicFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const lowerType = file.type.toLowerCase();
  return (
    lowerType.includes('heic') ||
    lowerType.includes('heif') ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif')
  );
}

async function convertHeicIfNeeded(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.86,
  });

  const singleBlob = Array.isArray(result) ? result[0] : result;
  if (!singleBlob) {
    return file;
  }

  const cleanName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([singleBlob], cleanName, { type: 'image/jpeg' });
}

/**
 * Comprime y normaliza fotos en el navegador del celular (~350-550 KB, máx 1920px),
 * convirtiendo fotos .HEIC de iPhone antes de enviar por 4G/WiFi.
 */
export async function compressImagesForUpload(
  files: File[],
  onFileProgress?: (completed: number, total: number) => void,
): Promise<File[]> {
  const results: File[] = [];
  const total = files.length;

  for (let idx = 0; idx < total; idx++) {
    const rawFile = files[idx]!;
    try {
      const normalized = await convertHeicIfNeeded(rawFile);
      const compressed = await imageCompression(normalized, {
        maxSizeMB: 0.55,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.82,
      });

      const webpName = normalized.name.replace(/\.[^.]+$/, '') + '.webp';
      results.push(new File([compressed], webpName, { type: compressed.type || 'image/webp' }));
    } catch {
      // Si el navegador es muy antiguo y falla WebWorker/Canvas, enviamos el archivo original
      // y `sharp` en el servidor se encarga de recodificarlo a WebP seguro.
      results.push(rawFile);
    }
    onFileProgress?.(idx + 1, total);
  }

  return results;
}
