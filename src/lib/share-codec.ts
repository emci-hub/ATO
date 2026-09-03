/**
 * Pure string/URL helpers for Share + Circle — no react-native imports, so
 * they run in plain node checks too.
 */

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://astrollogs.com';

/** /@handle is the public link — what the QR encodes and copy-link copies. */
export function publicLink(handle: string): string {
  return `${SITE_URL}/@${handle}`;
}

/**
 * Pulls a handle out of anything the scanner or a paste could produce.
 * The "@" must actually introduce a handle mention (start of string, or
 * preceded by a separator like "/" or whitespace) — not the "@" inside an
 * email address, where it is glued to the local part with no separator.
 * Without that guard, pasting "name@example.com" would parse "example" out
 * of the domain and could resolve to a real (if coincidental) handle.
 */
export function handleFromScannedText(text: string): string | null {
  const match = text.match(/(^|[^a-z0-9._+-])@([a-z0-9]{1,20})/i);
  if (match) return match[2].toLowerCase();
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\/[^/]+\//, '')
    .replace(/^@/, '');
  if (/^[a-z0-9]{1,20}$/.test(clean)) return clean;
  return null;
}
