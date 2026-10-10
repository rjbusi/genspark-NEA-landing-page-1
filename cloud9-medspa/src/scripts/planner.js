import { encode, recommend } from '../lib/plan.js';

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function initPlanner(app) {
  if (!app) return;
  const data = JSON.parse(app.querySelector('[data-planner-data]').textContent);
  const s = data.s;
  const q = (sel) => app.querySelector(sel);
  const qa = (sel) => [...app.querySelectorAll(sel)];
  const live = document.querySelector('[data-code-live]');
  const steps = qa('[data-q]');
  const next = q('[data-next]');
  const back = q('[data-back]');
  const msg = q('[data-msg]');
  const bar = q('[data-bar]');
  const label = q('[data-step-label]');
  const state = { concerns: [], areas: [], downtime: null, history: null, timing: null };
  let step = 1;

  const codeNow = () => encode({ ...state, downtime: state.downtime ?? '0', history: state.history ?? 'N', timing: state.timing ?? 'X' });
  const updateLive = () => { if (live) live.textContent = codeNow(); };

  // Option buttons: multi-select toggles, single-select radios.
  qa('[data-group]').forEach((group) => {
    const key = group.dataset.group;
    const multi = group.hasAttribute('data-multi');
    const opts = [...group.querySelectorAll('.opt')];
    if (!multi) opts.forEach((o, i) => o.tabIndex = i === 0 ? 0 : -1);
    group.addEventListener('click', (e) => {
      const o = e.target.closest('.opt');
      if (!o) return;
      const v = o.dataset.val;
      if (multi) {
        const on = o.getAttribute('aria-pressed') !== 'true';
        o.setAttribute('aria-pressed', String(on));
        state[key] = on ? [...state[key], v] : state[key].filter((x) => x !== v);
      } else {
        opts.forEach((x) => { x.setAttribute('aria-checked', String(x === o)); x.tabIndex = x === o ? 0 : -1; });
        state[key] = v;
      }
      msg.textContent = '';
      updateLive();
    });
    if (!multi) {
      group.addEventListener('keydown', (e) => {
        const i = opts.indexOf(document.activeElement);
        if (i < 0) return;
        let j = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % opts.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + opts.length) % opts.length;
        if (j !== null) { e.preventDefault(); opts[j].focus(); opts[j].click(); }
      });
    }
  });

  function go(n) {
    step = n;
    steps.forEach((el) => el.classList.toggle('on', Number(el.dataset.q) === n));
    back.hidden = n === 1;
    const last = n === steps.length;
    next.firstChild.textContent = last ? next.dataset.finishLabel : next.dataset.nextLabel;
    label.textContent = label.dataset.tpl.replace('{n}', n);
    bar.style.transform = `scaleX(${n / steps.length})`;
    msg.textContent = '';
  }

  function valid() {
    if (step === 1 && !state.concerns.length) return false;
    if (step === 3 && state.downtime == null) return false;
    if (step === 4 && (state.history == null || state.timing == null)) return false;
    return true;
  }

  next.addEventListener('click', () => {
    if (!valid()) { msg.textContent = s.pickOne; return; }
    if (step < steps.length) {
      go(step + 1);
      steps[step - 1].querySelector('legend, h3')?.setAttribute('tabindex', '-1');
      steps[step - 1].querySelector('legend, h3')?.focus({ preventScroll: true });
    } else finish();
  });
  back.addEventListener('click', () => go(Math.max(1, step - 1)));

  function art(cat) {
    const t = app.querySelector(`template[data-art="${cat}"]`);
    return t ? t.innerHTML : '';
  }

  function finish() {
    const answers = { ...state };
    const code = encode(answers);
    const r = recommend(answers, data.services);
    q('[data-picks]').innerHTML = r.picks.map(({ service, concerns }) => `
      <div class="pick">
        <span class="mini" aria-hidden="true">${art(service.cat)}</span>
        <div><strong>${esc(service.name)}</strong><small>${concerns.length ? esc(s.for) + ': ' + concerns.map((c) => esc(s.concerns[c])).join(', ') : esc(s.menuCats[service.cat])} · <span style="white-space:nowrap">${service.mins} ${esc(s.min)}</span></small></div>
        <span class="p">${esc(service.price)}</span>
      </div>`).join('');
    const club = q('[data-club]');
    const clubText = { botox: s.clubBotox, glow: s.clubGlow, luxe: s.clubLuxe }[r.club];
    club.hidden = !clubText;
    if (clubText) club.innerHTML = `<b>${esc(s.club)}: ${esc({ botox: 'Botox Club', glow: 'Glow Club', luxe: 'Luxe Club' }[r.club])}</b>${esc(clubText)}`;
    const notes = q('[data-notes]');
    notes.hidden = !r.notes.length;
    notes.innerHTML = `<b>${esc(s.notes)}</b><ul>${r.notes.map((n) => `<li>${esc(s[n])}</li>`).join('')}</ul>`;
    q('[data-code]').textContent = code;
    const form = app.querySelector('form[data-lead-form]');
    form.elements.code.value = code;
    form.dataset.answers = JSON.stringify(answers);
    qa('[data-restart]').forEach((b) => b.hidden = false);
    app.classList.add('done');
    if (live) live.textContent = code;
    const res = q('[data-result]');
    res.focus({ preventScroll: true });
    app.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  qa('[data-restart]').forEach((b) => b.addEventListener('click', () => {
    Object.assign(state, { concerns: [], areas: [], downtime: null, history: null, timing: null });
    qa('.opt').forEach((o) => { o.removeAttribute('aria-pressed'); o.removeAttribute('aria-checked'); if (o.closest('[data-multi]')) o.setAttribute('aria-pressed', 'false'); else o.setAttribute('aria-checked', 'false'); });
    app.classList.remove('done');
    const form = app.querySelector('form[data-lead-form]');
    form.reset();
    form.classList.remove('sent');
    form.querySelectorAll('.form-state').forEach((x) => x.classList.remove('show'));
    qa('[data-restart]').forEach((x) => x.hidden = x.closest('.result') ? false : true);
    go(1);
    updateLive();
    app.scrollIntoView({ block: 'start' });
  }));

  const copy = q('[data-copy]');
  copy.addEventListener('click', async () => {
    const code = q('[data-code]').textContent;
    try { await navigator.clipboard.writeText(code); } catch {
      const r = document.createRange(); r.selectNodeContents(q('[data-code]'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    const span = copy.querySelector('span');
    const prev = span.textContent;
    span.textContent = copy.dataset.copied;
    setTimeout(() => (span.textContent = prev), 1800);
  });

  go(1);
  updateLive();
}
