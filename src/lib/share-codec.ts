/**
 * Pure string/URL helpers for Share + Circle — no react-native imports, so
 * they run in plain node checks too.
 */

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://astrollogs.com';

/** /@handle is the public link — what the QR encodes and copy-link copies. */
export function publicLink(handle: string): string {
  return `${SITE_URL}/@${handle}`;
}

/** Pulls a handle out of anything the scanner or a paste could produce. */
export function handleFromScannedText(text: string): string | null {
  const match = text.match(/@([a-z0-9]{1,20})/i);
  if (match) return match[1].toLowerCase();
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\/[^/]+\//, '')
    .replace(/^@/, '');
  if (/^[a-z0-9]{1,20}$/.test(clean)) return clean;
  return null;
}
