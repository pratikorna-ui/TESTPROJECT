# Project Space — PDF Remark

Static browser application for GitHub Pages. Select up to 10 PDFs, enter a separate remark and output filename for each, choose a page, click a blank location, then Run to download a ZIP. The browser processes documents locally; no upload server is used.

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
- Edit a remark or placement after export to invalidate the previous download.

## Dependencies

Vendored files and license notices in `vendor/`: PDF.js 5.4.624 (Apache-2.0), pdf-lib 1.17.1 (MIT), JSZip 3.10.1 (MIT / GPL-3.0 dual license; used under MIT). Files downloaded from the versioned jsDelivr npm distribution over verified HTTPS.

## Validation

Browser integration checks performed with Chromium: 10-file export, valid ZIP containing readable PDFs, Thai/English remarks, 0/90/180/270-degree pages, original page count and text preservation, placement validation, duplicate filenames, batch limit, and download invalidation.
