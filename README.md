# Project Space — PDF Remark

Static browser application for GitHub Pages. Ten independent PDF inputs and ten remark fields are visible immediately. Fill any subset of slots, enter a separate remark and output filename for each, choose a page, click a blank location, then Run to download a ZIP. The browser processes documents locally; no upload server is used.

## Development

Use the existing checkout; no separate worktree is needed. No dependency installation or build is required.

```sh
python -m http.server 8000
```

Serve the repository root over HTTP (ES modules do not work reliably when opening index.html directly). Requires a current browser supporting ES modules and PDF.js 5.4.

## Behavior and limits

- 10 PDFs, 20 MB each, 80 MB total. One selected page per file receives a remark; other pages remain.
- A click explicitly confirms placement. Users must check the preview for overlap; the app does not detect blank space.
- Remarks are transparent, high-resolution PNG overlays to support Thai text shaping using the browser's fonts. Remark text itself is not searchable/selectable; original PDF content is preserved.
- Long remarks wrap within the remaining page width. Out-of-page remarks block export.
- Duplicate output filenames receive numeric suffixes. The original files are never overwritten.
- Password-protected PDFs and PDFs with digital-signature fields are unsupported. Any batch failure prevents ZIP download.
- PDF rendering loads on demand, and dependency failures show an actionable message without hiding the form.
- Edit a remark or placement after export to invalidate the previous download.

## Dependencies

Vendored files and license notices in `vendor/`: PDF.js 5.4.624 legacy browser build (Apache-2.0), pdf-lib 1.17.1 (MIT), JSZip 3.10.1 (MIT / GPL-3.0 dual license; used under MIT). Files downloaded from the versioned jsDelivr npm distribution over verified HTTPS.

## Validation

Browser integration checks performed with Chromium: 10-file export, valid ZIP containing readable PDFs, Thai/English remarks, 0/90/180/270-degree pages, original page count and text preservation, placement validation, duplicate filenames, batch limit, and download invalidation.


## Project 02 — CSV to Excel

Open `csv-excel.html` from the navigation. Select up to 50 CSV files (10 MB each / 80 MB total), inspect each preview and download one ZIP containing one XLSX per CSV. No server uploads or build step.

Encoding defaults to strict UTF-8, UTF-16 BOM detection, then a tentative Thai Windows-874 fallback. Users can override encoding and delimiters per file. Optional explicit repair reverses Windows-1252 or Windows-874 mojibake into UTF-8; users must inspect the preview. Already lost characters cannot be reconstructed.

All cells are stored as strings to preserve leading zeros, large IDs, date spelling, whitespace and formula-like text. Numbers are therefore not automatically numeric Excel cells. CSV has no original Excel formatting to restore. Blank records and quoted embedded newlines are retained; the final CSV record terminator is not treated as an extra blank record. Workbook columns get readable widths.

Limits: 500,000 cells per file, 1,000,000 cells per conversion batch, plus Excel's row/column and 32,767-character-per-cell limits. Invalid decoding, malformed CSV, empty files or exceeded limits block export with an error. Duplicate filenames receive suffixes. Library licenses: Papa Parse 5.4.1 (MIT), SheetJS-compatible @e965/xlsx 0.20.3 (Apache-2.0), JSZip (MIT).

Chromium integration validation covered multi-file ZIP and XLSX round-trip, Windows-874 Thai, UTF-8 BOM, UTF-16 tab-delimited data, explicit mojibake repair, semicolon/comma/tab delimiters, leading zeros and long IDs, formula-like strings, quoted commas/newlines, blank rows, empty-file/encoding errors and invalidation of old downloads.


## Project 03 — Transaction ACQ splitter

Open `acq-split.html` from any project's navigation. Select one daily MASTER (`.xlsx`, `.xls`, or `.csv`), choose the sheet and last header row (default 1; 0 means no headers), configure groups and check results before downloading a ZIP.

- Rules use physical Excel column positions: AC is column 29, irrespective of header labels. Preview displays column letters.
- Defaults: WeChat = AC in WC/WQ; Diners = AC in DI/DN. Each group supports up to 20 conditions joined with AND or OR, with in/not-in/contains/blank/not-blank operators. Values within one condition are alternatives. Matching trims whitespace and ignores case by default; this is configurable. Match values use displayed cell text.
- Every matched row is exported with all columns and in original order, preceded by the configured header rows. Entirely empty rows are ignored. A row matching multiple groups appears in every matching group; counts report overlaps separately.
- ZIP includes a workbook per group (even a zero-match group), Unmatched and Summary. Sanitized duplicate filenames receive suffixes. Summary accounts for unique matched + unmatched = input transactions.
- Excel cell types, values and number formats are retained where supported by SheetJS. Formulas are exported as cached results; formulas without cached values block export. CSV values remain strings to preserve leading zeros. Charts, conditional formatting, macros and complete source-document styling are not preserved. Header merges, available column widths and row metadata are copied.
- No settlement-date filter is implied: use the daily MASTER, or explicitly add a rule for the appropriate date column. Preview shows actual values for setting date rules.
- Rules and normalization settings can be explicitly saved to localStorage in the current browser; transaction data is never saved there. Reset restores defaults.
- Limits: 20 MB input, 1,000,000 cells in the input rectangle, 30 groups, 3,000,000 total output cells. CSV supports UTF-8, UTF-16 BOM and Windows-874 fallback, with an encoding override.

Chromium end-to-end validation used synthetic 31-column MASTER data to verify physical AC matching, WC/WQ and DI/DN defaults, multiple-column AND/OR, overlaps/unmatched accounting, valid ZIP/XLSX full-row export, Thai and leading zeros, decimal values and number formatting, rule persistence, missing-column validation and CSV input. No production MASTER was supplied; confirm header rows and rules against the real-file preview before operational use.
