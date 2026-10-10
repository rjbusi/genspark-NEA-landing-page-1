// Call-back forms (standalone and inside the plan result). Without JS the form
// still posts to /api/lead and the function redirects back with a thank-you.

const digits = (v) => String(v || '').replace(/\D/g, '');
export const normalisePhone = (v) => {
  const d = digits(v);
  if (d.length === 10) return d;
  if (d.length === 11 && d[0] === '1') return d.slice(1);
  return null;
};
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

function setErr(field, text) {
  if (!field) return;
  if (text) field.setAttribute('data-invalid', ''); else field.removeAttribute('data-invalid');
  const err = field.querySelector('.err');
  if (err) err.textContent = text || '';
  const input = field.querySelector('input, select');
  if (input) input.setAttribute('aria-invalid', text ? 'true' : 'false');
}

export function initForms() {
  document.querySelectorAll('form[data-lead-form]').forEach((form) => {
    const d = form.dataset;
    const ok = form.querySelector('.form-state.ok');
    const bad = form.querySelector('.form-state.bad');
    const btn = form.querySelector('button[type="submit"]');
    const fieldOf = (name) => form.elements[name]?.closest('.field, .check');

    form.addEventListener('input', (e) => {
      const f = e.target.closest('.field, .check');
      if (f?.hasAttribute('data-invalid')) setErr(f, '');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      bad.classList.remove('show');
      const el = form.elements;
      let first = null;
      const check = (name, cond, text) => {
        const f = fieldOf(name);
        if (!cond) { setErr(f, text); first ??= el[name]; } else setErr(f, '');
      };
      check('firstName', el.firstName.value.trim().length > 0, d.msgRequired);
      check('lastName', el.lastName.value.trim().length > 0, d.msgRequired);
      const phone = normalisePhone(el.phone.value);
      check('phone', !!phone, el.phone.value.trim() ? d.msgPhone : d.msgRequired);
      check('consent', el.consent.checked, d.msgConsent);
      if (first) { first.focus(); return; }

      const payload = {
        kind: el.kind.value,
        lang: el.lang.value,
        code: el.code.value || '',
        firstName: el.firstName.value.trim(),
        lastName: el.lastName.value.trim(),
        phone,
        bestTime: el.bestTime.value,
        consent: el.consent.checked,
        company: el.company.value,
        answers: form.dataset.answers ? JSON.parse(form.dataset.answers) : undefined,
        page: location.pathname,
      };
      const label = btn.firstChild.textContent;
      btn.disabled = true;
      btn.firstChild.textContent = d.sending;
      try {
        const res = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || res.status);
        const code = payload.code || json.ref;
        ok.innerHTML = `<h4></h4><p></p>`;
        ok.querySelector('h4').textContent = fill(d.okH, { name: payload.firstName });
        ok.querySelector('p').textContent = fill(d.okP, { code });
        ok.classList.add('show');
        form.classList.add('sent');
        ok.focus();
      } catch (err) {
        bad.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.firstChild.textContent = label;
      }
    });
  });

  // No-JS fallback lands back here with ?sent=REF
  const sent = new URLSearchParams(location.search).get('sent');
  if (sent) {
    const form = document.getElementById('callback-form');
    const ok = form?.querySelector('.form-state.ok');
    if (ok) {
      ok.innerHTML = `<h4></h4><p></p>`;
      ok.querySelector('h4').textContent = form.dataset.okH.replace('{name}', '').replace(/,\s*\./, '.').replace(/\s+\./, '.');
      ok.querySelector('p').textContent = form.dataset.okP.replace('{code}', sent);
      ok.classList.add('show');
      form.classList.add('sent');
    }
  }
}
