import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, writeFileSync, readFileSync, symlinkSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspect} from '../src/inspect.js';
import {openPackage, LIMITS} from '../src/zip.js';
import {demoParts, makeDemo, packageParts, WORD_NS, REL_NS} from '../examples/demo.js';
import {importedContentParts} from '../examples/imported-content.js';
const parse = parts => inspect(packageParts(parts));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const body = markup => '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + markup + '</w:body></w:document>';
test('sample exposes saved edits, identities, properties and linked/embedded content', () => {
  const report = inspect(makeDemo());
  assert.deepEqual(report.counts, {comments: 1, revisions: 2, hidden: 1, properties: 3, embedded: 1, links: 1, extra: 0});
  assert.equal(report.findings.find(item => item.category === 'comments').author, 'Alex Example');
  assert.match(report.findings.find(item => item.type === 'del').detail, /8,000/);
  assert.equal(report.findings.find(item => item.category === 'hidden').location, 'word/document.xml · paragraph 4');
});
test('inspection leaves the original byte sequence unchanged', () => {
  const bytes = makeDemo(), before = hash(bytes); inspect(bytes); assert.equal(hash(bytes), before);
});
test('an independent python-docx producer fixture preserves comment and hidden-text findings', () => {
  const bytes = readFileSync(new URL('../examples/producer-sample.docx', import.meta.url));
  const before = hash(bytes), report = inspect(bytes, {filename: 'producer-sample.docx'});
  assert.equal(report.counts.comments, 1); assert.equal(report.counts.hidden, 1);
  assert.equal(report.findings.find(finding => finding.category === 'comments').author, 'Taylor Example');
  assert.ok(report.findings.some(finding => finding.category === 'properties' && finding.detail === 'Jordan Example'));
  assert.equal(hash(bytes), before);
});
test('a minimal document reports no findings without certifying safe sharing', () => {
  const report = parse(demoParts({clean: true})); assert.equal(report.findings.length, 0);
  assert.match(report.summary, /checks performed/); assert.match(report.limitations.join(' '), /not a complete/);
});
test('Word element prefixes can differ from w', () => {
  const report = parse(demoParts({prefix: 'different'})); assert.equal(report.counts.revisions, 2); assert.equal(report.counts.hidden, 1);
});
test('a lookalike namespace is not interpreted as Word revision markup', () => {
  const parts = demoParts({clean: true}); parts['word/document.xml'] = body('<x:del xmlns:x="urn:other">Not a Word revision</x:del>');
  assert.equal(parse(parts).counts.revisions, 0);
});
test('explicitly disabled hidden formatting is not reported', () => {
  const parts = demoParts({clean: true}); parts['word/document.xml'] = body('<w:p><w:r><w:rPr><w:vanish w:val="false"/><w:webHidden w:val="0"/></w:rPr><w:t>Visible</w:t></w:r></w:p>');
  assert.equal(parse(parts).counts.hidden, 0);
});
test('Web Layout-only hidden text is explained separately from normal hidden text', () => {
  const parts = demoParts({clean: true}); parts['word/document.xml'] = body('<w:p><w:r><w:rPr><w:webHidden/></w:rPr><w:t>12</w:t></w:r></w:p>');
  const finding = parse(parts).findings[0]; assert.equal(finding.webLayoutOnly, true); assert.match(finding.title, /Web Layout only/); assert.match(finding.action, /visible in print/);
});
test('routine document statistics are not sharing findings', () => {
  const parts = demoParts({clean: true}); parts['docProps/app.xml'] = '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Pages>4</Pages><Words>200</Words><AppVersion>16.0</AppVersion></Properties>';
  assert.equal(parse(parts).counts.properties, 0);
});
test('Strict OOXML custom properties are sharing findings', () => {
  const parts = demoParts({clean: true}); parts['docProps/custom.xml'] = '<Properties xmlns="http://purl.oclc.org/ooxml/officeDocument/customProperties" xmlns:vt="http://purl.oclc.org/ooxml/officeDocument/docPropsVTypes"><property name="Internal client ID"><vt:lpwstr>CLIENT-SECRET</vt:lpwstr></property></Properties>';
  const report = parse(parts); assert.equal(report.counts.properties, 1); assert.equal(report.findings[0].detail, 'CLIENT-SECRET');
});
test('declared Word XML content types do not require a lowercase xml extension', () => {
  const parts = demoParts({clean: true}); parts['notes/reviewer.REVIEW'] = '<w:comments xmlns:w="' + WORD_NS + '"><w:comment><w:p><w:r><w:t>Private note</w:t></w:r></w:p></w:comment></w:comments>';
  parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', '<Default Extension="REVIEW" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
  assert.equal(parse(parts).counts.comments, 1);
});
test('an embedded file is not counted again through its relationship or directory', () => {
  const parts = demoParts(); parts['word/embeddings/'] = new Uint8Array(); parts['word/_rels/document.xml.rels'] = '<Relationships xmlns="' + REL_NS + '"><Relationship Id="embed" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="embeddings/demo-notes.txt"/></Relationships>';
  assert.equal(parse(parts).counts.embedded, 1);
});
test('aFChunk imports outside word/embeddings are reported without inspecting the imported payload', () => {
  for (const strict of [false, true]) {
    const bytes = packageParts(importedContentParts({strict})), before = hash(bytes), report = inspect(bytes);
    assert.equal(report.counts.embedded, 1);
    const finding = report.findings.find(item => item.category === 'embedded');
    assert.match(finding.relationshipType, /\/aFChunk$/);
    assert.equal(finding.detail, '../imports/review.html');
    assert.match(finding.action, /inspect it separately/);
    assert.equal(hash(bytes), before);
  }
});
test('aFChunk targets under word/embeddings are not counted twice', () => {
  const report = parse(importedContentParts({embedded: true}));
  assert.equal(report.counts.embedded, 1);
  assert.equal(report.findings[0].title, 'Embedded file');
});
test('external aFChunk references are links and are never fetched', () => {
  const report = parse(importedContentParts({external: true}));
  assert.equal(report.counts.embedded, 0);
  assert.equal(report.counts.links, 1);
  assert.equal(report.findings[0].detail, 'https://example.test/review.html');
});
test('hidden styles are reported with unresolved rendered-scope coverage', () => {
  const parts = demoParts({clean: true}); parts['word/styles.xml'] = '<w:styles xmlns:w="' + WORD_NS + '"><w:style w:styleId="Secret"><w:rPr><w:vanish/></w:rPr></w:style></w:styles>';
  const report = parse(parts); assert.equal(report.counts.hidden, 1); assert.match(report.limitations.join(' '), /rendered scope/);
});
test('historical hidden formatting is a revision, not current hidden text', () => {
  const parts = demoParts({clean: true});
  parts['word/document.xml'] = body('<w:p><w:r><w:rPr><w:rPrChange w:author="Editor"><w:rPr><w:vanish/></w:rPr></w:rPrChange></w:rPr><w:t>Visible now</w:t></w:r></w:p>');
  const report = parse(parts); assert.equal(report.counts.hidden, 0); assert.equal(report.counts.revisions, 1);
});
test('document defaults with hidden formatting are surfaced without claiming resolved scope', () => {
  const parts = demoParts({clean: true}); parts['word/styles.xml'] = '<w:styles xmlns:w="' + WORD_NS + '"><w:docDefaults><w:rPrDefault><w:rPr><w:vanish/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>';
  const report = parse(parts); assert.equal(report.counts.hidden, 1); assert.match(report.limitations.join(' '), /not resolved/);
});
test('modern reviewer contact identities use the extension namespace, regardless of prefix', () => {
  const parts = demoParts({clean: true}); parts['word/people.xml'] = '<x:people xmlns:x="http://schemas.microsoft.com/office/word/2012/wordml"><x:person x:author="Reviewer"><x:presenceInfo x:providerId="AD" x:userId="person@example.test"/></x:person></x:people>';
  const report = parse(parts); assert.equal(report.counts.properties, 1); assert.equal(report.findings[0].userId, 'person@example.test');
});
test('resolved comments and replies remain inspectable with explicit saved state', () => {
  const parts = demoParts(); parts['word/comments.xml'] = parts['word/comments.xml'].replace('<w:p>', '<w:p xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" w14:paraId="01234567">');
  parts['word/commentsExtended.xml'] = '<x:commentsEx xmlns:x="http://schemas.microsoft.com/office/word/2012/wordml"><x:commentEx x:paraId="01234567" x:done="1" x:paraIdParent="11111111"/></x:commentsEx>';
  const comment = parse(parts).findings.find(item => item.category === 'comments'); assert.equal(comment.resolved, true); assert.equal(comment.replyToParagraph, '11111111');
});
test('declared Word parts outside the standard word folder are inspected', () => {
  const parts = demoParts({clean: true}); parts['notes/reviewer.xml'] = '<w:comments xmlns:w="' + WORD_NS + '"><w:comment w:author="Reviewer"><w:p><w:r><w:t>Private note</w:t></w:r></w:p></w:comment></w:comments>';
  parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', '<Override PartName="/notes/reviewer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
  assert.equal(parse(parts).findings[0].part, 'notes/reviewer.xml');
});
test('stored linked-content fields are reported without evaluating them', () => {
  const parts = demoParts({clean: true}); parts['word/document.xml'] = body('<w:p><w:fldSimple w:instr="HYPERLINK &quot;file:///private/info&quot;"><w:r><w:t>Link</w:t></w:r></w:fldSimple></w:p>');
  const report = parse(parts); assert.equal(report.counts.links, 1); assert.match(report.findings[0].detail, /file:\/\/\/private/);
});
test('deep XML structures fail explicitly rather than returning a clean verdict', () => {
  const parts = demoParts({clean: true}); parts['word/document.xml'] = body('<w:sdt>'.repeat(260) + '</w:sdt>'.repeat(260));
  assert.throws(() => parse(parts), /structure exceeds/);
});
test('header revisions are inspected as well as the main body', () => {
  const parts = demoParts({clean: true}); parts['word/header1.xml'] = '<w:hdr xmlns:w="' + WORD_NS + '"><w:p><w:del w:author="Header Reviewer"><w:r><w:delText>Old header</w:delText></w:r></w:del></w:p></w:hdr>';
  assert.equal(parse(parts).findings[0].part, 'word/header1.xml');
});
test('formatting revisions without text still produce a finding', () => {
  const parts = demoParts({clean: true}); parts['word/document.xml'] = body('<w:p><w:pPr><w:pPrChange w:author="Editor"><w:pPr/></w:pPrChange></w:pPr></w:p>');
  assert.equal(parse(parts).findings[0].type, 'pPrChange');
});
test('external destinations are data and are never fetched', () => {
  const parts = demoParts({clean: true}); parts['word/_rels/settings.xml.rels'] = '<Relationships xmlns="' + REL_NS + '"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="file:///private/example.dotx" TargetMode="External"/></Relationships>';
  const report = parse(parts); assert.equal(report.findings[0].title, 'External document template'); assert.equal(report.findings[0].detail, 'file:///private/example.dotx');
});
test('custom XML and unexpected active-content parts are surfaced', () => {
  const parts = demoParts({clean: true}); parts['customXml/item1.xml'] = '<data>private</data>'; parts['word/vbaProject.bin'] = new Uint8Array([1]);
  assert.equal(parse(parts).counts.extra, 2);
});
test('UTF-16 XML can be inspected', () => {
  const parts = demoParts({clean: true}); const text = parts['word/document.xml']; parts['word/document.xml'] = new Uint8Array(Buffer.concat([Buffer.from([255,254]), Buffer.from(text, 'utf16le')]));
  assert.equal(parse(parts).findings.length, 0);
});
test('missing main document fails rather than returning a clean verdict', () => {
  const parts = demoParts({clean: true}); delete parts['word/document.xml']; assert.throws(() => parse(parts), /missing/);
});
test('malformed optional XML fails rather than silently skipping findings', () => {
  const parts = demoParts(); parts['word/comments.xml'] = '<w:comments xmlns:w="' + WORD_NS + '"><w:comment>'; assert.throws(() => parse(parts), /Malformed XML/);
});
test('DTD/entity declarations are refused', () => {
  const parts = demoParts({clean: true}); parts['word/document.xml'] = '<!DOCTYPE document [<!ENTITY secret SYSTEM "file:///etc/passwd">]>' + parts['word/document.xml']; assert.throws(() => parse(parts), /DTD\/entity/);
});
test('non-DOCX and encrypted legacy envelopes are refused', () => {
  assert.throws(() => inspect(makeDemo(), {filename: 'file.docm'}), /macro-enabled/);
  assert.throws(() => inspect(new Uint8Array([0xd0,0xcf,0x11,0xe0])), /Older .doc and encrypted/);
});
test('a DOCX extension on another Office package does not pass', () => {
  const parts = demoParts({clean: true}); parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('wordprocessingml.document', 'spreadsheetml.sheet'); assert.throws(() => parse(parts), /not a supported/);
});
test('archive traversal paths are refused without extraction', () => {
  const parts = demoParts({clean: true}); parts['../escape.xml'] = '<escape/>'; assert.throws(() => parse(parts), /unsafe part/);
});
test('expanded-byte limits are applied before decompression', () => {
  const bytes = makeDemo(), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const end = bytes.length - 22, central = view.getUint32(end + 16, true); view.setUint32(central + 24, LIMITS.expandedBytes + 1, true);
  assert.throws(() => openPackage(bytes), /50 MB/);
});
test('forged uncompressed sizes cannot quietly create a clean result', () => {
  const bytes = makeDemo(), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const central = view.getUint32(bytes.length - 22 + 16, true); view.setUint32(central + 24, 10, true);
  assert.throws(() => inspect(bytes), /size or integrity|unexpected EOF/);
});
test('encrypted ZIP flags and truncated files fail explicitly', () => {
  const bytes = makeDemo(), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length); const central = view.getUint32(bytes.length - 22 + 16, true);
  view.setUint16(central + 8, view.getUint16(central + 8, true) | 1, true); assert.throws(() => inspect(bytes), /Encrypted/);
  assert.throws(() => inspect(makeDemo().subarray(0, 20)), /supported/);
});
test('CLI refuses an output that aliases the original document', () => {
  const dir = mkdtempSync(join(tmpdir(), 'word-inspector-test-'));
  try {
    const input = join(dir, 'input.docx'), alias = join(dir, 'alias.json'); writeFileSync(input, makeDemo()); symlinkSync(input, alias);
    const before = hash(readFileSync(input)); const result = spawnSync(process.execPath, ['bin/word-sharing-inspector.js', input, '--output', alias], {encoding: 'utf8'});
    assert.equal(result.status, 2); assert.match(result.stderr, /original document/); assert.equal(hash(readFileSync(input)), before);
  } finally {rmSync(dir, {recursive: true});}
});
test('CLI replaces an existing report with a private inode and preserves input bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'word-inspector-private-'));
  try {
    const input = join(dir, 'input.docx'), output = join(dir, 'output.json'); writeFileSync(input, makeDemo()); writeFileSync(output, 'old', {mode: 0o644});
    const before = hash(readFileSync(input)); const result = spawnSync(process.execPath, ['bin/word-sharing-inspector.js', input, '--output', output], {encoding: 'utf8'});
    assert.equal(result.status, 1); assert.equal(JSON.parse(readFileSync(output)).counts.comments, 1); assert.equal(hash(readFileSync(input)), before);
    if (process.platform !== 'win32') assert.equal(statSync(output).mode & 0o777, 0o600);
  } finally {rmSync(dir, {recursive: true});}
});
