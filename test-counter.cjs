const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {randomUUID} = require('node:crypto');
const {PGlite} = require('@electric-sql/pglite');
const {chromium} = require('playwright');

(async () => {
  const db = new PGlite();
  const migration = fs.readFileSync('netlify/database/migrations/202611170001_visitor_counter.sql', 'utf8');
  await db.exec(migration);
  const {createHandler} = await import('./netlify/functions/visitor-count.mjs');
  const handler = createHandler((sql, values) => db.query(sql, values));
  const request = sessionId => handler(new Request('http://localhost/.netlify/functions/visitor-count', {
    method: 'POST', body: JSON.stringify({sessionId})
  }));
  const total = async () => Number((await db.query('SELECT total FROM visitor_counter')).rows[0].total);
  assert.equal(await total(), 108);
  const same = randomUUID();
  await Promise.all(Array.from({length: 30}, () => request(same)));
  assert.equal(await total(), 109, 'duplicate burst adds exactly one');
  await Promise.all(Array.from({length: 30}, () => request(randomUUID())));
  assert.equal(await total(), 139, 'distinct burst loses no increments');
  await db.exec(migration);
  assert.equal(await total(), 139, 'migration rerun preserves total and session IDs');
  await request(same);
  assert.equal(await total(), 139);
  assert.equal((await request('invalid')).status, 400);
  assert.equal((await handler(new Request('http://localhost/'))).status, 405);
  assert.equal((await createHandler(() => {throw new Error('offline');})(new Request('http://localhost/', {
    method: 'POST', body: JSON.stringify({sessionId: randomUUID()})
  }))).status, 503);
  // An update failure must roll back the session insertion too, allowing retry.
  await db.exec(`CREATE FUNCTION fail_counter() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'test failure'; END; $$;
    CREATE TRIGGER fail_counter BEFORE UPDATE ON visitor_counter
    FOR EACH ROW EXECUTE FUNCTION fail_counter();`);
  const retryId = randomUUID();
  assert.equal((await request(retryId)).status, 503);
  assert.equal((await db.query('SELECT * FROM visitor_sessions WHERE session_id=$1', [retryId])).rows.length, 0);
  await db.exec('DROP TRIGGER fail_counter ON visitor_counter; DROP FUNCTION fail_counter()');
  await request(retryId);
  assert.equal(await total(), 140);

  let calls = 0;
  const assets = {'/':'index.html', '/index.html':'index.html', '/app.js':'app.js',
    '/visitor-counter.js':'visitor-counter.js', '/style.css':'style.css', '/faculty.json':'faculty.json', '/favicon.svg':'favicon.svg'};
  const server = http.createServer(async (req, res) => {
    if (req.url === '/.netlify/functions/visitor-count') {
      calls++;
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await handler(new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method, headers: req.headers, body: Buffer.concat(chunks)
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text()); return;
    }
    const asset = assets[req.url];
    if (!asset) {res.writeHead(404); res.end(); return;}
    const type = asset.endsWith('.js') ? 'text/javascript' : asset.endsWith('.css') ? 'text/css' : asset.endsWith('.json') ? 'application/json' : asset.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
    res.writeHead(200, {'Content-Type': `${type}; charset=utf-8`}); res.end(fs.readFileSync(asset));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({permissions: ['clipboard-read', 'clipboard-write']});
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.locator('#visitor-counter').waitFor();
    assert.equal(await page.locator('#visitor-total').textContent(), '141', 'opening alone counts');
    assert.equal(await page.locator('#visitor-counter span').textContent(), 'عدد الزائرين');
    await page.reload(); await page.locator('#visitor-counter').waitFor();
    assert.equal(await page.locator('#visitor-total').textContent(), '141', 'refresh deduplicates');
    await page.waitForFunction(() => !document.querySelector('#search').disabled);
    const before = calls;
    await page.locator('[data-department="CS"]').click();
    await page.locator('.copy').first().click();
    await page.locator('#search').fill('محمد');
    assert.equal(calls, before, 'interactions never call counter');
    assert.equal(await total(), 141);
    for (const width of [390, 320]) {
      await page.setViewportSize({width, height: 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.evaluate(() => {
        const box = document.querySelector('#visitor-counter').getBoundingClientRect();
        return box.top >= document.querySelector('.filter-panel').getBoundingClientRect().bottom &&
          box.bottom <= document.querySelector('.directory').getBoundingClientRect().top &&
          box.left >= 0 && box.right <= innerWidth;
      }), true, `counter placement at ${width}px`);
    }
    await page.screenshot({path: 'preview-counter-320.png', fullPage: true});
    const fresh = await browser.newContext();
    const second = await fresh.newPage(); await second.goto(base);
    await second.locator('#visitor-counter').waitFor();
    assert.equal(await second.locator('#visitor-total').textContent(), '142', 'new session increments');
    await second.route('**/.netlify/functions/visitor-count', route => route.fulfill({status:503, body:'{}'}));
    await second.reload(); await second.waitForFunction(() => !document.querySelector('#search').disabled);
    assert.equal(await second.locator('#visitor-counter').isVisible(), false);
    await second.locator('[data-department="IT"]').click();
    assert.ok(await second.locator('.card').count() > 0, 'directory works during counter failure');
    assert.deepEqual(errors, []);
    console.log('PASS: SQL baseline, duplicate/distinct bursts, rollback/retry, reseed safety; browser open, refresh, new session, interaction isolation, failure fallback, 390/320px layout.');
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve)); await db.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
