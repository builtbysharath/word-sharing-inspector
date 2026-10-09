# Word Sharing Inspector

[![CI](https://github.com/73sharath73/word-sharing-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/73sharath73/word-sharing-inspector/actions/workflows/ci.yml)

A local, read-only check for details that may travel with a Word `.docx` file: comments, tracked changes, hidden text, author/document properties, embedded files, external relationships and selected extra data.

## Browser app

Requires Node 22+ to build and serve. A release archive includes prebuilt browser assets; building is optional when using those assets. The generated app uses local static files and runs the inspection in a browser worker. It has no server upload endpoint, analytics, model API or external dependencies at runtime.

```sh
git clone https://github.com/73sharath73/word-sharing-inspector.git
cd word-sharing-inspector
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:8765` and select a `.docx`, or use **Try the sample**. The sample is fictional; it contains deleted pricing, reviewer identities, hidden text and other inspectable items. Your file is never rewritten. Reports stay in memory until you explicitly save a JSON report or clear/reload the page.

The supplied local server binds to loopback and accepts only GET/HEAD. Content Security Policy blocks connections, forms, external assets and embedded objects. The inspector never opens links, executes macros or extracts archive entries onto disk. These are implementation controls, not a complete security assessment.

## CLI and reusable library

```sh
node bin/word-sharing-inspector.js document.docx
node bin/word-sharing-inspector.js document.docx --output report.json
```

Exit `0`: no findings in the performed checks; `1`: findings; `2`: unsupported/invalid document or error. Reports may contain names and excerpts: review them before sharing. The CLI refuses an output path that points to the original file.

```js
import {inspect} from './src/inspect.js';
const report = inspect(documentBytes, {filename: 'proposal.docx'});
```

## Coverage

- Comments with saved author/date/text, explicit resolved/reply metadata when present, and modern reviewer contact identities.
- Insertions, deletions, moves and selected formatting/structural revision markup, including headers/footers.
- Direct `vanish` run formatting and separately labelled Web Layout-only `webHidden` formatting; hidden styles are reported without resolving all affected text.
- Selected identity/descriptive core and extended properties, plus all custom properties, under `docProps/` or declared by their package content type.
- Files stored under `word/embeddings/` and OLE/package/import references.
- External package relationships, attached templates and recognizable linked-content field instructions; destinations are displayed as text.
- Custom XML data and unexpected active-content part names.

Namespace-aware XML checks do not depend on the `w:` prefix. Malformed inspected XML fails explicitly. ZIP metadata is checked before bounded decompression; inspected parts are checked against their size and CRC. Limits: 25 MB input, 50 MB total declared expanded size, 5 MB per XML part, 1,500 package entries, 100,000 elements and 256 levels per inspected XML tree, and a 30-second browser inspection timeout.

## Limits

This is a package-content inspector, not a rendered Word preview, malware scanner, cleaner, or certificate that a document is safe to share. It cannot inspect cloud version history, image contents (including stored document thumbnails), saved document-variable values, all visually obscured content, embedded files' internals or every inherited style. Saved comment records are reported even if resolved in Word. Standard `word/`/`docProps/` layouts and declared Word/property XML parts are inspected. Split linked-field instructions and unsupported vendor extensions may escape detection. It supports ordinary macro-free `.docx` packages, not `.doc`, `.docm`, templates, encrypted files, ZIP64 or split archives. It provides review guidance and does not accept changes or remove content.

## Development

```sh
npm test
npm run demo
npm run build
```

The test corpus contains fictional data and includes namespace variations, unchanged source bytes, hidden formatting, external templates, malformed XML, encrypted/invalid packages, forged ZIP sizes and CLI output aliasing. A separate sample generated with python-docx 1.2.0 also passes inspection. Ten upstream LibreOffice regression DOCX files were also inspected against independently counted XML records; see [BENCHMARK.md](BENCHMARK.md). Native Word/LibreOffice rendering was not tested.

## Existing alternatives

Microsoft's [Document Inspector](https://support.microsoft.com/en-us/office/inspect-document-b0088a7a-d482-4b87-b762-7c94c7c71e23) covers Windows; Microsoft currently says it is unavailable in Word for Mac. [mat2](https://github.com/jvoisin/mat2) is an established metadata-removal project with Office support. [docxreview](https://github.com/SchmidtPaul/docxreview) extracts review comments and tracked changes in R. This release candidate combines a sharing-oriented browser view with a reusable local core. [BENCHMARK.md](BENCHMARK.md) records a limited mat2 Office-library comparison; demand and broad comparative coverage remain unproven.

Behavior references: Microsoft's [comment extraction example](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-retrieve-comments-from-a-word-processing-document) and [hidden-data guidance](https://support.microsoft.com/en-gb/office/collab-files/remove-hidden-data-and-personal-information-by-inspecting-documents-presentations-or-workbooks?nochrome=true).

MIT licensed. Initial GitHub prerelease; npm registry publication has not occurred. Dependency licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Download source/installable tarballs from the [GitHub release](https://github.com/73sharath73/word-sharing-inspector/releases/tag/v0.1.0). The package can be installed from its downloaded `.tgz`; it is not on the npm registry.
