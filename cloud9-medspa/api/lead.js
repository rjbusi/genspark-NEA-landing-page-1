// POST /api/lead : receives call-back and plan requests.
//
// Delivery is configured with environment variables (Vercel > Settings > Environment Variables):
//   RESEND_API_KEY   + LEAD_EMAIL_TO (+ optional LEAD_EMAIL_FROM)  -> email via Resend
//   LEAD_WEBHOOK_URL                                               -> JSON POST (Zapier, Make, n8n, CRM, Sheets)
// Every lead is also written to the function log ("LEAD {...}") so nothing is lost
// before delivery is set up: Vercel > Project > Logs, filter "LEAD".

import { decode } from '../src/lib/plan.js';

const LABELS = {
  concerns: { L: 'Lines and wrinkles', V: 'Lost volume or thin lips', T: 'Texture, pores or scars', S: 'Sun spots or redness', A: 'Breakouts', D: 'Dull, tired skin', H: 'Unwanted hair', R: 'Thinning hair', W: 'Weight', I: 'Energy and hydration' },
  areas: { F: 'Whole face', E: 'Under-eyes', P: 'Lips', N: 'Neck and chest', B: 'Body' },
  downtime: { 0: 'None', 1: 'A day or two', 2: 'Up to a week' },
  history: { N: 'First time', R: 'Has had treatments' },
  timing: { X: 'No date', E: 'Event within 4 weeks', M: '1 to 3 months' },
};

const clean = (v, max = 80) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const ref = () => 'CB-' + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[O0I1]/g, 'X');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) {
    raw = await new Promise((resolve, reject) => {
      let s = '';
      req.on('data', (c) => { s += c; if (s.length > 20000) reject(new Error('too large')); });
      req.on('end', () => resolve(s));
      req.on('error', reject);
    });
  }
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) return JSON.parse(raw || '{}');
  return Object.fromEntries(new URLSearchParams(raw));
}

function summary(lead) {
  const lines = [
    `New ${lead.kind === 'plan' ? 'plan' : 'call-back'} request from the website`,
    '',
    `Name: ${lead.firstName} ${lead.lastName}`,
    `Phone: (${lead.phone.slice(0, 3)}) ${lead.phone.slice(3, 6)}-${lead.phone.slice(6)}`,
    `Best time: ${lead.bestTime}`,
    `Language: ${lead.lang === 'es' ? 'Spanish' : 'English'}`,
    `Reference: ${lead.ref}`,
  ];
  if (lead.plan) {
    const a = lead.plan;
    lines.push('', 'Plan answers:',
      `  Wants to change: ${a.concerns.map((c) => LABELS.concerns[c]).join(', ') || 'n/a'}`,
      `  Areas: ${a.areas.map((c) => LABELS.areas[c]).join(', ') || 'n/a'}`,
      `  Downtime: ${LABELS.downtime[a.downtime]}`,
      `  Experience: ${LABELS.history[a.history]}`,
      `  Timing: ${LABELS.timing[a.timing]}`);
  }
  lines.push('', `Received: ${lead.receivedAt}`, `Consent to contact: yes`);
  return lines.join('\n');
}

export default async function handler(req, res) {
  const wantsJson = String(req.headers.accept || '').includes('application/json');
  const reply = (status, body) => {
    if (!wantsJson && status === 200) {
      res.statusCode = 303;
      res.setHeader('Location', `${body.lang === 'es' ? '/es/' : '/'}?sent=${encodeURIComponent(body.ref || '')}#book`);
      return res.end();
    }
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { ok: false, error: 'method' }); }

  let body;
  try { body = await readBody(req); } catch { return reply(400, { ok: false, error: 'body' }); }

  // Honeypot: bots fill the hidden "company" field. Pretend success, store nothing.
  if (clean(body.company)) return reply(200, { ok: true, ref: ref(), lang: body.lang });

  const digits = String(body.phone || '').replace(/\D/g, '');
  const phone = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  const consent = body.consent === true || body.consent === 'yes' || body.consent === 'on';
  const firstName = clean(body.firstName, 60);
  const lastName = clean(body.lastName, 60);
  if (!firstName || !lastName || phone.length !== 10 || !consent) return reply(422, { ok: false, error: 'validation' });

  const decoded = body.code ? decode(body.code) : null;
  const lead = {
    kind: body.kind === 'plan' ? 'plan' : 'callback',
    firstName, lastName, phone,
    bestTime: ['morning', 'midday', 'afternoon', 'any'].includes(body.bestTime) ? body.bestTime : 'any',
    lang: body.lang === 'es' ? 'es' : 'en',
    ref: decoded?.ok ? decoded.code : ref(),
    plan: decoded?.ok ? decoded.answers : null,
    page: clean(body.page, 120),
    receivedAt: new Date().toISOString(),
  };

  console.log('LEAD ' + JSON.stringify(lead));

  const tasks = [];
  const { RESEND_API_KEY, LEAD_EMAIL_TO, LEAD_EMAIL_FROM, LEAD_WEBHOOK_URL } = process.env;
  if (RESEND_API_KEY && LEAD_EMAIL_TO) {
    tasks.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: LEAD_EMAIL_FROM || 'Cloud9 Website <onboarding@resend.dev>',
        to: LEAD_EMAIL_TO.split(',').map((x) => x.trim()),
        subject: `Call back: ${lead.firstName} ${lead.lastName} (${lead.ref})`,
        text: summary(lead),
      }),
    }).then((r) => { if (!r.ok) throw new Error('resend ' + r.status); }));
  }
  if (LEAD_WEBHOOK_URL) {
    tasks.push(fetch(LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, summary: summary(lead) }),
    }).then((r) => { if (!r.ok) throw new Error('webhook ' + r.status); }));
  }

  if (tasks.length) {
    const results = await Promise.allSettled(tasks);
    const delivered = results.some((r) => r.status === 'fulfilled');
    results.filter((r) => r.status === 'rejected').forEach((r) => console.error('LEAD_DELIVERY_FAILED', lead.ref, String(r.reason)));
    if (!delivered) return reply(502, { ok: false, error: 'delivery', ref: lead.ref });
  }

  return reply(200, { ok: true, ref: lead.ref, lang: lead.lang });
}
