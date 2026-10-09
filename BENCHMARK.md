# Word corpus and limited mat2 comparison — 9 October 2026

Ten DOCX documents were downloaded from LibreOffice's public regression corpus at commit `ef716a71357f7d3b9657442c5ba9e4b342dd37fa`. Files remained unchanged. Python's standard-library ZIP/XML parser independently counted comment and revision records and modern reviewer identity records; Inspector counts matched all of those records. Names in upstream fixtures belong to the original regression documents; no user business documents were scanned.

| Upstream document | Comments | Revisions | Contact identities | Resolved comments / replies |
|---|---:|---:|---:|---|
| [CommentDone.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/CommentDone.docx) | 2 | 0 | 1 | 1 resolved; 0 replies |
| [CommentReply.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/CommentReply.docx) | 2 | 0 | 0 | 0 resolved; 1 replies |
| [UnknownStyleInRedline.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/UnknownStyleInRedline.docx) | 0 | 2 | 0 | 0 resolved; 0 replies |
| [comment-annotationref.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/comment-annotationref.docx) | 4 | 0 | 0 | 0 resolved; 2 replies |
| [groupshape-trackedchanges.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/groupshape-trackedchanges.docx) | 0 | 4 | 0 | 0 resolved; 0 replies |
| [image-comment-at-char.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/image-comment-at-char.docx) | 1 | 0 | 0 | 0 resolved; 0 replies |
| [nospacing_hidden.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/nospacing_hidden.docx) | 0 | 0 | 0 | 0 resolved; 0 replies |
| [paragraphWithComments.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/paragraphWithComments.docx) | 1 | 0 | 0 | 0 resolved; 0 replies |
| [redline-range-comment.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/redline-range-comment.docx) | 1 | 1 | 1 | 0 resolved; 0 replies |
| [tdf114734_commentFormating.docx](https://raw.githubusercontent.com/LibreOffice/core/ef716a71357f7d3b9657442c5ba9e4b342dd37fa/sw/qa/extras/ooxmlexport/data/tdf114734_commentFormating.docx) | 1 | 0 | 0 | 0 resolved; 0 replies |

`nospacing_hidden.docx` contains no enabled `vanish`/`webHidden` flag; its filename alone does not justify a hidden-text finding. The fictional python-docx 1.2.0 sample additionally exercises a real producer's comment, author/last-modified properties and directly hidden run. Synthetic regressions cover defaults, nonstandard declared part paths and historical hidden formatting.

## mat2 0.15.0

Installed the pinned PyPI distribution in a temporary directory. The full CLI could not start on this Mac because its eagerly imported PDF plugin requires Cairo (and other system libraries). To avoid misreporting a failed CLI benchmark as success, the comparison used `libmat2.office.MSOfficeParser.get_meta()` from an isolated subset of the unchanged distribution: `__init__.py`, `abstract.py`, `archive.py`, `office.py`, `parser_factory.py`, `exiftool.py` and `video.py`. Other format plugins were absent. This is a limited Office-library comparison; image/embedded-format metadata extraction is excluded.

On all ten upstream files and two fictional samples, mat2's Office library returned ZIP member metadata and document properties. It did not extract comment bodies, tracked revision text or hidden-run text in these captured `get_meta()` results. Inspector showed those applicable records and sources. The tools have different purposes: mat2 also removes metadata and covers many formats; Inspector does not clean files or inspect images and embedded files internally. This benchmark does not show that mat2's cleanup misses these items, nor compare the full CLI or Microsoft Word's Windows Document Inspector.

Local evidence is under ignored `reports/corpus/`: source URLs and SHA-256s, independent XML counts, Inspector reports and mat2 reports. Downloaded upstream fixtures are excluded from release archives. To reproduce, download the linked exact-commit files, run the Inspector CLI, and count namespace-qualified records with an independent XML parser. Native Word/LibreOffice rendering and human usefulness remain unverified.

Primary references: [mat2 source](https://github.com/jvoisin/mat2), [Microsoft reviewer contact identity specification](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/decfeb01-8545-446a-974d-be3c5656ed85), [presence information specification](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/92bc9ffe-4270-434f-9b6e-9b651483b8b9).
