# FCIT Faculty Mail Finder

Static Arabic faculty email directory. No build step, backend, or API key is required.

## Run locally

```powershell
python -m http.server 8000
```

Open http://localhost:8000. Serve over HTTP; opening index.html as a file prevents JSON loading in most browsers. For GitHub Pages, select **Deploy from a branch → main → / (root)** in **Settings → Pages**. The runtime files are index.html, style.css, app.js, faculty.json, and favicon.svg. They use relative paths for repository URLs. Search and filtering run locally. The optional Google font has system font fallbacks.

## Data provenance

| Department | Archive snapshot | Faculty records |
| --- | --- | --- |
| CS | 2025-06-18 | 96 |
| IT | 2024-06-06 | 103 |
| IS | 2022-11-14 | 117 |

Total: 316 faculty records. All three archives were accessed successfully. Original downloaded HTML is preserved locally in `cs-source.html`, `it-source.html`, and `is-source.html` and excluded from Git because those pages also contain unrelated contact details. `python fetch_sources.py` downloads the raw archived HTML; `python extract_faculty.py` regenerates faculty.json using Python's standard library. Run `python verify_data.py` to verify the public dataset against those saved sources.

Each record includes `student_section` (`male` or `female`), derived from the source card's enclosing tab: `tab1` = شطر الطلاب; `tab2` = شطر الطالبات. This describes the faculty listing's student section, not an inference about the faculty member's gender. CS: 42 male-section / 54 female-section; IT: 53 / 50; IS: 66 / 51. The initial view has no active criteria and hides results. Department and student-section filters toggle independently and combine with the name search using AND. Clearing all criteria hides results again.

Each name and address is taken from the same faculty card, never joined by position across separate lists. This verifies the association published by the archive; it does not verify current employment or mailbox deliverability. Only syntactically valid @kau.edu.sa addresses are accepted. Snapshot dates describe the requested archived pages, not a current verification date.

Two records have `email: null`: IT's نور عمر باجنيد has a malformed address in the source; IS's عبير عبدالله البلوي lists a non-university address. Neither address is published or guessed. Both display `البريد الجامعي غير متاح في المصدر`. IS also contains an explicit test account, excluded from faculty counts. No English faculty names appear in the retained cards; `english_name` is optional and supported by the search and display when available. Arabic names are preserved as published.

## Validation

`node --check app.js` checks syntax. For browser tests, install Playwright locally with `npm install --no-save --package-lock=false playwright` and `npx playwright install chromium`, then run `node test-site.cjs` with the server active. Optional environment variables: `SITE_URL` (including the trailing slash) for a repository subpath, `CHROME_PATH` for an existing Chrome executable, and `PLAYWRIGHT_MODULE` for an existing Playwright module. The tests check search, filters, clipboard, favicon loading, relative asset paths and responsive overflow at 1440, 768, 390 and 320 pixels. English matching uses a synthetic test record only, never a fabricated faculty entry. Screenshots and browser output are excluded from Git.
