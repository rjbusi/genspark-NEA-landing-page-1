import site from '../content/site.json';
import en from '../content/en.json';
import es from '../content/es.json';
import services from '../content/services.json';
import memberships from '../content/memberships.json';
import team from '../content/team.json';
import reviews from '../content/reviews.json';
import media from '../content/media.json';

// SITE_MODE=review (default) shows unverified facts with a flag and keeps the
// site out of search engines. SITE_MODE=production hides unverified items.
export const MODE = (import.meta.env.SITE_MODE || process.env.SITE_MODE || 'review').toLowerCase();
export const REVIEW = MODE !== 'production';

export const show = (item) => item == null ? false : (item.verified !== false || REVIEW);
export const flagged = (item) => REVIEW && item && item.verified === false;

export const STRINGS = { en, es };
export { site, services, memberships, team, reviews, media };

export const PATHS = { en: '/', es: '/es/' };

export function t(lang) {
  return STRINGS[lang];
}

export function fill(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

export function price(item, s) {
  if (item.price == null) return s.menu.atConsult;
  if (item.priceTo) return `$${item.price} ${s.menu.to} $${item.priceTo} ${s.menu.perMonth}`;
  if (item.unit === 'unit') return `$${item.price} ${s.menu.perUnit}`;
  if (item.unit === 'month') return `$${item.price} ${s.menu.perMonth}`;
  return `$${item.price}`;
}

export function fmtTime(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number);
  if (lang === 'es') return `${h > 12 ? h - 12 : h}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`;
  return `${h > 12 ? h - 12 : h}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`;
}

export const DAY_KEYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export function hoursFor(day) {
  return site.hours.find((h) => h.days.includes(day)) || null;
}

export const nameOf = (item, lang) => (lang === 'es' && item.name_es) || item.name;
