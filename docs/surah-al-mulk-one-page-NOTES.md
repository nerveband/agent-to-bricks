# Surah Al-Mulk one-page PDF: build notes

## What changed
Rebuilt `docs/surah-al-mulk-one-page.html` and regenerated `docs/surah-al-mulk-one-page.pdf`.

- **Was:** Letter **landscape**, 3-column grid (each cell a small ayah block).
- **Now:** Letter **portrait**, single page, two balanced columns. Each ayah reads top-to-bottom:
  1. Arabic (Uthmani, large, primary)
  2. Transliteration (smaller, italic)
  3. English translation (smallest)
  No side-by-side Arabic/translation pairing.
- **Font:** Me Quran (`me_quran_volt_newmet.ttf`) is now **base64-embedded** directly in the HTML
  via a `@font-face` `data:` URI (no network dependency), with `font-display:block` so the
  Arabic renders in the correct font for both screen and Chrome `--print-to-pdf`. The PDF
  subsets and embeds it (`pdffonts` shows `me_quran`, emb=yes).
- **Layout:** flex two-column with an explicit split (ayahs 1-16 left, 17-30 right) so both
  columns reach the page bottom evenly. Content fills ~96% of the page height; the remainder
  is a normal print bottom margin. Tight header/footer and trimmed body line-heights let all
  30 ayat fit one page without clipping.

## Source data
`/tmp/surah_mulk_api.json` (alquran.cloud): editions `quran-uthmani`, `en.transliteration`,
`en.pickthall`, 30 ayat each. Generator: `/tmp/gen_mulk.py` (tunable sizes; final config
`ar=14.5 ar_lh=1.45 tr=6.2 en=6.0 small_lh=1.12 gap_v=2.2 pad=3.4 gap_c=18 split=16`).

## Render command
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="docs/surah-al-mulk-one-page.pdf" \
  "file://<abs path>/docs/surah-al-mulk-one-page.html"
```

## Verification (all pass)
```
$ pdfinfo docs/surah-al-mulk-one-page.pdf | grep -Ei "pages|page size"
Pages:           1
Page size:       612 x 792 pts (letter)          # portrait letter

$ pdffonts docs/surah-al-mulk-one-page.pdf | grep me_quran
DAAAAA+me_quran   CID TrueType  Identity-H  yes yes yes   7  0   # embedded + subset

$ pdftotext docs/surah-al-mulk-one-page.pdf - | grep -c "gushing water"
1                                                # ayah 30 present (no clipping)
```
Visually inspected (pdftoppm renders + corner crops): two balanced columns, large Me Quran
Arabic with diacritics intact (not clipped), ayah 16 ends column 1 and ayah 30 ends column 2,
footer spans the page bottom. No overflow, no overlap.
