// Shared by the plan tool (browser), the /front-desk/ decoder and the lead function.
// Reference code format:  C9-<concerns>-<areas>-<downtime><history><timing>-<check>
// e.g. C9-LV-FE-1NE-K  means lines + volume, face + under-eyes, a day or two of
// downtime, first time, event within 4 weeks. The last letter is a checksum so a
// misheard code is caught at the front desk.

export const CONCERNS = ['L', 'V', 'T', 'S', 'A', 'D', 'H', 'R', 'W', 'I'];
export const AREAS = ['F', 'E', 'P', 'N', 'B'];
export const DOWNTIME = ['0', '1', '2'];
export const HISTORY = ['N', 'R'];
export const TIMING = ['X', 'E', 'M'];

const CHECK = 'BCDFGHJKMNPQRSTVWXYZ';

function checksum(payload) {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) sum += payload.charCodeAt(i) * (i + 1);
  return CHECK[sum % CHECK.length];
}

const order = (list, ref) => ref.filter((x) => list.includes(x));

export function encode({ concerns = [], areas = [], downtime = '0', history = 'N', timing = 'X' }) {
  const c = order(concerns, CONCERNS).join('') || '0';
  const a = order(areas, AREAS).join('') || '0';
  const payload = `C9-${c}-${a}-${downtime}${history}${timing}`;
  return `${payload}-${checksum(payload)}`;
}

export function decode(raw) {
  // Concern and area letters are disjoint sets, so the code still parses when
  // the caller's dashes are lost ("c9 lv fe 1ne k" works too).
  const flat = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = flat.match(/^C9([LVTSADHRWI]+|0)([FEPNB]+|0)([0-2])([NR])([XEM])([A-Z])$/);
  if (!m) return { ok: false, reason: 'format' };
  const [, c, a, downtime, history, timing, check] = m;
  const payload = `C9-${c}-${a}-${downtime}${history}${timing}`;
  const concerns = c === '0' ? [] : c.split('');
  const areas = a === '0' ? [] : a.split('');
  return {
    ok: true,
    checksumOk: checksum(payload) === check,
    code: `${payload}-${check}`,
    answers: { concerns, areas, downtime, history, timing },
  };
}

// Concern -> service ids, gentlest first. "deep" lists are used when the
// client accepts downtime.
const MAP = {
  L: { gentle: ['botox', 'beyond'], deep: ['botox', 'exosomes'] },
  V: { gentle: ['filler'], deep: ['filler'] },
  T: { gentle: ['c9facial', 'aquagold'], deep: ['exosomes', 'tribella'] },
  S: { gentle: ['oxygen'], deep: ['ipl', 'tribella'] },
  A: { gentle: ['acne'], deep: ['acne'] },
  D: { gentle: ['venus', 'aquagold'], deep: ['venus', 'aquagold'] },
  H: { gentle: ['laser'], deep: ['laser'] },
  R: { gentle: ['prphair'], deep: ['prphair'] },
  W: { gentle: ['weight'], deep: ['weight'] },
  I: { gentle: ['iv'], deep: ['iv'] },
};

const SKIN = ['T', 'S', 'A', 'D'];

/**
 * @param answers decoded answers
 * @param services items from content/services.json
 * @returns {{ picks: {service, concerns: string[]}[], club: 'botox'|'glow'|'luxe'|null, notes: string[] }}
 */
export function recommend(answers, services) {
  const byId = Object.fromEntries(services.map((s) => [s.id, s]));
  const { concerns, areas, downtime, history, timing } = answers;
  const allowDown = Number(downtime) > 0;
  const picks = new Map();
  const add = (id, concern) => {
    const s = byId[id];
    if (!s) return;
    if (!allowDown && s.downtime > 0 && !['filler'].includes(id)) return;
    if (!picks.has(id)) picks.set(id, { service: s, concerns: [] });
    if (concern && !picks.get(id).concerns.includes(concern)) picks.get(id).concerns.push(concern);
  };

  const notes = [];
  if (history === 'N' && concerns.some((c) => SKIN.includes(c))) {
    add('newclient', null);
    picks.get('newclient').concerns.push(...concerns.filter((c) => SKIN.includes(c)));
    notes.push('noteFirst');
  }
  for (const c of order(concerns, CONCERNS)) {
    const list = allowDown ? MAP[c].deep : MAP[c].gentle;
    // first matching option per concern, a second one only if room remains
    add(list[0], c);
  }
  for (const c of order(concerns, CONCERNS)) {
    const list = allowDown ? MAP[c].deep : MAP[c].gentle;
    if (picks.size < 4 && list[1]) add(list[1], c);
  }

  if (!allowDown && concerns.some((c) => ['T', 'S', 'L'].includes(c))) notes.push('noteDowntime0');
  const ids = [...picks.keys()];
  if (timing === 'E' && ids.includes('botox')) notes.push('noteEventTox');
  if (timing === 'E' && ids.some((id) => byId[id].downtime > 0)) notes.push('noteEventDown');
  if (concerns.includes('W')) notes.push('noteWeight');

  let club = null;
  if (concerns.includes('L')) club = 'botox';
  else if (concerns.includes('H')) club = areas.includes('B') ? 'luxe' : 'glow';
  else if (concerns.some((c) => ['T', 'S', 'D'].includes(c))) club = 'luxe';

  return { picks: [...picks.values()].slice(0, 4), club, notes };
}
