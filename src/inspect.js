import {DOMParser} from '@xmldom/xmldom';
import {openPackage} from './zip.js';

const W = new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main']);
const R = new Set(['http://schemas.openxmlformats.org/package/2006/relationships', 'http://purl.oclc.org/ooxml/package/relationships']);
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const CUSTOM_PROPERTIES = new Set(['http://schemas.openxmlformats.org/officeDocument/2006/custom-properties', 'http://purl.oclc.org/ooxml/officeDocument/customProperties']);
const MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const REVISION_TYPES = new Set(['ins', 'del', 'moveFrom', 'moveTo', 'rPrChange', 'pPrChange', 'tblPrChange', 'tblGridChange', 'trPrChange', 'tcPrChange', 'sectPrChange', 'numberingChange', 'cellIns', 'cellDel', 'cellMerge']);
const PROPERTY_LABELS = {creator: 'Author', lastModifiedBy: 'Last saved by', created: 'Created', modified: 'Last modified', title: 'Document title', subject: 'Subject', description: 'Description', keywords: 'Keywords', Company: 'Company', Manager: 'Manager', Application: 'Editing application', Template: 'Document template'};
const decoder = new TextDecoder('utf-8', {fatal: true});
const whitespace = value => String(value || '').replace(/\s+/g, ' ').trim();
const excerpt = value => whitespace(value).slice(0, 400);
function elements(node) {
  const output = [], stack = [];
  for (let child = node.lastChild; child; child = child.previousSibling) if (child.nodeType === 1) stack.push({node: child, depth: 1});
  while (stack.length) {
    const current = stack.pop();
    if (current.depth > 256 || output.length >= 100000) throw new Error('XML structure exceeds the inspection limit.');
    output.push(current.node);
    for (let child = current.node.lastChild; child; child = child.previousSibling) if (child.nodeType === 1) stack.push({node: child, depth: current.depth + 1});
  }
  return output;
}
const word = (element, name) => W.has(element.namespaceURI) && element.localName === name;
const children = node => {const result = []; for (let child = node.firstChild; child; child = child.nextSibling) if (child.nodeType === 1) result.push(child); return result;};
const hiddenProperties = node => children(node).filter(element => word(element, 'vanish') || word(element, 'webHidden')).filter(element => !['0', 'false', 'off'].includes(wattr(element, 'val').toLowerCase()));
function wattr(element, name) {
  for (const ns of W) if (element.hasAttributeNS(ns, name)) return element.getAttributeNS(ns, name);
  return '';
}
function textOf(node) {
  return elements(node).filter(element => word(element, 't') || word(element, 'delText')).map(element => element.textContent).join(' ');
}
function location(node, part, paragraphs) {
  let parent = node;
  while (parent && !word(parent, 'p')) parent = parent.parentNode;
  const index = paragraphs.get(parent);
  return part + (index ? ' · paragraph ' + index : ' · ' + node.localName);
}
function parseXml(bytes, path) {
  let source;
  // XML in OOXML is normally UTF-8, but UTF-16 is permitted.
  if (bytes[0] === 0xff && bytes[1] === 0xfe) source = new TextDecoder('utf-16le', {fatal: true}).decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) source = new TextDecoder('utf-16be', {fatal: true}).decode(bytes);
  else source = decoder.decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('DTD/entity declarations are unsupported in ' + path + '.');
  const errors = [];
  const doc = new DOMParser({errorHandler: {warning: message => errors.push(message), error: message => errors.push(message), fatalError: message => errors.push(message)}}).parseFromString(source, 'application/xml');
  if (errors.length || !doc.documentElement) throw new Error('Malformed XML in ' + path + '.');
  return doc;
}
function resolvePart(base, target) {
  if (!target || /[\\?#]/.test(target) || /^[a-z]+:/i.test(target)) return null;
  const stack = target.startsWith('/') ? [] : base.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {if (!stack.length) return null; stack.pop();}
    else stack.push(part);
  }
  return stack.join('/');
}

export function inspect(bytes, {filename = 'document.docx'} = {}) {
  if (!/\.docx$/i.test(filename)) throw new Error('Choose a .docx file. Templates, macro-enabled documents and older .doc files are not supported.');
  const pkg = openPackage(bytes), parts = new Map(), findings = [], limitations = [];
  const parse = path => {
    if (!parts.has(path)) {
      const content = pkg.read(path);
      if (!content) throw new Error('The document is missing ' + path + '.');
      const doc = parseXml(content, path); parts.set(path, {doc, all: elements(doc)});
    }
    return parts.get(path);
  };
  const types = parse('[Content_Types].xml');
  if (types.doc.documentElement.namespaceURI !== CT || types.doc.documentElement.localName !== 'Types') throw new Error('This file has an unsupported content-type manifest.');
  const mainOverride = types.all.find(element => element.namespaceURI === CT && element.localName === 'Override' && element.getAttribute('ContentType') === MAIN_TYPE);
  if (!mainOverride) throw new Error('This package is not a supported macro-free Word document.');
  const rootRels = parse('_rels/.rels');
  const officeRel = rootRels.all.find(element => R.has(element.namespaceURI) && element.localName === 'Relationship' && /\/officeDocument$/.test(element.getAttribute('Type')));
  if (!officeRel || officeRel.getAttribute('TargetMode') === 'External') throw new Error('A local Word document part was not found.');
  const mainPart = resolvePart('', officeRel.getAttribute('Target'));
  if (!mainPart || mainOverride.getAttribute('PartName') !== '/' + mainPart) throw new Error('The Word document relationships disagree with its content types.');
  const main = parse(mainPart);
  if (!word(main.doc.documentElement, 'document')) throw new Error('The main part is not WordprocessingML.');
  const add = (category, title, part, detail, action, extra = {}) => findings.push({id: 'finding-' + (findings.length + 1), category, title, part, detail: excerpt(detail), action, ...extra});
  const declaredTypes = new Map(types.all.filter(node => node.namespaceURI === CT && node.localName === 'Override').map(node => [resolvePart('', node.getAttribute('PartName')), node.getAttribute('ContentType')]));
  const defaultTypes = new Map(types.all.filter(node => node.namespaceURI === CT && node.localName === 'Default').map(node => [node.getAttribute('Extension').toLowerCase(), node.getAttribute('ContentType')]));
  const partType = name => declaredTypes.get(name) || defaultTypes.get(name.split('.').at(-1).toLowerCase()) || '';
  const propertyPart = name => name.startsWith('docProps/') && /\.xml$/i.test(name) || /(?:core-properties|extended-properties|custom-properties)\+xml$/.test(partType(name));
  const xmlEntries = pkg.entries.filter(entry => !entry.name.endsWith('/') && (entry.name.startsWith('word/') && /\.xml$/i.test(entry.name) || propertyPart(entry.name) || entry.name === mainPart || /(?:wordprocessingml\.|vnd\.ms-word\.).*\+xml$/.test(partType(entry.name))));
  const commentExtensions = new Map();
  for (const entry of xmlEntries) for (const node of parse(entry.name).all) {
    if (node.namespaceURI === W15 && node.localName === 'commentEx') commentExtensions.set(node.getAttributeNS(W15, 'paraId'), node);
  }
  for (const entry of xmlEntries) {
    const {doc, all} = parse(entry.name);
    const paragraphs = new Map(all.filter(element => word(element, 'p')).map((element, index) => [element, index + 1]));
    if (propertyPart(entry.name)) {
      for (const element of all.filter(element => element.parentNode === doc.documentElement)) {
        const value = whitespace(element.textContent);
        const custom = CUSTOM_PROPERTIES.has(doc.documentElement.namespaceURI);
        if (value && (custom || Object.hasOwn(PROPERTY_LABELS, element.localName))) add('properties', element.getAttribute('name') || PROPERTY_LABELS[element.localName] || element.localName, entry.name, value,
          'Review document properties and remove values you do not intend to share.', {property: element.localName});
      }
    }
    for (const node of all) {
      if (node.namespaceURI === W15 && node.localName === 'person') {
        const identity = children(node).find(child => child.namespaceURI === W15 && child.localName === 'presenceInfo');
        const author = node.getAttributeNS(W15, 'author'), userId = identity?.getAttributeNS(W15, 'userId') || '', provider = identity?.getAttributeNS(W15, 'providerId') || '';
        add('properties', 'Reviewer contact identity', entry.name, [author, userId, provider].filter(Boolean).join(' · '), 'Review stored reviewer identities before sharing.', {author, userId, provider});
      }
      if (!W.has(node.namespaceURI)) continue;
      const where = location(node, entry.name, paragraphs);
      if (node.localName === 'comment') {
        const lastParagraph = elements(node).filter(element => word(element, 'p')).at(-1);
        const extension = commentExtensions.get(lastParagraph?.getAttributeNS(W14, 'paraId'));
        const done = extension?.getAttributeNS(W15, 'done');
        add('comments', 'Reviewer comment', entry.name, textOf(node), 'In Word, review and delete comments you do not intend to share.', {location: where, author: wattr(node, 'author'), date: wattr(node, 'date'),
          ...(done ? {resolved: ['1', 'true', 'on'].includes(done.toLowerCase())} : {}), ...(extension?.getAttributeNS(W15, 'paraIdParent') ? {replyToParagraph: extension.getAttributeNS(W15, 'paraIdParent')} : {})});
      }
      if (REVISION_TYPES.has(node.localName)) add('revisions', node.localName === 'del' || node.localName === 'moveFrom' ? 'Deleted or moved-out content' : 'Tracked change', entry.name,
        textOf(node) || 'A saved formatting or structural change is present.', 'Review each change in Word and accept or reject it intentionally.',
        {location: where, type: node.localName, author: wattr(node, 'author'), date: wattr(node, 'date')});
      if (node.localName === 'r') {
        const hidden = children(node).filter(element => word(element, 'rPr')).flatMap(hiddenProperties);
        if (hidden.length) {
          const webOnly = hidden.every(element => word(element, 'webHidden'));
          add('hidden', webOnly ? 'Text hidden in Web Layout only' : 'Text marked as hidden', entry.name, textOf(node) || 'Hidden run without extractable text.',
            webOnly ? 'This text can be visible in print views and hidden in Web Layout, including normal table-of-contents fields. Review it in context.' : 'Show hidden text in Word, inspect it and remove any content you do not intend to share.', {location: where, webLayoutOnly: webOnly});
        }
      }
      if (['style', 'rPrDefault'].includes(node.localName) && children(node).filter(element => word(element, 'rPr')).some(element => hiddenProperties(element).length)) {
        add('hidden', 'Style contains hidden formatting', entry.name, node.localName === 'rPrDefault' ? 'Document default run formatting' : 'Style: ' + wattr(node, 'styleId'), 'Inspect uses of this style in Word; the inspector does not compute inherited formatting.', {location: where});
        limitations.push('Hidden formatting inherited through styles was detected but its rendered scope was not resolved.');
      }
      const field = node.localName === 'fldSimple' ? wattr(node, 'instr') : node.localName === 'instrText' ? node.textContent : '';
      if (/^\s*(?:HYPERLINK|INCLUDETEXT|INCLUDEPICTURE|LINK|DDE|DDEAUTO)\b/i.test(field)) add('links', 'Linked-content field instruction', entry.name, field, 'Review the stored field destination in Word. This inspector does not evaluate or open it.', {location: where});
    }
  }
  for (const entry of pkg.entries.filter(item => item.name.endsWith('.rels'))) {
    const {all} = parse(entry.name);
    for (const rel of all.filter(element => R.has(element.namespaceURI) && element.localName === 'Relationship')) {
      if (rel.getAttribute('TargetMode') === 'External') add('links', /\/attachedTemplate$/.test(rel.getAttribute('Type')) ? 'External document template' : 'External link or linked content', entry.name,
        rel.getAttribute('Target'), 'Check whether the destination or linked content should be included. This inspector does not open it.',
        {relationshipType: rel.getAttribute('Type'), relationshipId: rel.getAttribute('Id')});
      else if (/\/(oleObject|package|aFChunk|altChunk)$/.test(rel.getAttribute('Type'))) {
        const owner = entry.name === '_rels/.rels' ? '' : entry.name.replace(/(^|\/)\_rels\//, '$1').replace(/\.rels$/, '');
        const target = resolvePart(owner, rel.getAttribute('Target'));
        if (target?.startsWith('word/embeddings/') && pkg.entries.some(item => item.name === target && !item.name.endsWith('/'))) continue;
        add('embedded', 'Embedded or imported content reference', entry.name, rel.getAttribute('Target'), 'Open the embedded content in a trusted application and inspect it separately.', {relationshipType: rel.getAttribute('Type')});
      }
    }
  }
  for (const entry of pkg.entries) {
    if (entry.name.startsWith('word/embeddings/') && !entry.name.endsWith('/')) add('embedded', 'Embedded file', entry.name, entry.name + ' (' + entry.size + ' expanded bytes)',
      'Review this embedded file separately; its internal contents are not inspected.');
    if (entry.name.startsWith('customXml/') && !entry.name.endsWith('/') && !entry.name.includes('/_rels/')) add('extra', 'Custom XML data', entry.name, 'Extra data is stored in this package.',
      'Review custom XML data and its purpose before sharing.');
    if (/vbaProject|activeX\//i.test(entry.name)) add('extra', 'Active content present', entry.name, entry.name,
      'Review this unexpected active content in a trusted application. The inspector does not execute it.');
  }
  limitations.push('This is a package-content check, not a complete privacy or malware assessment.',
    'Images, embedded-file contents, visual overlays, cloud version history and inherited formatting are not fully inspected.',
    'Linked field instructions split across multiple XML runs may not be recognized.',
    'Presence is reported even when comments are resolved or content is currently hidden by the Word view.');
  const categories = ['comments', 'revisions', 'hidden', 'properties', 'embedded', 'links', 'extra'];
  return {schemaVersion: 1, filename, bytes: bytes.length, scannedParts: parts.size,
    findings, counts: Object.fromEntries(categories.map(category => [category, findings.filter(finding => finding.category === category).length])),
    limitations: [...new Set(limitations)], summary: findings.length ? 'Review the findings before sharing.' : 'No findings in the checks performed. Review the coverage before sharing.'};
}
