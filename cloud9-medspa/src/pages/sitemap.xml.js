import { site } from '../lib/site.js';

export function GET() {
  const base = (process.env.SITE_URL || site.url).replace(/\/$/, '');
  const alt = `<xhtml:link rel="alternate" hreflang="en-US" href="${base}/"/><xhtml:link rel="alternate" hreflang="es-US" href="${base}/es/"/>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${base}/</loc>${alt}</url>
<url><loc>${base}/es/</loc>${alt}</url>
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
