import {inflateSync} from 'fflate';

export const LIMITS = Object.freeze({fileBytes: 25 * 1024 * 1024, expandedBytes: 50 * 1024 * 1024,
  partBytes: 5 * 1024 * 1024, entries: 1500});
const utf8 = new TextDecoder('utf-8', {fatal: true});
const crcTable = Uint32Array.from({length: 256}, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

// Read package bytes only. No archive entries are written to the filesystem.
export function openPackage(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('Expected document bytes.');
  if (bytes.length > LIMITS.fileBytes) throw new Error('This file exceeds the 25 MB inspection limit.');
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Choose a .docx file. Older .doc and encrypted Word files are not supported.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = offset => view.getUint16(offset, true);
  const u32 = offset => view.getUint32(offset, true);
  const bounds = (offset, size) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > bytes.length) throw new Error('The document package is incomplete or invalid.');
  };
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) end--;
  if (end < Math.max(0, bytes.length - 65557)) throw new Error('The document package has no valid ZIP directory.');
  const count = u16(end + 10), directorySize = u32(end + 12), directoryOffset = u32(end + 16);
  if (u16(end + 4) || u16(end + 6) || count !== u16(end + 8) || count === 65535 || directorySize === 0xffffffff || directoryOffset === 0xffffffff) throw new Error('Split or ZIP64 packages are not supported.');
  if (count > LIMITS.entries) throw new Error('The document has more than 1,500 package entries.');
  bounds(directoryOffset, directorySize);
  if (directoryOffset + directorySize > end) throw new Error('Invalid ZIP directory boundaries.');
  const entries = [], names = new Set();
  let offset = directoryOffset, total = 0;
  for (let i = 0; i < count; i++) {
    bounds(offset, 46);
    if (u32(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory entry.');
    const flags = u16(offset + 8), method = u16(offset + 10), checksum = u32(offset + 16);
    const compressed = u32(offset + 20), size = u32(offset + 24), nameSize = u16(offset + 28);
    const extraSize = u16(offset + 30), commentSize = u16(offset + 32), localOffset = u32(offset + 42);
    bounds(offset + 46, nameSize + extraSize + commentSize);
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameSize);
    if (!(flags & 0x800) && rawName.some(value => value > 127)) throw new Error('This package uses an unsupported filename encoding.');
    const name = utf8.decode(rawName);
    if (!name || /[\\\u0000]/.test(name) || name.startsWith('/') || name.split('/').some(part => part === '..' || part === '.')) throw new Error('The package contains an unsafe part name.');
    if (names.has(name.toLowerCase())) throw new Error('The package contains duplicate part names.');
    names.add(name.toLowerCase());
    if (flags & 1 || flags & 64) throw new Error('Encrypted package entries are not supported.');
    if (![0, 8].includes(method) || size === 0xffffffff || compressed === 0xffffffff || localOffset === 0xffffffff || u16(offset + 34)) throw new Error('Unsupported ZIP compression or entry format.');
    total += size;
    if (total > LIMITS.expandedBytes) throw new Error('The expanded document exceeds the 50 MB inspection limit.');
    const xml = name === '[Content_Types].xml' || name.endsWith('.xml') || name.endsWith('.rels');
    if (xml && size > LIMITS.partBytes) throw new Error('A document XML part exceeds the 5 MB inspection limit.');
    bounds(localOffset, 30);
    if (u32(localOffset) !== 0x04034b50 || u16(localOffset + 8) !== method || u16(localOffset + 6) !== flags) throw new Error('ZIP headers disagree.');
    const start = localOffset + 30 + u16(localOffset + 26) + u16(localOffset + 28);
    bounds(localOffset + 30, u16(localOffset + 26)); bounds(start, compressed);
    if (utf8.decode(bytes.subarray(localOffset + 30, localOffset + 30 + u16(localOffset + 26))) !== name || start + compressed > directoryOffset) throw new Error('ZIP part boundaries or names disagree.');
    entries.push({name, size, compressed, checksum, method, start});
    offset += 46 + nameSize + extraSize + commentSize;
  }
  if (offset !== directoryOffset + directorySize) throw new Error('The ZIP directory size does not match its entries.');
  const byName = new Map(entries.map(entry => [entry.name, entry]));
  return {entries, read(name) {
    const entry = byName.get(name);
    if (!entry) return null;
    if (entry.size > LIMITS.partBytes) throw new Error('This part exceeds the inspection limit.');
    const input = bytes.subarray(entry.start, entry.start + entry.compressed);
    // A fixed output buffer bounds allocation even if the size header is forged.
    const output = entry.method === 0 ? input : inflateSync(input, {out: new Uint8Array(entry.size)});
    if (output.length !== entry.size || crc32(output) !== entry.checksum) throw new Error('A document part failed its size or integrity check: ' + name);
    return output;
  }};
}
