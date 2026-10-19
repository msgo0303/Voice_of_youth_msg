import QRCode from 'qrcode';

/**
 * Clean survey title for safe cross-platform filename.
 * Removes invalid characters: / \ ? % * : | " < > and control characters.
 * Replaces spaces with underscores.
 */
export function sanitizeQrFilename(title: string): string {
  if (!title || typeof title !== 'string') {
    return 'FormGram_Survey_QR.png';
  }

  // Remove invalid filename characters and control characters
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\?%*:|"<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  if (!cleaned) {
    return 'FormGram_Survey_QR.png';
  }

  return `FormGram_${cleaned}_QR.png`;
}

/**
 * Check if the current browser environment supports copying PNG images to clipboard
 */
export function isClipboardImageSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!navigator.clipboard) return false;
  if (typeof navigator.clipboard.write !== 'function') return false;
  if (typeof window.ClipboardItem === 'undefined') return false;
  return true;
}

/**
 * Generate a high-resolution PNG Data URL for a given URL (recommended 512x512 ~ 1024x1024)
 */
export async function generateQrDataUrl(
  text: string,
  size: number = 1024
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
