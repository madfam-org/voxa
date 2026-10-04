import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { strToU8, zipSync, type Zippable } from 'fflate';
import { ObfImportError, unpackObz } from './index.js';

const MANIFEST = strToU8(JSON.stringify({ format: 'open-board-0.1', root: 'boards/a.obf', paths: { boards: { a: 'boards/a.obf' } } }));

function rejects(archive: Uint8Array, code: string): void {
  assert.throws(
    () => unpackObz(archive),
    (err: unknown) => err instanceof ObfImportError && err.status === 400 && err.code === code,
    `expected ${code}`,
  );
}

describe('safe .obz handling', () => {
  it('rejects zip-slip and absolute paths', () => {
    rejects(zipSync({ 'manifest.json': MANIFEST, '../escape.obf': strToU8('{}') }), 'ZIP_SLIP');
    rejects(zipSync({ 'manifest.json': MANIFEST, 'boards/../../escape.obf': strToU8('{}') }), 'ZIP_SLIP');
    rejects(zipSync({ 'manifest.json': MANIFEST, '/etc/passwd': strToU8('x') }), 'ZIP_SLIP');
    rejects(zipSync({ 'manifest.json': MANIFEST, 'C:/windows.obf': strToU8('x') }), 'ZIP_SLIP');
  });

  it('rejects a manifest root that escapes the package', () => {
    const manifest = strToU8(JSON.stringify({ format: 'open-board-0.1', root: '../a.obf', paths: { boards: {} } }));
    rejects(zipSync({ 'manifest.json': manifest }), 'ZIP_SLIP');
  });

  it('rejects symbolic links', () => {
    const files: Zippable = {
      'manifest.json': MANIFEST,
      'boards/a.obf': [strToU8('/etc/passwd'), { os: 3, attrs: (0o120777 << 16) >>> 0 }],
    };
    rejects(zipSync(files), 'ZIP_SYMLINK');
  });

  it('rejects too many entries', () => {
    const files: Zippable = { 'manifest.json': MANIFEST };
    for (let i = 0; i < 2001; i += 1) files[`images/${i}.png`] = new Uint8Array([i % 256]);
    rejects(zipSync(files, { level: 0 }), 'TOO_MANY_ENTRIES');
  });

  it('rejects oversized archives, oversized entries and zip bombs', () => {
    rejects(new Uint8Array(31 * 1024 * 1024), 'ARCHIVE_TOO_LARGE');
    rejects(zipSync({ 'manifest.json': MANIFEST, 'images/big.png': new Uint8Array(21 * 1024 * 1024) }), 'ARCHIVE_TOO_LARGE');
    rejects(zipSync({ 'manifest.json': MANIFEST, 'images/bomb.png': new Uint8Array(2 * 1024 * 1024) }), 'COMPRESSION_RATIO');
  });

  it('rejects things that are not zip archives', () => {
    rejects(strToU8('{"format":"open-board-0.1"}'), 'INVALID_ARCHIVE');
  });
});
