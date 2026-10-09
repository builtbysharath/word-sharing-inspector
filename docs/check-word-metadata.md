# Check Word document metadata, comments and tracked changes before sharing

A `.docx` file is a package of document parts. It can carry details beyond the text visible in the current Word view: saved comments, deleted text in tracked changes, author properties, hidden formatting, links and imported content.

[Word Sharing Inspector](../README.md) lets you review supported package details locally. Try the fictional sample first, then select a non-sensitive test document. Filter findings by category and read the suggested review action. The file stays unchanged.

## What should I do with a finding?

- **Comments or tracked changes:** review them in Word and intentionally keep, delete, accept or reject them.
- **Author or custom properties:** check whether the saved values belong in the copy you plan to send.
- **Hidden text:** inspect it in Word's context. A stored hidden-format flag does not resolve every rendered style.
- **Embedded or imported content:** inspect that content separately. The inspector reports its presence rather than examining its internals.

Microsoft provides its own [hidden-data inspection guidance](https://support.microsoft.com/en-us/office/remove-hidden-data-and-personal-information-by-inspecting-documents-presentations-or-workbooks-356b7b5d-77af-44fe-a07f-9aa4d085966f). Choose the appropriate native review steps for your document.

## Does “no findings” mean safe to share?

No. It means the performed checks returned no findings. Images, cloud history, embedded-file internals and unsupported content remain outside the inspection. [Full coverage and limits](COVERAGE.md) explain the boundaries.

A report can contain names and document excerpts. Use fictional data or a sanitized report when giving feedback. Do not publish a sensitive document to demonstrate a finding.
