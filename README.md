# FCIT Faculty Mail Finder

دليل للبحث عن البريد الجامعي لأعضاء هيئة التدريس في كلية الحاسبات وتقنية المعلومات بجامعة الملك عبدالعزيز.

I built this site to make it easier for FCIT students at King Abdulaziz
University to find their instructors’ university emails.

## Features

- Search by full or partial Arabic name.
- Filter by Computer Science (CS), Information Technology (IT), or Information Systems (IS).
- Filter by student section (`طلاب` or `طالبات`). Department and section filters can be combined with each other and with name search.

Built with HTML, CSS, and JavaScript. Search and filtering run in the browser using `faculty.json`. The visitor counter uses a Netlify Function and Netlify Database (PostgreSQL); directory search still works when the counter is unavailable.

## Visitor counter and Netlify setup

The small **عدد الزائرين** box appears below the filters and above the results. Opening the page sends one POST to `/.netlify/functions/visitor-count`, independently of directory loading. Search, filters and email copying never call it. A random UUID in `sessionStorage` identifies the tab's browsing session; reloads and retries reuse it. Closing that session and opening a fresh session creates a new ID. Browser session restoration can retain the original ID. When storage or the endpoint fails, the box stays hidden.

Before deploying to the existing Netlify project:

1. Enable **Data & Storage → Database** in the Netlify project. The `@netlify/database` dependency also supports automatic provisioning. Keep the same production database for subsequent deployments; no browser API keys are required. Netlify supplies the server-side connection string.
2. Deploy through Netlify's Git/build workflow so dependencies, Functions and database migrations are processed. `netlify.toml` sets Node 22, build command `npm run build`, publish directory `dist`, and Functions directory `netlify/functions`. A static folder drag-and-drop alone is insufficient.
3. Confirm the migration `netlify/database/migrations/202611170001_visitor_counter.sql` succeeds. Netlify applies migrations before publishing. It seeds **108 only when the counter row is absent**, so the first new session returns **109**. Subsequent deploys preserve both the total and session records. Do not delete/reset the production database or truncate these tables.

The database function locks the counter row, inserts the session under a unique primary key, and increments only for a newly inserted session, all in one PostgreSQL transaction. Failure rolls back both changes, so retrying after a lost response is safe. Session IDs are anonymous; no names, emails, IP addresses or browser fingerprints are stored. IDs are retained to preserve deduplication. This measures browsing sessions from the historical baseline, rather than continuing Netlify Analytics' unique-person metric. Deploy previews use isolated database branches.

Run `npm ci`, `npm run build`, and `npm test`. The counter tests use embedded PostgreSQL (PGlite), the real Function handler, and Playwright/Chrome. Set `CHROME_PATH` if Chrome is installed elsewhere. They verify baseline preservation, duplicate and distinct request bursts, transaction rollback/retry, page-open counting, refresh deduplication, a fresh browser session, interaction isolation, endpoint failure, and 390/320 px layouts. Hosted Netlify/database behavior still needs a production smoke check after setup. For full local platform integration, use Netlify CLI 26+ with `netlify dev` and a linked project.

## Run locally

From the project folder, start a local server:

```powershell
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). The local server lets the browser load `faculty.json` over HTTP.

## Data sources (Where the emails came from)

I collected the listings from archived KAU pages for [Computer Science][cs],
[Information Technology][it], and [Information Systems][is]. Some emails
may have changed since those pages were archived.

[cs]: https://web.archive.org/web/20250618055258/https://fcitweb.kau.edu.sa/fcitwebsite/facultycsar-new.php
[it]: https://web.archive.org/web/20240606124554/https://fcitweb.kau.edu.sa/fcitwebsite/facultyitar-new.php
[is]: https://web.archive.org/web/20221114154659/https://fcitweb.kau.edu.sa/fcitwebsite/facultyisar-new.php

Names and email addresses are extracted from the same faculty card. The `student_section` field reflects the section where the card appears in the archive (`tab1` for `طلاب`, `tab2` for `طالبات`).

Only addresses with valid syntax and the `@kau.edu.sa` domain are included. Two faculty records have `email: null` because their source cards contain a malformed or non-university address. These cards display **البريد الجامعي غير متاح في المصدر**. An explicit test entry in the IS archive is excluded from the totals.

Arabic names are preserved as published. The site supports an optional `english_name` field, which is empty in the current dataset. The snapshot dates indicate when the source pages were archived. Current faculty appointments and mailbox deliverability are unverified.

### Regenerate the dataset

The archived HTML is stored locally as `cs-source.html`, `it-source.html`, and `is-source.html`. Run `fetch_sources.py` if you need to download the archived pages again, then regenerate `faculty.json`:

```powershell
python extract_faculty.py
```

The extraction script uses Python’s standard library.

## Validation

Check JavaScript syntax with `node --check app.js`. With the local server running, use `node test-site.cjs` to run the browser tests. The script requires Playwright and Chrome, and its local paths may need updating on another machine.

The tests cover browser interactions and horizontal overflow at viewport widths of 1440, 768, 390, and 320 px. English name matching is tested with a synthetic record that stays outside the published dataset.
