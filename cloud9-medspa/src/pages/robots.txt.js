import { REVIEW, site } from '../lib/site.js';

export function GET() {
  const base = (process.env.SITE_URL || site.url).replace(/\/$/, '');
  const body = REVIEW
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /front-desk/\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
