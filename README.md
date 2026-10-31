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
- Default remarks are real PDF text in standard Helvetica, searchable/selectable for English and numbers. Existing document pages/content remain. The optional legacy image mode uses transparent PNG overlays and supports Thai via browser fonts; image remarks are not searchable. Unsupported characters in text mode produce an explicit error instead of silently rasterizing.
- Remarks wrap within remaining page width. Text mode wraps at word boundaries; a single oversized token/amount blocks export so it is not split into unsearchable fragments. Out-of-page remarks block export.
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

Column types are inferred conservatively from header names and all data rows, with per-file/per-column Auto/Text/Number selectors. ID/account/date-like headers, leading zeros, long integers and mixed values default to text; wholly numeric amount/quantity columns or clear decimals default to numbers. Ambiguous integer-only columns default to text. Users can override each column and preview the resulting display before export. Headers remain text. Explicit numeric overrides can remove leading zeros; invalid or unsafe numeric values remain text and are counted in the completion message. There is no longer a fixed G–I conversion. Numeric formats preserve original decimal places. CSV has no original Excel formatting to restore. Blank records and quoted embedded newlines are retained; the final CSV record terminator is not treated as an extra blank record. Workbook columns get readable widths.

Limits: 500,000 cells per file, 1,000,000 cells per conversion batch, plus Excel's row/column and 32,767-character-per-cell limits. Invalid decoding, malformed CSV, empty files or exceeded limits block export with an error. Duplicate filenames receive suffixes. Library licenses: Papa Parse 5.4.1 (MIT), SheetJS-compatible @e965/xlsx 0.20.3 (Apache-2.0), JSZip (MIT).

Chromium integration validation covered multi-file ZIP and XLSX round-trip, Windows-874 Thai, UTF-8 BOM, UTF-16 tab-delimited data, explicit mojibake repair, semicolon/comma/tab delimiters, leading zeros and long IDs, formula-like strings, quoted commas/newlines, blank rows, empty-file/encoding errors and invalidation of old downloads.


## Project 03 — Transaction ACQ splitter

Open `acq-split.html` from any project's navigation. Select one daily MASTER (`.xlsx`, `.xls`, or `.csv`), choose the sheet and last header row (default 1; 0 means no headers), configure groups and check results before downloading a ZIP.

- Rules use physical Excel column positions: AC is column 29, irrespective of header labels. Preview displays column letters.
- Defaults: WeChat = AC in WC/WQ; Diners = AC in DI/DN; Mastercard = AC MA AND P contains either `2C2P ACQ -` or `2C2P MC`; EQ PP = AC EQ AND E blank; Alipay NEW THB = P equals `Alipay - THB (NEW)`; EQ Mastercard = AC EQ AND E starts with 5; UPOP = AC UP/CP AND P contains any of `2C2P ACQ -`, `2C2P UPI`, `UPOP`. Each matched Mastercard row is exported once even when both descriptions match. Each group supports up to 20 conditions joined with AND or OR, with in/not-in/contains/starts-with/blank/not-blank operators. Values within one condition are alternatives. Matching trims whitespace and ignores case by default; this is configurable. Match values use displayed cell text.
- Every matched row is exported with all columns and in original order, preceded by the configured header rows. Entirely empty rows are ignored. A row matching multiple groups appears in every matching group; counts report overlaps separately.
- ZIP includes workbooks only for ACQs with matched transactions plus Summary. Unmatched data and zero-match workbooks are not exported; only unmatched counts remain. Sanitized duplicate filenames receive suffixes. Summary accounts for unique matched + unmatched = input transactions.
- Excel cell types, values and number formats are retained where supported by SheetJS. Formulas are exported as cached results; formulas without cached values block export. CSV values remain strings to preserve leading zeros. Charts, conditional formatting, macros and complete source-document styling are not preserved. Header merges and available column widths are copied; row visibility metadata is not retained.
- No settlement-date filter is implied: use the daily MASTER, or explicitly add a rule for the appropriate date column. Preview shows actual values for setting date rules.
- On load, missing named presets are appended to saved rules; existing user rules are preserved. Rules and normalization settings can be explicitly saved to localStorage in the current browser; transaction data is never saved there. Reset restores defaults.
- Limits: 100 MB input, Excel row/column limits and 30 ACQ groups. The old 5-million input / 10-million output cell restrictions have been removed; output is written in bounded parts. Large-file performance depends on browser memory. Extension and size failures have distinct messages, with actual file size for oversize failures. CSV supports UTF-8, UTF-16 BOM and Windows-874 fallback, with an encoding override.

Chromium end-to-end validation used synthetic 31-column MASTER data to verify physical AC matching, WC/WQ and DI/DN defaults, multiple-column AND/OR, overlaps/unmatched accounting, valid ZIP/XLSX full-row export, Thai and leading zeros, decimal values and number formatting, rule persistence, missing-column validation and CSV input. No production MASTER was supplied; confirm header rows and rules against the real-file preview before operational use.

Additional Project 03 validation: all seven ACQ presets, Mastercard union without duplicate rows, EQ blank and numeric/string prefix 5, exact Alipay matching, UPOP alternatives, source-column retention and number formats, saved-rule migration and starts-with persistence. The initial >20 MB branch check used simulated file-size metadata. A subsequent real 34 MB / 400,000-row test is documented below.


### Large MASTER processing

Project 03 now uses a dedicated worker (`acq-worker.js`). The main page receives only bounded preview/count results; cancellation terminates the worker and releases its data. Use **Read file again** after cancellation. Failed or changed input/rules invalidates export.

For `.xlsx`, `acq-xlsx-reader.js` uses fflate 0.8.2 and sax 1.4.1 to inflate and parse worksheet XML in chunks. This avoids allocating a complete worksheet XML string or a cell object for every source value. Compact row arrays store primitive values, with sparse typed style indices; shared strings, inline strings, booleans, errors, cached formulas and numeric formats are handled. Date-1904 workbooks retain that epoch. Preview stops after the configured headers plus 20 data rows, with at most 60 visible columns. Every source column is still exported. Old `.xls` files use SheetJS dense parsing in the worker.

CSV uses streaming TextDecoder and Papa's incremental parser, preserving multibyte Thai characters and quoted multiline fields across chunk boundaries. UTF-8 auto-detection validates the entire file before falling back to Windows-874; no guessing from just an ASCII header. All CSV cell values remain strings.

Checking reads the complete chosen sheet and reports progress while matching compiled rules. The UI stays responsive during XML parsing and XLSX writing. Compressed-byte progress is stage-specific, not a percentage of overall completion. Some legacy-format stages have indeterminate progress.

Output defaults to 25,000 transactions per XLSX part (10,000/50,000 selectable). Headers repeat in every part. Large ACQs get `_part001`, `_part002`, etc.; Summary lists every filename and row count. XLSX files are created/compressed one part at a time, and the outer ZIP stores the already-compressed files. Source data and compressed outputs still use browser memory; this is not an unlimited-size or low-memory guarantee. Charts, images, complete styling and row visibility metadata are not copied.

Validation: a real generated XLSX containing **400,000 data rows × 31 columns**, approximately 34 MB, was loaded in Chromium. Preview and cancel/reload worked; the page heartbeat remained responsive. All 400,000 rows were classified in about 43 seconds; ZIP generation took about 22 seconds on this machine. An independent Python XML/ZIP check verified all 400,000 IDs exactly once, correct ACQ membership, all 31 columns, Thai content and exact numeric decimal values across 22 output workbooks (including Summary and a zero-match ACQ). These timings are observations, not guarantees for other devices/files. Small browser checks also covered all seven presets, migration of saved rules and shared-string/cached-formula input.

Additional licenses in `vendor/`: fflate 0.8.2 (MIT), sax 1.4.1 (ISC). No build step or backend service is required.

CSV stream-boundary validation used 7-byte input chunks to force splits inside Thai UTF-8 characters, quoted cells and CRLF separators. All 120 rows, quoted commas and embedded newlines round-tripped correctly.

XML namespace regression: SAX open-tag objects belong to the parser's internal stack and must not be renamed. Reader callbacks now derive local names without mutating those objects, and workbook relationship IDs accept namespace aliases. A valid prefixed XLSX previously reproduced a closing-tag error; metadata, preview, full read and browser ZIP export now pass with Thai, leading-zero IDs and decimal formats intact. Parsing stays strict, with failing ZIP-entry paths included in errors. Run the self-contained regression suite with `node tests/acq-xml.cjs` (Node 20+).

Project 02 numeric-column regression: `node tests/csv-numbers.cjs` checks amounts, decimal formats, negatives, headers, ID preservation and unsafe-value fallback. A browser CSV→ZIP→XLSX check also verified G–I cell types and retained text.


Project 01 searchable remarks: default export uses `drawText` with Helvetica, preserving original PDF content and page rotations. Preview uses the same PDF font widths for wrapping and positioning. A global mode selector retains the prior image workflow for Thai or fallback use. Browser validation exported 10 PDFs over all four page rotations and verified English/amount extraction, original text/page counts, no new image objects in text mode, explicit unsupported-character errors, and legacy image export. Git baseline before this change: `befc870`; revert the searchable-remark commit to roll back only this feature while preserving later work.

## Project 04 — Merge Excel files into one table

Open `merge-excel.html`. Select or drag/drop up to 50 `.xlsx`/`.xls`/`.csv` files (100 MB each, 500 MB combined), choose one sheet and the header-row number per file, then inspect schemas/counts. Columns align by trimmed, NFC-normalized, case-insensitive header name. First occurrence determines output labels/order. Empty or duplicate header names reject analysis rather than guessing alignment.

Select output columns and optionally add `Source File (ต้นทาง)`. Missing columns are reported and exported as blank cells. Source rows retain input-file order, excluding fully empty rows; no deduplication is performed. Changing source sheet/header invalidates analysis and prior downloads. The source-name column receives a unique name on collision.

A worker reads sources sequentially using the existing compact XLSX reader (legacy XLS uses SheetJS). Preview is capped at 20 rows. Export rereads one source at a time and incrementally writes one XLSX worksheet using fflate: it does not accumulate a worksheet cell object for every output row. XLSX styles preserve available numeric formats; values and cell types remain, formulas use cached results, unsafe formula references are not copied. Date-1904 inputs normalize to the output's 1900 epoch. Charts, images, complete styling and original layout are not merged. The output holds a single header and at most 1,048,575 data rows; exceeding that blocks export without dropping rows. The final compressed output and current source still use browser memory.

Cancellation terminates the worker. Canceling while inspecting a file can leave that file marked incomplete; remove that entry and reselect it. After canceling analysis/export, inspect again before downloading.

Validation: `node tests/merge-workbook.cjs` covers incremental XLSX writing across buffer flushes, 5,000 rows, precise numeric values/formats, text IDs, Thai/XML escapes, reordered columns, Source File, duplicate-header rejection and date-1904 normalization. Browser checks covered per-file sheet/header choice, missing-column notices, output column selection, source on/off and stale-download invalidation. The output also opened independently with openpyxl, preserving ID, amount and decimal format.


Project 04 CSV and drag/drop update: the drop region accepts incremental batches from different folders without replacing existing files. Files dropped during processing are queued; cancellation clears queued batches. The ordinary file picker remains available. CSV has per-file encoding (UTF-8, Windows-874, UTF-16) and delimiter controls, streaming decoding/parsing and strict malformed-quote validation. CSV cell values remain text, preserving leading zeros and decimal spelling; Excel source types remain unchanged. Mixed CSV/Excel files align through the same header schema and Source File option. Browser validation checked repeated and queued drops, mixed formats, comma/semicolon detection, selected output and preservation of existing files on invalid drops. `node tests/merge-workbook.cjs` additionally validates Thai Windows-874, UTF-16 CSV and malformed CSV rejection.


### MCP Project / JCB and matched-only export

Project 03 includes two additional presets. MCP Project is the union of five branches: B contains `MCP`; B contains `(MCC` AND P contains `BBL`; B equals `Bangkok Airways - 1A [USD]` AND P contains `BBL` AND G is not `USD`; P contains `onyx` AND G is not `THB`; P contains `vfs` AND G is not `THB`. Default trimming/case normalization applies. JCB requires AC = `JC` and P containing either `2C2P ACQ -` or `2C2P JCB`.

The rule editor supports OR alternative branches inside one ACQ, with independent AND/OR conditions inside each branch. A transaction matching multiple branches is added only once to that ACQ. Saved old rules load as before, with missing named presets appended; new alternatives persist through save/reload. Column/condition validation includes every branch. Summary records the complete parenthesized OR expression.

Unmatched transactions are now counted, not retained as row lists, previewed or exported. ZIP contains only nonempty ACQ outputs and Summary; a zero-match run produces Summary only. Historical 400k benchmark counts above describe the earlier export layout, which still included Unmatched/zero-match files.

Run `node tests/acq-mcp.cjs` for branch positives/exclusions, MCP union deduplication, JCB restrictions, count accounting and archive-membership checks. Browser validation also checked the nine-preset editor, OR-branch persistence, worker processing and actual matched-only ZIP download.

Project 02 type inference checks: `node tests/csv-column-types.cjs`. Browser export checks verified auto inference, per-column overrides, protected IDs/dates/formula-like strings, decimal formatting and download invalidation after type changes.

## Project 06 — Reconcile result dashboard

Open `reconcile.html` and upload a Result Reconcile `.xlsx` (up to 100 MB). Choose the last header row, common to all four sheets. A worker reads and summarizes exactly **Matched Transactions**, **Missing in Acquirer**, **Unexpected Acquirer**, and **Variance Summary**; the other sheets are not summarized. Results stay in the browser; no upload server, output file or source modification is involved.

- Matched: extract a valid YYYYMMDD date from column A SourceFileName (prefer the date immediately before `.xls`/`.xlsx`; the sample `...20261007.xlsx_000...` is supported). Group strictly **bank-file date → O settlement date → H bank profile**. SUM Q, R, S, AC and AA independently. Header labels are shown with physical column letters. Invalid dates exclude the row from grouped sums with a counted warning.
- Missing: restrict to D = Settled (trimmed/case-insensitive) and O belonging to bank-file dates seen in Matched A. Compare G's underlying string representation, trimmed and case-sensitive, against G from all Matched rows. Found references are counted as found, not displayed in the pending table. Unfound references and empty G are displayed as requiring review; absence is not proof of nonpayment. Empty G is explicitly flagged. Invalid O dates are reported, not guessed.
- Unexpected: show all nonempty rows and all original columns, paginated 50 at a time. Pagination rereads/cache-switches the source worksheet in the worker rather than putting all raw rows in the page.
- Variance: extract bank-file date from B, sum AO into date/Bank Line A groups, then show one exact total per date with the bank lines listed and an expandable Bank Line breakdown.
- Excel serial dates (including 1904 epoch), ISO dates and explicit DD/MM/YYYY text are supported. Ambiguous filename dates and invalid calendar dates are reported. Text date parsing assumes day/month/year as documented in the UI.
- Decimal totals use BigInt scaled arithmetic; no binary floating-point accumulation artifacts. Blank amount cells count as zero. Non-numeric amounts are counted/excluded individually; affected totals show warnings. A capped list of 100 issue locations appears with an uncapped issue count. Do not treat warned sums as complete without checking the input.

Run `node tests/reconcile-core.cjs` and `node tests/reconcile-workbook.cjs`. Browser integration validation covered the actual four-sheet worker pipeline, hierarchical grouping, the five independent totals, scoped Missing lookup/empty IDs, Unexpected pagination, daily/Bank Line variance totals, ignored extra sheets and invalid-data warnings. A production reconcile file was not supplied; confirm real header rows and results before operational use.

Project 06 compact dashboard update: every profile now has six metric cards (row count + five separate sums). Bank-file dates start collapsed, with exact day totals and day count visible in the summary. Expand/collapse-all controls and collapsible settlement dates reduce scrolling. Daily sums reuse scaled decimal arithmetic and propagate invalid-value warnings; they include only rows admitted into the Matched date groups.

Variance now explicitly filters trimmed/case-insensitive **A = `Bank line`**, before date parsing or AO aggregation. Other line types (including subtotal/total rows) are counted as excluded and do not affect sums or date-error warnings. Eligible date-error rows are still reported. Workbook regression coverage includes a non-Bank-line total with an invalid filename and large amount to confirm it is excluded; browser checks verify six cards, default collapse, expand/collapse controls, exact daily totals and the variance filter.

## Project 05 — Positional append into an existing Output workbook

Open `append-excel.html`. Choose Input and Output `.xlsx` files (100 MB each), their sheets and the last Input header row. Preview the A→A/B→B mapping and append position, then download a new Output. Original files remain unchanged. Input header/preamble rows are skipped; entirely empty Input data rows are skipped. A completely empty destination receives one Input header row automatically. Output row and Excel Table bounds are checked before writing.

The worker preserves the workbook package rather than round-tripping it through a new SheetJS workbook. A streaming ZIP rewrite copies unmodified members with identical uncompressed bytes, transforms only the selected worksheet, and patches related metadata. Existing Output cells/formulas remain; appended Input formulas use saved results and fail if uncached. New cells inherit available last-row Output styles or mapped Input number formats, with date-epoch normalization. New text is inline-string OOXML, preserving IDs and avoiding formula injection. The worksheet transformer handles namespace prefixes and XML/chunk boundaries without allocating its entire XML string.

Supported related sources are expanded for the appended rows: a single contiguous Excel Table starting at A and ending on the destination's last row; direct Pivot cache worksheet references; and direct named ranges used by a Pivot. Related cache definitions enable refresh-on-load; Pivot table definitions/cache records and other sheets remain. The browser does **not** calculate Pivot results. Users must open in Excel, use **Data → Refresh All**, and verify totals. General SUM/formula reference ranges are preserved, not automatically widened, and new-row formulas are not synthesized. Dynamic/external Pivot source formulas are not rewritten.

Reject encrypted/signed files, protected destination sheets, destination sheets containing Pivot tables, multiple target Excel Tables, tables with Total rows, unsafe table alignment, excess columns or Excel row-limit overflow. These cases need a separate data sheet or manual workbook preparation instead of risking Pivot/data overwrite. Metadata parts over 8 MB reject rather than loading arbitrary large metadata strings. Worker cancellation is available; use the reload-sheet-list button after a canceled metadata read.

Validation: `node tests/append-workbook.cjs` covers data/ID/decimal append, source-range refresh, unrelated package byte preservation including formula sheet and opaque binary content, table expansion, empty-output headers, protected/signed rejection and prefixed XML chunk boundaries. A separate browser test used an actual openpyxl-created Pivot workbook, appended two rows, downloaded the result and reopened it independently with openpyxl: Pivot definition and old formula remained, source expanded A1:B2→A1:B4, refresh-on-load was enabled, and only data-sheet/workbook/cache-definition parts changed. Actual Excel Pivot refresh was not automated or claimed.

Project 06 **Export diff found** exports Matched Transactions only when the bank date extracted from SourceFileName A differs from settlement O. Summary groups use both dates and Bank Profile H, combining transactions across SourceFileNames. The Sourcefile cell lists distinct original names; a Sourcefiles sheet also lists all names by group (used as fallback if the cell exceeds Excel’s 32,767-character limit). The 12 output columns contain source, dates (DD/MM/YYYY), profile, count, sums Q/R/S/AC/AA, Net amount and a blank Remark. Net amount is the signed sum R + S + AC + AA, as requested. Invalid dates are excluded with a status count; invalid amounts block export rather than silently exporting partial totals. Decimal totals that cannot round-trip to Excel numbers remain exact text. Export runs in the existing worker. Tests: `node tests/reconcile-workbook.cjs`.

Project 03 output filenames copy the unique valid DDMMYYYY date from the MASTER filename, e.g. `detail 01102026.xlsx` → `WeChat 01102026.xlsx` (or `_part001.xlsx`). No additional date selection is needed. A missing, invalid or ambiguous date blocks export with a rename instruction, rather than inventing a date. Summary.xlsx records the date and actual output filenames.

## Project 07 — Combine account statements

Open `statements.html`. Drag/drop or choose repeated batches of `.xlsx`, `.xls`, `.csv` and text `.dat` files (30 files, 30 MB each, 150 MB total). Choose one source sheet per file and edit each destination sheet name. Suggested names use the bank prefix and last four digits from the filename only; verify them because filename dates may be mistaken for account numbers. Set bank and statement month to download e.g. `BAY 10.2026.xlsx`, with one sheet per selected account. Names must be unique and valid Excel names. Removing files or changing settings invalidates the prior download. Processing is local.

XLSX sheets are combined by merging OOXML packages instead of recreating the cells: cell/row/column styles, formats, shared strings, images, merged cells, print settings, print areas/titles and worksheet relationships are retained. Style IDs, strings and relationships are remapped. Only the selected sheet and reachable package parts are copied; unselected sheets and unused shared strings are excluded. Different workbook themes produce a warning and use the first theme. Charts, Pivot components, the 1904 date epoch, and sheet formulas referring to other sheets/files/structured tables are rejected to avoid producing incorrect references. This is not a general Excel workbook migration tool; inspect output before use.

Legacy XLS is converted through SheetJS: values and supported number formats are retained, but layout/colors/images are not guaranteed. CSV/DAT become text tables, retaining leading zeros and amount strings. Text decoding supports UTF-8, UTF-16 LE/BE and Windows-874; delimiters include comma, tab, semicolon and pipe, with manual overrides. Binary, fixed-width and bank-specific DAT layouts require a future parser and are not supported. No bank-specific data rewriting or account extraction from sheet contents is attempted.

Validation: serve this directory and run `node tests/statements-browser.cjs` (default localhost:8165, override `STATEMENT_TEST_URL`). This covers multiple upload batches, XLSX/XLS/DAT, Thai, leading-zero identifiers, output naming, unique sheet validation, excluded source sheets and browser errors. Additional synthetic openpyxl fixtures with images, explicit font/fill, number formats, merged cells, dimensions, print areas/titles and landscape page setup were downloaded through Chromium and independently checked with openpyxl. Actual customer statement layouts and Microsoft Excel rendering have not yet been validated.
