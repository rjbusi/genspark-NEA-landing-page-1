// Automated QA: builds must exist in dist/. Run: npm run build && npm run qa
// Starts the local preview (dist + api/lead.js), then drives headless Chromium.
// Writes screenshots to qa-report/ and prints pass/fail counts.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = 4399;
const BASE = `http://localhost:${PORT}`;
const OUT = new URL('../qa-report/', import.meta.url).pathname;
const SHOTS = process.env.QA_SHOTS !== '0';
mkdirSync(OUT, { recursive: true });

const results = [];
let group = '';
const check = (name, ok, detail = '') => {
  results.push({ group, name, ok: !!ok, detail });
  if (!ok) console.log(`  FAIL ${group} :: ${name} ${detail}`);
};

// ---------- server ----------
const server = spawn(process.execPath, [new URL('../scripts/serve.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(PORT) } });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
await new Promise((r) => setTimeout(r, 800));

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROMIUM_PATH].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const axeSrc = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const EXTERNAL_OK = /^(https:\/\/(www\.)?(instagram\.com|yelp\.com|google\.com|maps\.apple\.com|carecredit\.com|poyst\.com|cloudninemedspadfw\.com|medspascout\.com|communityimpact\.com)\/|tel:\+19728972355$|mailto:cloudninemedspa@gmail\.com$)/;

async function newPage(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 800 ? 900 : 844 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', javaScriptEnabled: opts.js !== false, hasTouch: width < 800 });
  const page = await ctx.newPage();
  page.errors = [];
  page.badRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) page.badRequests.push(r.url()); });
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400 && !r.url().includes('/nope')) page.badRequests.push(`${r.status()} ${r.url()}`); });
  return page;
}

async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += 500) { await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
}

async function landed(page, id) {
  await page.waitForTimeout(1300);
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return { ok: false, top: null };
    const top = el.getBoundingClientRect().top;
    const head = (document.getElementById('header')?.offsetHeight || 0) + (document.getElementById('review-banner')?.offsetHeight || 0);
    return { ok: top >= -2 && top <= head + 60, top: Math.round(top), head };
  }, id);
}

// ---------- per viewport and language ----------
for (const width of [1440, 390, 375]) {
  for (const lang of ['en', 'es']) {
    group = `${width}/${lang}`;
    console.log(`\n== ${group}`);
    const path = lang === 'en' ? '/' : '/es/';
    const page = await newPage(width);
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
    check('page loads 200', res.status() === 200);
    check('html lang', (await page.getAttribute('html', 'lang')) === (lang === 'en' ? 'en-US' : 'es-US'));
    await scrollThrough(page);

    // layout integrity
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check('no horizontal scroll', sw[0] <= sw[1], `${sw}`);
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
    check('no broken images', broken.length === 0, broken.join(','));
    const text = await page.evaluate(() => document.body.innerText + document.title + [...document.querySelectorAll('[aria-label],[alt],[title]')].map((e) => e.getAttribute('aria-label') + e.getAttribute('alt') + e.getAttribute('title')).join(' '));
    check('no em-dashes in visible text', !/—/.test(text));
    const hiddenAfterScroll = await page.$$eval('[data-reveal]', (els) => els.filter((e) => getComputedStyle(e).opacity < 0.5).length);
    check('every reveal visible after scroll', hiddenAfterScroll === 0, `${hiddenAfterScroll} still hidden`);
    const unmasked = await page.$$eval('[data-unmask]', (els) => els.filter((e) => !e.classList.contains('in')).length);
    check('every image panel unmasked after scroll', unmasked === 0, `${unmasked} still masked`);
    // text clipping: headings must not be wider than their container
    const clipped = await page.$$eval('h1, h2, h3', (hs) => hs.filter((h) => h.scrollWidth > h.clientWidth + 2 && getComputedStyle(h).overflow !== 'visible').map((h) => h.textContent.slice(0, 30)));
    check('no clipped headings', clipped.length === 0, clipped.join('|'));

    if (SHOTS) {
      const secs = await page.$$eval('main > section, footer', (els) => els.map((e) => ({ id: e.id, top: e.getBoundingClientRect().top + scrollY })));
      for (const s of secs) {
        await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), s.top);
        await page.waitForTimeout(350);
        await page.screenshot({ path: join(OUT, `${width}-${lang}-${s.id || 'footer'}.png`) });
      }
    }

    // every link on the page: internal anchors resolve, external hosts are right, tel/mailto correct
    const links = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.target, text: a.textContent.trim().slice(0, 40) })));
    let anchorsOk = 0, extOk = 0, telOk = 0;
    for (const l of links) {
      if (l.href.includes('#')) {
        const id = l.href.split('#')[1];
        const exists = await page.$(`#${id}`);
        check(`anchor target exists #${id}`, !!exists);
        if (exists) anchorsOk++;
      } else if (/^(https?:|tel:|mailto:)/.test(l.href)) {
        const good = EXTERNAL_OK.test(l.href);
        check(`external/tel link valid ${l.href.slice(0, 60)}`, good);
        if (l.href.startsWith('http')) check(`external opens new tab ${l.text}`, l.target === '_blank');
        if (l.href.startsWith('tel:')) telOk++; else extOk++;
      } else {
        const r = await page.request.get(BASE + l.href);
        check(`internal link ${l.href} resolves`, r.status() === 200);
      }
    }
    check('tap-to-call links present', telOk >= 4, `${telOk}`);

    // nav anchors land at their section (desktop: nav bar, phone: menu sheet)
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    for (const id of ['treatments', 'depth', 'memberships', 'plan', 'visit']) {
      if (width >= 1024) {
        await page.click(`.nav-links a[href$="#${id}"]`);
      } else {
        await page.click('.menu-btn');
        await page.waitForTimeout(450);
        check(`menu sheet opens (${id})`, await page.$eval('#sheet', (s) => s.classList.contains('open')));
        await page.click(`#sheet a[href$="#${id}"]`);
        check(`menu sheet closes after tap (${id})`, !(await page.$eval('#sheet', (s) => s.classList.contains('open'))));
      }
      const l = await landed(page, id);
      check(`nav lands on #${id}`, l.ok, `top=${l.top} header=${l.head}`);
    }
    if (width < 1024) {
      await page.click('.menu-btn');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      check('Escape closes menu', !(await page.$eval('#sheet', (s) => s.classList.contains('open'))));
    }
    // primary CTA lands on the booking form (after pinned depth section)
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.click('.hero a[data-cta="hero"]');
    const b = await landed(page, 'book');
    check('hero CTA lands on #book', b.ok, `top=${b.top}`);
    await page.evaluate(() => document.querySelector('.depth-cta a').scrollIntoView());
    await page.waitForTimeout(400);
    await page.click('.depth-cta a');
    const p2 = await landed(page, 'plan');
    check('depth CTA lands on #plan', p2.ok, `top=${p2.top}`);

    // mobile sticky bar
    if (width < 768) {
      check('mobile bar shown after hero', await page.$eval('#mbar', (m) => m.classList.contains('show') && getComputedStyle(m).display !== 'none'));
      check('mobile bar call link', (await page.getAttribute('#mbar a[data-cta="bar-call"]', 'href')) === 'tel:+19728972355');
      await page.click('#mbar a[data-cta="bar"]');
      const lb = await landed(page, 'book');
      check('mobile bar CTA lands on #book', lb.ok, `top=${lb.top}`);
    }

    // depth signature follows scroll
    for (const stop of ['surface', 'dermis', 'volume', 'muscle', 'body']) {
      await page.evaluate((s) => { const el = document.getElementById('depth-' + s); scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight / 2 + el.offsetHeight / 2, behavior: 'instant' }); }, stop);
      await page.waitForTimeout(400);
      check(`depth diagram reaches ${stop}`, (await page.getAttribute('#depth', 'data-depth')) === stop);
    }

    // menu filters
    const filterIds = await page.$$eval('[data-filters] button', (bs) => bs.map((b) => b.dataset.filter));
    for (const f of filterIds) {
      await page.click(`[data-filters] button[data-filter="${f}"]`);
      const vis = await page.$$eval('.menu-cat', (cs) => cs.filter((c) => !c.hidden).map((c) => c.dataset.cat));
      check(`menu filter ${f}`, f === 'all' ? vis.length === filterIds.length - 1 : vis.length === 1 && vis[0] === f, vis.join(','));
    }
    await page.click('[data-filters] button[data-filter="all"]');

    // FAQ
    await page.$$eval('.faq-list details', (ds) => ds.forEach((d) => (d.open = false)));
    const faqs = await page.$$('.faq-list summary');
    for (let i = 0; i < faqs.length; i++) {
      await faqs[i].click();
      await page.waitForTimeout(80);
      const open = await page.$$eval('.faq-list details', (ds) => ds.map((d) => d.open));
      check(`FAQ ${i + 1} opens alone`, open[i] && open.filter(Boolean).length === 1);
    }

    // Plan tool
    await page.evaluate(() => document.getElementById('plan').scrollIntoView());
    await page.click('[data-next]');
    check('plan: blocks empty step 1', (await page.textContent('[data-msg]')).length > 0);
    await page.click('[data-group="concerns"] [data-val="L"]');
    await page.click('[data-group="concerns"] [data-val="V"]');
    await page.click('[data-group="concerns"] [data-val="T"]');
    check('plan: multi-select pressed', (await page.$$('[data-group="concerns"] [aria-pressed="true"]')).length === 3);
    await page.click('[data-group="concerns"] [data-val="T"]');
    check('plan: toggle off works', (await page.$$('[data-group="concerns"] [aria-pressed="true"]')).length === 2);
    await page.click('[data-next]');
    check('plan: step 2 shown', await page.isVisible('[data-q="2"]'));
    await page.click('[data-back]');
    check('plan: back works', await page.isVisible('[data-q="1"]'));
    await page.click('[data-next]');
    await page.click('[data-group="areas"] [data-val="F"]');
    await page.click('[data-group="areas"] [data-val="E"]');
    await page.click('[data-next]');
    await page.click('[data-next]');
    check('plan: step 3 requires downtime', (await page.textContent('[data-msg]')).length > 0);
    await page.click('[data-group="downtime"] [data-val="1"]');
    await page.click('[data-next]');
    await page.click('[data-group="history"] [data-val="N"]');
    await page.click('[data-next]');
    check('plan: step 4 requires timing', (await page.textContent('[data-msg]')).length > 0);
    await page.click('[data-group="timing"] [data-val="E"]');
    await page.click('[data-next]');
    await page.waitForTimeout(500);
    check('plan: result shown', await page.$eval('[data-planner]', (a) => a.classList.contains('done')));
    const code = (await page.textContent('[data-code]')).trim();
    check('plan: reference code format', /^C9-LV-FE-1NE-[A-Z]$/.test(code), code);
    const picks = await page.$$eval('.pick strong', (p) => p.map((x) => x.textContent));
    check('plan: picks include Botox and fillers', picks.some((p) => p.startsWith('Botox')) && picks.some((p) => p.startsWith('Dermal') || p.startsWith('Rellenos')), picks.join(','));
    check('plan: club suggestion', await page.isVisible('[data-club]'));
    check('plan: notes for event', (await page.textContent('[data-notes]')).length > 20);
    await page.click('[data-copy]');
    check('plan: copy button responds', (await page.textContent('[data-copy] span')).length > 0);
    check('plan: code carried into form', (await page.inputValue('#plan-form input[name="code"]')) === code);
    // plan form: validation then real submission
    await page.click('#plan-form button[type="submit"]');
    check('plan form: required errors', (await page.$$('#plan-form [data-invalid]')).length >= 4);
    await page.fill('#plan-form-first', 'Qa');
    await page.fill('#plan-form-last', `Test${width}${lang}`);
    await page.fill('#plan-form-phone', '817 555 01');
    await page.check('#plan-form input[name="consent"]');
    await page.click('#plan-form button[type="submit"]');
    check('plan form: bad phone rejected', (await page.textContent('#plan-form .field:nth-of-type(3) .err')).length > 0);
    await page.fill('#plan-form-phone', '(817) 555-0142');
    await page.selectOption('#plan-form-best', 'morning');
    await page.click('#plan-form button[type="submit"]');
    await page.waitForSelector('#plan-form .form-state.ok.show', { timeout: 5000 }).catch(() => {});
    const okText = await page.textContent('#plan-form .form-state.ok');
    check('plan form: success state with code', okText.includes(code), okText);
    check('plan form: lead logged by function', serverLog.includes(`"lastName":"Test${width}${lang}"`) && serverLog.includes(code));
    await page.click('.result [data-restart]');
    check('plan: start over resets', await page.isVisible('[data-q="1"]') && !(await page.$eval('[data-planner]', (a) => a.classList.contains('done'))));

    // call-back form: error state (simulated server failure) then success
    await page.route('**/api/lead', (r) => r.fulfill({ status: 500, body: '{}' }));
    await page.fill('#callback-form-first', 'Qa');
    await page.fill('#callback-form-last', `Cb${width}${lang}`);
    await page.fill('#callback-form-phone', '8175550142');
    await page.check('#callback-form input[name="consent"]');
    await page.click('#callback-form button[type="submit"]');
    await page.waitForTimeout(400);
    check('callback: error state shows phone', await page.isVisible('#callback-form .form-state.bad a[href="tel:+19728972355"]'));
    await page.unroute('**/api/lead');
    // the simulated 500 above is expected; don't count it as a page error
    page.errors = page.errors.filter((e) => !e.includes('500'));
    page.badRequests = page.badRequests.filter((e) => !e.includes('/api/lead'));
    await page.click('#callback-form button[type="submit"]');
    await page.waitForSelector('#callback-form .form-state.ok.show', { timeout: 5000 }).catch(() => {});
    check('callback: success state', await page.isVisible('#callback-form .form-state.ok'));
    check('callback: lead logged', serverLog.includes(`"lastName":"Cb${width}${lang}"`));

    // map loads on demand
    await page.click('[data-load-map]');
    check('map: iframe inserted on click', !!(await page.$('.mapcard iframe[src*="google.com/maps"]')));

    // language switch
    const switchSel = width >= 1024 ? '.header .lang' : '.footer a[hreflang]';
    await page.click(switchSel);
    await page.waitForLoadState('networkidle');
    check('language switch goes to other language', page.url().endsWith(lang === 'en' ? '/es/' : `${PORT}/`), page.url());

    check('zero console errors', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
    check('zero failed local requests', page.badRequests.length === 0, page.badRequests.slice(0, 3).join(' | '));

    // accessibility (axe, WCAG 2 AA incl. contrast). Run on fresh load with everything revealed.
    if (width !== 375) {
      const p = await newPage(width, { reduced: true });
      await p.goto(BASE + path, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: axeSrc });
      const ax = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) })));
      const contrast = ax.filter((v) => v.id === 'color-contrast');
      check('axe: color contrast AA', contrast.length === 0, JSON.stringify(contrast));
      const other = ax.filter((v) => v.id !== 'color-contrast');
      check('axe: no other WCAG/best-practice violations', other.length === 0, JSON.stringify(other));
      await p.context().close();
    }
    await page.context().close();
  }
}

// ---------- reduced motion ----------
group = 'reduced-motion';
console.log(`\n== ${group}`);
for (const width of [1440, 390]) {
  const p = await newPage(width, { reduced: true });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(200);
  const hidden = await p.$$eval('[data-reveal], .split .w > span', (els) => els.filter((e) => getComputedStyle(e).opacity < 0.99 || (getComputedStyle(e).transform !== 'none' && getComputedStyle(e).transform !== 'matrix(1, 0, 0, 1, 0, 0)')).length);
  check(`${width}: all content visible without animation`, hidden === 0, `${hidden} hidden`);
  const progress = await p.$eval('.progress', (e) => getComputedStyle(e).display);
  check(`${width}: scroll progress disabled`, progress === 'none');
  check(`${width}: no errors`, p.errors.length === 0, p.errors.join('|'));
  await p.context().close();
}

// ---------- no JavaScript ----------
group = 'no-js';
console.log(`\n== ${group}`);
{
  const p = await newPage(390, { js: false });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const hidden = await p.$$eval('h1, h2, h3, p, li', (els) => els.filter((e) => e.offsetParent && getComputedStyle(e).opacity < 0.99).length);
  check('all text visible without JS', hidden === 0, `${hidden}`);
  await p.context().close();
  const r = await (await browser.newContext()).request.post(BASE + '/api/lead', { form: { kind: 'callback', lang: 'en', firstName: 'NoJs', lastName: 'Post', phone: '8175550142', consent: 'yes', bestTime: 'any' }, maxRedirects: 0 });
  check('plain form POST redirects with thank-you', r.status() === 303 && /\?sent=CB-/.test(r.headers().location || ''), `${r.status()} ${r.headers().location}`);
}

// ---------- API rules ----------
group = 'api';
console.log(`\n== ${group}`);
{
  const ctx = await browser.newContext();
  const post = (data) => ctx.request.post(BASE + '/api/lead', { data, headers: { Accept: 'application/json' } });
  check('rejects missing consent', (await post({ firstName: 'A', lastName: 'B', phone: '8175550142' })).status() === 422);
  check('rejects bad phone', (await post({ firstName: 'A', lastName: 'B', phone: '123', consent: true })).status() === 422);
  const hp = await post({ firstName: 'Bot', lastName: 'Spam', phone: '8175550142', consent: true, company: 'Acme' });
  check('honeypot answers 200 but stores nothing', hp.status() === 200 && !serverLog.includes('"lastName":"Spam"'));
  check('GET not allowed', (await ctx.request.get(BASE + '/api/lead')).status() === 405);
  await ctx.close();
}

// ---------- front desk decoder ----------
group = 'front-desk';
console.log(`\n== ${group}`);
{
  const p = await newPage(1440);
  const { encode } = await import('../src/lib/plan.js');
  const code = encode({ concerns: ['L', 'V'], areas: ['F', 'E'], downtime: '1', history: 'N', timing: 'E' });
  await p.goto(BASE + '/front-desk/', { waitUntil: 'networkidle' });
  check('noindex meta', (await p.getAttribute('meta[name="robots"]', 'content')).includes('noindex'));
  await p.fill('#desk-code', code.toLowerCase().replace(/-/g, ' '));
  await p.click('#desk-form button');
  const out = await p.textContent('#desk-out');
  check('decodes answers', out.includes('Lines and wrinkles') && out.includes('Under-eyes') && out.includes('Check letter matches'), out.slice(0, 120));
  const wrong = code.slice(0, -1) + (code.endsWith('B') ? 'C' : 'B');
  await p.fill('#desk-code', wrong);
  await p.click('#desk-form button');
  check('flags a misheard code', (await p.textContent('#desk-out')).includes('does not match'));
  await p.fill('#desk-code', 'hello');
  await p.click('#desk-form button');
  check('rejects nonsense', (await p.textContent('#desk-out')).includes('not recognised'));
  await p.goto(BASE + '/front-desk/?code=' + code, { waitUntil: 'networkidle' });
  check('decodes from ?code= link', (await p.textContent('#desk-out')).includes('Lines and wrinkles'));
  check('no errors', p.errors.length === 0, p.errors.join('|'));
  await p.context().close();
}

// ---------- 404, robots, SEO ----------
group = 'seo';
console.log(`\n== ${group}`);
{
  const p = await newPage(390);
  const r = await p.goto(BASE + '/nope', { waitUntil: 'networkidle' });
  check('404 status', r.status() === 404);
  check('404 page content', (await p.textContent('h1')).includes('drifted'));
  await p.click('main a[href="/"]');
  check('404 back home works', new URL(p.url()).pathname === '/');
  const robots = await (await p.request.get(BASE + '/robots.txt')).text();
  check('review build robots disallows all', robots.includes('Disallow: /'));
  for (const path of ['/', '/es/']) {
    await p.goto(BASE + path);
    const head = await p.evaluate(() => ({
      title: document.title, desc: document.querySelector('meta[name=description]')?.content,
      og: document.querySelector('meta[property="og:image"]')?.content, alts: [...document.querySelectorAll('link[hreflang]')].map((l) => l.hreflang),
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)['@type']),
      robots: document.querySelector('meta[name=robots]')?.content, h1: document.querySelectorAll('h1').length,
    }));
    check(`${path} title + description`, head.title.length > 20 && head.desc.length > 80);
    check(`${path} og:image`, head.og?.endsWith('/og.jpg'));
    check(`${path} hreflang en/es/x-default`, ['en-US', 'es-US', 'x-default'].every((h) => head.alts.includes(h)));
    check(`${path} schema business + FAQ`, JSON.stringify(head.ld).includes('MedicalBusiness') && JSON.stringify(head.ld).includes('FAQPage'));
    check(`${path} review build is noindex`, head.robots.includes('noindex'));
    check(`${path} exactly one h1`, head.h1 === 1);
  }
  const og = await p.request.get(BASE + '/og.jpg');
  check('og.jpg served', og.status() === 200);
  await p.context().close();
}

// ---------- em-dash scan of all shipped files ----------
group = 'files';
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const dist = new URL('../dist/', import.meta.url).pathname;
const dashed = walk(dist).filter((f) => /\.(html|js|css|txt|xml|json)$/.test(f) && readFileSync(f, 'utf8').includes('—'));
check('no em-dash in any built file', dashed.length === 0, dashed.join(','));

await browser.close();
server.kill();

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
const byGroup = {};
for (const r of results) { byGroup[r.group] ??= { pass: 0, fail: 0 }; byGroup[r.group][r.ok ? 'pass' : 'fail']++; }
console.log('\n== Summary');
for (const [g, c] of Object.entries(byGroup)) console.log(`${g.padEnd(16)} ${c.pass} pass, ${c.fail} fail`);
console.log(`TOTAL ${pass} passed, ${fail} failed`);
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ pass, fail, byGroup, failures: results.filter((r) => !r.ok) }, null, 2));
process.exit(fail ? 1 : 0);
