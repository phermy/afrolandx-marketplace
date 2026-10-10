import json
from pathlib import Path

import fitz


source = Path("attached_assets/Afrolandx_QA_Report_Bundle_(1)_1791442259563.pdf")
output = Path("/tmp/afrolandx-qa-review")
output.mkdir(parents=True, exist_ok=True)
document = fitz.open(source)
pages = []
for index, page in enumerate(document):
    text = page.get_text()
    pages.append(f"\n--- PAGE {index + 1} ---\n{text}")
    print(json.dumps({"page": index + 1, "characters": len(text), "images": len(page.get_images()), "preview": text[:350]}))
    if index == 0:
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(output / "page-1.png")
(output / "report.txt").write_text("".join(pages))
print(f"Pages: {len(document)}; extracted text: {output / 'report.txt'}")
