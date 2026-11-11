import type { Play } from './model/types';

export function slug(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'jugada'
  );
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Copia una imagen PNG al portapapeles. Hay que llamarla directamente desde el clic, sin esperas antes:
 * la imagen se pasa como promesa para que Safari, que exige escribir en el mismo instante del clic,
 * también lo permita (Chrome y Firefox lo aceptan igual).
 */
export function copyPng(png: Promise<Blob>): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return Promise.reject(new Error('sin portapapeles de imágenes'));
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export function playJson(play: Play): Blob {
  return new Blob([JSON.stringify(play, null, 2)], { type: 'application/json' });
}

/** Si este navegador puede mandar el archivo con el menú de compartir del sistema (WhatsApp, Drive…). */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/**
 * Abre el menú de compartir del sistema con un archivo. Devuelve `'shared'`, `'cancelled'` (la persona
 * lo cerró) o `'needs-tap'`: el navegador pide que se comparta en el mismo instante del toque, y si
 * preparar el archivo tardó, hay que volver a tocar (Safari).
 */
export async function shareFile(file: File, title: string): Promise<'shared' | 'cancelled' | 'needs-tap'> {
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (e) {
    return (e as Error)?.name === 'NotAllowedError' ? 'needs-tap' : 'cancelled';
  }
}

/** Comparte el archivo si se puede (móvil) y si no, lo descarga. */
export async function shareOrDownload(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (canShareFile(file) && (await shareFile(file, title)) !== 'needs-tap') return;
  download(blob, filename);
}
