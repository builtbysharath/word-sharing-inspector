# Changelog

## Unreleased — hosted browser worker policy, 2026-10-09

Embed the bundled inspector as a blob worker so it inherits the document's connection-blocking CSP on GitHub Pages. Release its object URL after inspection, timeout, error or Clear. Existing release archives remain unchanged.

## 0.1.1 — imported-content detection fix, 2026-10-09

Recognize Word's `aFChunk` relationship for alternate-format imports outside `word/embeddings/`. Added fictional regression coverage for both relationship URI forms, deduplication and external links; rebuilt browser assets. Imported payloads still require separate inspection. Clarified DOCX metadata positioning and added a prebuilt browser ZIP with a dependency-free Node launcher.

## 0.1.0 — initial prerelease, 2026-10-09

First public prerelease: reusable inspection/analysis library, read-only CLI, explicit coverage and unsupported-case reporting, fictional regression fixtures and documented validation. Published on GitHub; npm registry publication has not occurred.
