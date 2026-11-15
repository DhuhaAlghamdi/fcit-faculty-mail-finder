const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true});
 const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 const page = await context.newPage();
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 const base = process.env.SITE_URL || 'http://127.0.0.1:8000/';
 await page.goto(base);
 assert.equal(await page.title(), 'FCIT Faculty Mail Finder');
 for (const asset of ['index.html','app.js','style.css','faculty.json','favicon.svg']) {
  const response = await page.request.get(new URL(asset, base).href);
  assert.equal(response.status(),200,asset);
 }
 assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'./favicon.svg');
 assert.equal(await page.evaluate(async()=>{const icon=new Image();icon.src=document.querySelector('link[rel="icon"]').href;await icon.decode();return icon.naturalWidth>0}),true);
 const localRequests=[];page.on('request',request=>{const url=new URL(request.url());if(url.origin===new URL(base).origin)localRequests.push(url.pathname)});
 await page.reload();
 await page.locator('#search').waitFor();
 await page.waitForFunction(()=>!document.querySelector('#search').disabled);
 assert.equal(await page.locator('.directory').isVisible(),false);
 assert.equal(await page.locator('[aria-pressed="true"]').count(),0);
 assert.equal(await page.locator('#search').inputValue(),'');
 assert.equal(await page.locator('[data-department="all"],footer,.archive-note,.hint').count(),0);
 await page.screenshot({path:'preview-initial.png'});
 const records=JSON.parse(fs.readFileSync('faculty.json','utf8'));
 const search=page.locator('#search');
 assert.equal(await page.locator('.search-box kbd,#section-label').count(),0);
 assert.equal(await page.locator('.section-filter [role="group"]').getAttribute('aria-label'),'القسم الدراسي');
 await page.locator('h1').click(); await page.keyboard.press('/');
 assert.equal(await search.evaluate(el=>el===document.activeElement),true);
 assert.equal(await search.inputValue(),'');
 for(const query of ['منى','منى غطيش','منى الخزاعي','منى غطيش الخزاعي','مُنَى   الْخُزَاعِي','منى غطي الخز']){
  await search.fill(query);
  assert.ok((await page.locator('.card h3').allTextContents()).includes('منى غطيش الخزاعي'),query);
 }
 await search.fill('الخزاعي منى');
 assert.equal(await page.locator('.card').count(),0,'name parts must retain typed order');
 await search.fill('منى الخزاعي');
 await page.locator('[data-department="IT"]').click();
 await page.locator('[data-section="female"]').click();
 assert.equal(await page.locator('.card h3').textContent(),'منى غطيش الخزاعي');
 await page.locator('[data-section="male"]').click(); assert.equal(await page.locator('.card').count(),0);
 await page.locator('[data-section="male"]').click();
 await page.locator('[data-department="CS"]').click(); assert.equal(await page.locator('.card').count(),0);
 await page.locator('[data-department="CS"]').click();
 await search.fill('');
 for(const dept of ['CS','IT','IS']){
  await page.locator(`[data-department="${dept}"]`).click();
  assert.equal(await page.locator('.card').count(),records.filter(r=>r.department===dept).length);
  await page.locator(`[data-department="${dept}"]`).click();
  assert.equal(await page.locator('.directory').isVisible(),false);
 }
 for(const section of ['male','female']){
  await page.locator(`[data-section="${section}"]`).click();
  assert.equal(await page.locator('.card').count(),records.filter(r=>r.student_section===section).length);
  await page.locator(`[data-section="${section}"]`).click();
 }
 await page.locator('[data-department="IT"]').click();
 await page.locator('[data-section="male"]').click();
 assert.equal(await page.locator('.card').count(),53);
 assert.equal(await page.locator('.card .badge.IT').count(),53);
 assert.ok((await page.locator('.card .department').allTextContents()).every(s=>s==='القسم الدراسي: طلاب'));
 const maleIT=records.find(r=>r.department==='IT'&&r.student_section==='male');
 await search.fill(maleIT.name); assert.ok(await page.locator('.card').count()>0);
 await search.fill(records.find(r=>r.department==='CS').name);
 assert.equal(await page.locator('.card').count(),0);
 await search.fill('');
 await page.locator('[data-department="IT"]').click();
 assert.equal(await page.locator('.card').count(),161);
 await page.locator('[data-section="male"]').click();
 assert.equal(await page.locator('.directory').isVisible(),false);
 await search.fill(records[0].name); assert.ok(await page.locator('.card').count()>=1);
 await search.fill('أَحْمَد'); assert.ok(await page.locator('.card').count()>1);
 await search.fill('أ.د.  أحمد   سعيد'); assert.equal(await page.locator('.card h3').first().textContent(),records[0].name);
 await search.fill('Dr. احمد سعيد'); assert.ok(await page.locator('.card').count()>=1);
 await search.fill(records[0].name);
 assert.equal(await page.locator('.email-row a').first().getAttribute('href'),'mailto:'+records[0].email);
 await page.locator('.copy').first().click();
 await page.getByText('تم نسخ البريد',{exact:true}).waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),records[0].email);
 await search.fill('لايوجداسممم'); assert.equal(await page.locator('.card').count(),0);
 assert.equal(await page.locator('#status').textContent(),'لا توجد نتائج مطابقة');
 await search.fill('نور عمر باجنيد'); assert.equal(await page.locator('.missing').textContent(),'البريد الجامعي غير متاح في المصدر');
 // Synthetic record tests English behavior without adding invented people to the dataset.
 assert.equal(await page.evaluate(()=>matches({name:'اسم',english_name:'Alice Smith',department:'CS'},'DR. aLiCe','CS')),true);
 assert.equal(await page.evaluate(()=>matches({name:'اسم',english_name:'Alice Jane Smith',department:'CS'},'aLiCe smi','CS')),true);
 assert.equal(await page.evaluate(()=>matches({name:'اسم',english_name:'Alice Jane Smith',department:'CS'},'Smith Alice','CS')),false);
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900}); await search.fill('احمد');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  const layout=await page.evaluate(()=>{
   const group=document.querySelector('.section-filter .filters').getBoundingClientRect();
   const departments=document.querySelector('.filter-panel>.filters').getBoundingClientRect();
   const box=document.querySelector('.search-box').getBoundingClientRect();
   const icon=document.querySelector('.search-box svg').getBoundingClientRect();
   const input=document.querySelector('#search').getBoundingClientRect();
   return {centered:Math.abs((group.left+group.right)/2-(departments.left+departments.right)/2)<2,below:group.top>=departments.bottom,iconRight:icon.left>=input.right,inputFills:input.left-box.left<22};
  });
  assert.ok(Object.values(layout).every(Boolean),JSON.stringify({width,...layout}));
  const positions=await page.evaluate(()=>[...document.querySelectorAll('[data-department],.badge')].map(el=>{const ar=el.querySelector('span').getBoundingClientRect();const code=el.querySelector('b').getBoundingClientRect();return code.right<=ar.left}));
  assert.ok(positions.every(Boolean),`department code on visual left ${width}`);
  assert.equal(await page.locator('.email-row a').first().getAttribute('dir'),'ltr');
  if(width===1440||width===390) { await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);document.querySelector('#toast').classList.remove('visible')}); await page.screenshot({path:`preview-${width}.png`}); }
 }
 // Clipboard fallback and rejected-write feedback.
 await search.fill(records[0].name);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
 await page.locator('.copy').first().click();
 assert.equal(await page.locator('.copy').first().textContent(),'تم النسخ');
 assert.deepEqual(errors,[]);
 assert.ok(localRequests.every(path=>path.startsWith(new URL(base).pathname)), 'Local assets stay under the repository path');
 await search.fill(''); assert.equal(await page.locator('.directory').isVisible(),false);
 await page.setViewportSize({width:390,height:900});
 await page.evaluate(()=>{document.activeElement.blur();document.querySelector('#toast').classList.remove('visible');window.scrollTo(0,0)});
 await page.screenshot({path:'preview-initial-mobile.png'});
 await browser.close(); console.log('PASS: empty initial view, name-only search, department/section-only filters, IT + male (53), combined name + filters, toggle clearing, normalization, English matching, clipboard + fallback, empty results, code placement, RTL and 4 viewport widths.');
})().catch(e=>{console.error(e);process.exit(1)});
