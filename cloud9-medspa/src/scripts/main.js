import { initSky } from './sky.js';
import { initPlanner } from './planner.js';
import { initForms } from './forms.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Review banner height feeds the fixed header offset. */
const banner = $('#review-banner');
if (banner) {
  const set = () => document.documentElement.style.setProperty('--banner-h', banner.offsetHeight + 'px');
  set();
  new ResizeObserver(set).observe(banner);
}

/* Reveals: headings word by word, blocks fade up, art unmasks. */
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    }
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
$$('[data-split], [data-reveal], [data-timeline]').forEach((el) => revealIO.observe(el));
// Clip-path hides the element from IntersectionObserver, so watch its parent instead.
const unmaskIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.querySelectorAll(':scope > [data-unmask]').forEach((el) => el.classList.add('in'));
    unmaskIO.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
$$('[data-unmask]').forEach((el) => unmaskIO.observe(el.parentElement));

/* Header turns solid once the hero scrolls under it; mobile bar appears after the hero. */
const header = $('#header');
const mbar = $('#mbar');
const hero = $('.hero');
if (header && hero) {
  new IntersectionObserver(([e]) => {
    header.classList.toggle('solid', !e.isIntersecting);
  }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 }).observe(hero.querySelector('.hero-top') || hero);
  if (mbar) {
    new IntersectionObserver(([e]) => mbar.classList.toggle('show', !e.isIntersecting), { threshold: 0 })
      .observe(hero.querySelector('.hero-ctas') || hero);
  }
} else if (header) {
  header.classList.add('solid');
  mbar?.classList.add('show');
}

/* Mobile menu sheet */
const menuBtn = $('.menu-btn');
const sheet = $('#sheet');
if (menuBtn && sheet) {
  const label = $('.menu-label', menuBtn);
  sheet.inert = true;
  const setOpen = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    sheet.classList.toggle('open', open);
    sheet.inert = !open;
    label.textContent = open ? label.dataset.close : label.dataset.open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
    header?.classList.toggle('solid', open || header.classList.contains('solid'));
    if (open) $('a', sheet)?.focus();
  };
  menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) { setOpen(false); menuBtn.focus(); }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
}

/* Open / closed status in Fort Worth time */
const i18n = JSON.parse($('#i18n')?.textContent || '{}');
function chicagoNow(tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const map = { Mon: 'Mo', Tue: 'Tu', Wed: 'We', Thu: 'Th', Fri: 'Fr', Sat: 'Sa', Sun: 'Su' };
  return { day: map[parts.weekday], mins: Number(parts.hour) * 60 + Number(parts.minute) };
}
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmt = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const hh = h > 12 ? h - 12 : h;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''}${i18n.lang === 'es' ? ' ' : ''}${h >= 12 ? 'pm' : 'am'}`;
};
function openStatus(hours, tz) {
  const { day, mins } = chicagoNow(tz);
  const today = hours.find((h) => h.days.includes(day));
  const st = i18n.status;
  if (today && mins >= toMin(today.opens) && mins < toMin(today.closes)) {
    return { open: true, text: `${st.openNow}, ${st.until} ${fmt(today.closes)}`, day };
  }
  if (today && mins < toMin(today.opens)) return { open: false, text: `${st.closedNow}. ${st.opens} ${st.today} ${st.at} ${fmt(today.opens)}`, day };
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(DAYS.indexOf(day) + i) % 7];
    const h = hours.find((x) => x.days.includes(d));
    if (h) {
      const when = i === 1 ? st.tomorrow : i18n.days[d];
      return { open: false, text: `${st.closedNow}. ${st.opens} ${when} ${st.at} ${fmt(h.opens)}`, day };
    }
  }
  return { open: false, text: st.closedNow, day };
}
const chip = $('#open-chip');
if (chip && i18n.status) {
  const r = openStatus(JSON.parse(chip.dataset.hours), chip.dataset.tz);
  $('.txt', chip).textContent = r.text;
  $('.dot', chip).classList.toggle('closed', !r.open);
  const status = $('[data-open-status]');
  if (status) {
    status.hidden = false;
    $('.txt', status).textContent = r.text;
    $('.dot', status).classList.toggle('closed', !r.open);
  }
  $(`[data-hours-table] [data-day="${r.day}"]`)?.classList.add('today');
}

/* Signature: depth diagram follows the active stop */
const depth = $('[data-depth-section]');
if (depth) {
  depth.dataset.depth = 'surface';
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) depth.dataset.depth = e.target.dataset.stop;
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  $$('.stop', depth).forEach((s) => io.observe(s));
}

/* Menu: filters and the illustration that follows the category in view */
const filters = $('[data-filters]');
if (filters) {
  filters.hidden = false;
  const cats = $$('.menu-cat');
  const arts = $$('.menu-art .art');
  const cap = $('[data-art-cap]');
  const ids = cats.map((c) => c.dataset.cat);
  const showArt = (id) => {
    const i = ids.indexOf(id);
    arts.forEach((a, j) => a.classList.toggle('on', j === i));
    if (cap && cats[i]) cap.textContent = cats[i].dataset.label;
  };
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-filter]');
    if (!b) return;
    const f = b.dataset.filter;
    $$('button', filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cats.forEach((c) => { c.hidden = f !== 'all' && c.dataset.cat !== f; });
    if (f !== 'all') showArt(f);
  });
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) showArt(e.target.dataset.cat);
  }, { rootMargin: '-40% 0px -50% 0px' });
  cats.forEach((c) => {
    io.observe(c);
    c.addEventListener('pointerenter', () => showArt(c.dataset.cat));
  });
}

/* Map loads only when asked (privacy and speed) */
$$('[data-load-map]').forEach((btn) => btn.addEventListener('click', () => {
  const card = btn.closest('[data-map]');
  if (!card || card.classList.contains('live')) return;
  const f = document.createElement('iframe');
  f.src = card.dataset.map;
  f.title = card.dataset.mapTitle;
  f.loading = 'lazy';
  f.referrerPolicy = 'no-referrer-when-downgrade';
  card.appendChild(f);
  card.classList.add('live');
  f.focus();
}));

/* FAQ: one open at a time where the name attribute isn't supported */
$$('.faq-list details').forEach((d) => d.addEventListener('toggle', () => {
  if (d.open) $$('.faq-list details').forEach((o) => { if (o !== d) o.open = false; });
}));

initSky($('#sky'), { reduced });
initPlanner($('[data-planner]'));
initForms();
