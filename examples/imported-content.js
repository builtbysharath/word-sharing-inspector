import {demoParts, packageParts, WORD_NS, REL_NS} from './demo.js';

// Fictional alternate-format import outside word/embeddings/. The relationship
// uses aFChunk; altChunk is the WordprocessingML element name.
export function importedContentParts({strict = false, embedded = false, external = false} = {}) {
  const parts = demoParts({clean: true});
  const relationshipBase = strict ? 'http://purl.oclc.org/ooxml/officeDocument/relationships' : 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const path = embedded ? 'word/embeddings/import.html' : 'imports/review.html';
  const target = external ? 'https://example.test/review.html' : embedded ? 'embeddings/import.html' : '../imports/review.html';
  parts['word/document.xml'] = '<w:document xmlns:w="' + WORD_NS + '" xmlns:r="' + relationshipBase + '"><w:body><w:altChunk r:id="import1"/><w:sectPr/></w:body></w:document>';
  parts['word/_rels/document.xml.rels'] = '<Relationships xmlns="' + REL_NS + '"><Relationship Id="import1" Type="' + relationshipBase + '/aFChunk" Target="' + target + '"' + (external ? ' TargetMode="External"' : '') + '/></Relationships>';
  if (!external) {
    parts[path] = '<!doctype html><html><body><p>Fictional imported review notes.</p></body></html>';
    parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', '<Override PartName="/' + path + '" ContentType="text/html"/></Types>');
  }
  return parts;
}

export function makeImportedContent() {return packageParts(importedContentParts());}
