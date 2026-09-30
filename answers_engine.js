/* The playbook's done-when answers: keeping them, checking them, and turning
   each step into a control with an evidence level. Pure (no DOM); used by
   done_when.js on the playbook, by the record, and by the tests.
   Data: data/done_when.js

   Store: {v: 1, answers: {field: {value, date}}, evidence: {step: {value, date}},
           confirmed: {step: date}}
   A field is a question id, or `id.part` for a question with parts.

   Evidence levels (design 07): Recorded when the step is marked done and
   every question is answered; Supported when a note says how the owner
   knows; Confirmed when the owner re-confirmed it within confirm_days and
   nothing has changed since. The site never confirms anything by itself. */

var AnswersEngine = (function(){
  const D = DONE_WHEN;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  /* a real calendar date: some browsers read 2026-02-30 as March 2, so the
     date must come back unchanged */
  const validDate = s => { if (!ISO.test(s || '')) return false; const t = Date.parse(s + 'T00:00:00Z'); return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s; };
  const empty = () => ({v: 1, answers: {}, evidence: {}, confirmed: {}});

  /* every field, with its kind and the question it belongs to */
  const FIELDS = {};
  D.steps.forEach(s => s.questions.forEach(q => {
    if (q.parts) q.parts.forEach(p => { FIELDS[q.id + '.' + p.id] = {step: s.step, q, kind: p.kind || 'text', label: p.label}; });
    else FIELDS[q.id] = {step: s.step, q, kind: q.kind || 'text'};
  }));
  const stepOf = n => D.steps.find(s => s.step === String(n));
  const fieldsOf = q => q.parts ? q.parts.map(p => q.id + '.' + p.id) : [q.id];

  function clean1(key, value){
    const f = FIELDS[key];
    if (!f || typeof value !== 'string') return null;
    const v = value.replace(/\s+/g, ' ').trim().slice(0, D.max_length);
    if (!v) return null;
    if (f.kind === 'date' && !validDate(v)) return null;
    return v;
  }

  /* an empty value removes the answer; the date is when it last changed */
  function set(store, key, value, today){
    if (!FIELDS[key]) throw new Error('Unknown question: ' + key);
    const v = clean1(key, value);
    if (v === null){ delete store.answers[key]; return store; }
    if (!store.answers[key] || store.answers[key].value !== v) store.answers[key] = {value: v, date: today};
    return store;
  }
  function setEvidence(store, step, value, today){
    if (!stepOf(step)) throw new Error('Unknown step: ' + step);
    const v = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, D.max_length) : '';
    if (!v) delete store.evidence[step];
    else if (!store.evidence[step] || store.evidence[step].value !== v) store.evidence[step] = {value: v, date: today};
    return store;
  }
  /* only a step that's marked done and fully answered can be re-confirmed */
  function confirm(store, step, done, today){
    const c = control(store, step, done, today);
    if (!c.level) throw new Error('Mark the step done and answer every question first.');
    store.confirmed[String(step)] = today;
    return store;
  }

  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

  /* one step as a control: what's answered, what's missing, and the level */
  function control(store, step, done, today){
    const s = stepOf(step);
    if (!s) throw new Error('Unknown step: ' + step);
    const isDone = !!done && (done.has ? done.has(s.step) : done.includes(s.step));
    const answers = s.questions.map(q => {
      const vals = fieldsOf(q).map(k => store.answers[k]);
      return {id: q.id, text: q.text, record: q.record, role: q.role || null,
        value: q.parts ? q.parts.map((p, i) => vals[i] ? `${p.label}: ${vals[i].value}` : null).filter(Boolean).join('; ') : (vals[0] ? vals[0].value : ''),
        parts: q.parts ? Object.fromEntries(q.parts.map((p, i) => [p.id, vals[i] ? vals[i].value : null])) : null,
        complete: vals.every(Boolean),
        date: vals.filter(Boolean).map(v => v.date).sort().pop() || null};
    });
    const answered = answers.filter(a => a.complete).length;
    const ev = store.evidence[s.step] || null;
    const changed = [ev && ev.date].concat(answers.map(a => a.date)).filter(Boolean).sort().pop() || null;
    const conf = store.confirmed[s.step] || null;
    let level = null;
    if (isDone && answered === answers.length){
      level = ev ? 'supported' : 'recorded';
      if (conf && (!changed || changed <= conf) && daysBetween(conf, today) <= D.confirm_days) level = 'confirmed';
    }
    return {step: s.step, control: s.control, done: isDone, answers, answered, total: answers.length,
      missing: answers.filter(a => !a.complete).map(a => a.text), evidence: ev, confirmed_on: conf, changed, level};
  }
  const controls = (store, done, today) => D.steps.map(s => control(store, s.step, done, today));

  /* the answers that feed one record section, answered ones only */
  function forSection(store, section){
    const out = [];
    D.steps.forEach(s => {
      const c = control(store, s.step, [], '1970-01-01');
      c.answers.filter(a => a.record === section && a.value).forEach(a => out.push(Object.assign({step: s.step}, a)));
    });
    return out;
  }

  /* re-check everything read from storage or a file */
  function clean(raw){
    const st = empty();
    if (!raw || typeof raw !== 'object') return st;
    const date = d => validDate(d) ? d : null;
    Object.keys(raw.answers || {}).forEach(k => {
      const a = raw.answers[k], v = a && clean1(k, a.value);
      if (v !== null && v !== undefined) st.answers[k] = {value: v, date: date(a.date)};
    });
    Object.keys(raw.evidence || {}).forEach(k => {
      const e = raw.evidence[k];
      if (stepOf(k) && e && typeof e.value === 'string' && e.value.trim()) st.evidence[k] = {value: e.value.replace(/\s+/g, ' ').trim().slice(0, D.max_length), date: date(e.date)};
    });
    Object.keys(raw.confirmed || {}).forEach(k => { if (stepOf(k) && date(raw.confirmed[k])) st.confirmed[k] = raw.confirmed[k]; });
    return st;
  }

  return {empty, fields: () => Object.assign({}, FIELDS), fieldsOf, set, setEvidence, confirm, control, controls, forSection, clean};
})();
