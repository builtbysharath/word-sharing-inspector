# DOCX inspection coverage and limitations

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


Imported alternate-format content is recognized through its `aFChunk` relationship, even outside `word/embeddings/`. Its payload needs separate inspection. The legacy `altChunk` relationship spelling remains recognized for compatibility.

## Existing alternatives

Microsoft's [Document Inspector](https://support.microsoft.com/en-us/office/inspect-document-b0088a7a-d482-4b87-b762-7c94c7c71e23) covers Windows; Microsoft currently says it is unavailable in Word for Mac. [mat2](https://github.com/jvoisin/mat2) is an established metadata-removal project with Office support. [docxreview](https://github.com/SchmidtPaul/docxreview) extracts review comments and tracked changes in R. This release candidate combines a sharing-oriented browser view with a reusable local core. [BENCHMARK.md](../BENCHMARK.md) records a limited mat2 Office-library comparison; demand and broad comparative coverage remain unproven.

Behavior references: Microsoft's [comment extraction example](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-retrieve-comments-from-a-word-processing-document) and [hidden-data guidance](https://support.microsoft.com/en-gb/office/collab-files/remove-hidden-data-and-personal-information-by-inspecting-documents-presentations-or-workbooks?nochrome=true).
