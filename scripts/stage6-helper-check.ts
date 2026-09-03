import assert from 'node:assert/strict';

import { handleFromScannedText, publicLink } from '../src/lib/share-codec';

// The scanner must accept a QR (https URL), an app link, or a bare handle.
assert.equal(handleFromScannedText('https://astrollogs.com/@emci'), 'emci');
assert.equal(handleFromScannedText('https://astrollogs.com/@emci?utm=x'), 'emci');
assert.equal(handleFromScannedText('ato://@yeezy'), 'yeezy');
assert.equal(handleFromScannedText('@emci'), 'emci');
assert.equal(handleFromScannedText('emci'), 'emci');
assert.equal(handleFromScannedText('EMCI'), 'emci');
assert.equal(handleFromScannedText('not a link'), null);
assert.equal(handleFromScannedText(''), null);

// An email must never parse as a handle — the "@" there is glued to the
// local part, not introducing a handle mention.
assert.equal(handleFromScannedText('someone@example.com'), null);
assert.equal(handleFromScannedText('first.last+tag@sub.example.co.uk'), null);
assert.equal(handleFromScannedText('Someone@Example.COM'), null);
// A real handle mention right after other text (space-separated) still works.
assert.equal(handleFromScannedText('ping @emci about this'), 'emci');

// The public link is /@handle.
assert.equal(publicLink('emci'), 'https://astrollogs.com/@emci');

console.log('Stage 6 helper checks passed.');
