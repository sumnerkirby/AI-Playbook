/* The risk matrix: pure functions, no DOM, so the page and the tests run
   the same code.
   Needs, loaded first: data/tool_questions.js, data/tool_rules.js,
   tool_engine.js, data/risk_matrix.js.

   Every position for a checked use is suggested from its tool-check
   answers: impact from what goes in and what it can do; likelihood from the
   factors that raise and lower it, twice: before (as if no to-dos were done
   and no standing rules existed) and now. The owner can move a position,
   with a reason, and it shows as adjusted.

   The owner's own choices live in a small store:
     {custom: [...], adjust: {id: {impact, likelihood, reason, date}},
      response: {id: {response, owner, due, review_by, accept: {by, reason}}},
      snapshots: [{date, items: [{id, label, zone, impact, likelihood}]}]} */

var RiskEngine = (function(){
  const RK = RISK, T = ToolEngine;
  const idx = l => RK.levels.indexOf(l);
  const max = (a, b) => idx(b) > idx(a) ? b : a;
  const SUPPLIER_QS = ['training', 'deletion', 'agreement', 'published'];

  function matches(cond, f){
    if (!cond) return true;
    if (cond.all) return cond.all.every(c => matches(c, f));
    if (cond.any) return cond.any.some(c => matches(c, f));
    if (cond.not) return !matches(cond.not, f);
    const v = f[cond.q];
    return Array.isArray(v) ? v.some(x => cond.in.includes(x)) : cond.in.includes(v);
  }
  const emptyStore = () => ({custom: [], adjust: {}, response: {}, snapshots: []});

  /* ---------- facts about one use ---------- */
  function facts(line, profile, phase){
    const a = T.prune(line.answers, profile);
    const r = T.evaluate(Object.assign({}, a, {_evidence: line.evidence}), profile, line.done);
    const done = phase === 'now' ? r.todos.filter(t => t.done).map(t => t.id) : [];
    const asked = SUPPLIER_QS.filter(q => a[q] !== undefined && a[q] !== 'dont_know');
    const sourced = asked.filter(q => line.evidence && line.evidence[q] && line.evidence[q].note);
    return {
      a, r, done,
      standing: phase === 'now' && r.standing.length > 0,
      f: Object.assign({}, a, {
        _team: profile && profile.team_size, _mode: a.mode, _done: done, _sourced: sourced,
        _sourced_any: sourced.length ? 'yes' : 'no', _unsourced_any: asked.length > sourced.length ? 'yes' : 'no',
      }),
    };
  }

  /* ---------- impact: the highest level any answer reaches ---------- */
  function impact(answers, type){
    const hits = RK.impact.filter(i => (!type || i.types.includes(type)) && matches(i.when, answers));
    if (!hits.length) return {level: 'low', why: [`Public information, used internally, only suggests`]};
    const level = hits.map(h => h.level).reduce(max, 'low');
    return {level, why: hits.filter(h => h.level === level).map(h => h.why)};
  }

  /* ---------- likelihood: count what raises and lowers it ---------- */
  function likelihood(line, profile, phase){
    const x = facts(line, profile, phase);
    const raises = RK.raises.filter(fct => matches(fct.when, x.f) &&
      !(phase === 'now' && ((fct.cleared_by && x.done.includes(fct.cleared_by)) || (fct.cleared_by_standing && x.standing))));
    const lowers = RK.lowers.filter(fct => matches(fct.when, x.f));
    const level = raises.length >= RK.thresholds.high_raises ? 'high'
      : !raises.length && lowers.length >= RK.thresholds.low_lowers ? 'low' : 'moderate';
    return {level, raises: raises.map(f => f.why), lowers: lowers.map(f => f.why)};
  }
  const zone = (imp, lik) => RK.zones[imp][lik];

  /* which kinds of risk a use carries */
  function types(a){
    const out = [];
    if ((a.data || []).some(d => d !== 'public')) out.push('leak');
    if ((a.output || []).some(o => o === 'customers' || o === 'person') || a.use === 'hiring' || a.safety === 'yes') out.push('wrong_output');
    if ((a.acts || []).includes('acts')) out.push('unwanted_action');
    out.push('supplier');
    if ((a.output || []).includes('person') || a.use === 'hiring') out.push('unfair');
    return out;
  }
  const typeLabel = id => (RK.types.find(t => t.id === id) || {}).label || '';

  /* ---------- the items on the matrix ---------- */
  function items(lines, profile, store, opts){
    const st = store || emptyStore();
    const out = [], stopped = [];
    (lines || []).filter(l => !l.retired_on).forEach(line => {
      const x = facts(line, profile, 'now');
      const label = `${T.name(line)} · ${T.useLabel(x.a.use)}`;
      if (x.r.light === 'red'){
        stopped.push({id: line.id, label, paused: x.a.mode === 'discovered', reasons: x.r.stops.map(s => s.reason), fix: x.r.stops.map(s => s.fix)});
        /* a new use that's red isn't being run; a discovered one still is, until it's paused */
        if (x.a.mode !== 'discovered') return;
      }
      const before = likelihood(line, profile, 'before'), now = likelihood(line, profile, 'now');
      const kinds = opts && opts.split ? types(x.a) : [null];
      kinds.forEach(type => {
        const imp = impact(x.a, type);
        const id = type ? `${line.id}:${type}` : line.id;
        out.push(finish({
          id, line: line.id, source: 'use', label, type, paused: x.r.light === 'red', red: x.r.light === 'red',
          /* what the AI list says about the same use, so the two pages can be read together */
          ai_list: x.r.label,
          impact: imp.level, before: before.level, now: now.level,
          why: {impact: imp.why, raises: now.raises, lowers: now.lowers, raises_before: before.raises},
        }, st));
      });
    });
    st.custom.forEach(c => out.push(finish({
      id: c.id, source: 'custom', label: c.title, type: c.type, paused: false, red: false,
      impact: c.impact, before: c.likelihood_before || c.likelihood, now: c.likelihood,
      why: {impact: [`Rated by you: ${RK.describe.impact[c.impact]}`], raises: [], lowers: [], control: c.control || null},
    }, st)));
    return {items: prioritize(out), stopped};
  }
  /* the owner's adjustments and responses, on top of the suggestion */
  function finish(it, st){
    it.suggested = {impact: it.impact, now: it.now};
    const adj = st.adjust[it.id];
    if (adj && it.source === 'use'){
      it.impact = adj.impact; it.now = adj.likelihood;
      it.adjusted = {reason: adj.reason, date: adj.date};
    }
    it.zone = zone(it.impact, it.now);
    it.zone_before = zone(it.impact, it.before);
    const resp = st.response[it.id] || {};
    it.response = resp.response || (it.zone === 'watch' ? null : 'mitigate');
    it.owner = resp.owner || '';
    it.due = resp.due || null;
    it.review_by = resp.review_by || (resp.accept && resp.accept.review_by) || null;
    it.accept = resp.accept || null;
    it.can_accept = !it.red;
    return it;
  }
  /* Act now, then Plan, then Watch; within a zone, the soonest date first */
  function prioritize(list){
    const date = i => i.due || i.review_by || '9999-12-31';
    return list.slice().sort((a, b) =>
      RK.zone_order.indexOf(a.zone) - RK.zone_order.indexOf(b.zone) || (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : 0) ||
      idx(b.impact) - idx(a.impact) || idx(b.now) - idx(a.now));
  }

  /* ---------- the owner's choices ---------- */
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  function adjust(store, id, impactLevel, likelihoodLevel, reason, today){
    if (!RK.levels.includes(impactLevel) || !RK.levels.includes(likelihoodLevel)) throw new Error('Choose a level for both.');
    if (!reason || !reason.trim()) throw new Error('Moving a suggested position needs a reason.');
    store.adjust[id] = {impact: impactLevel, likelihood: likelihoodLevel, reason: reason.trim().slice(0, 300), date: today};
    return store;
  }
  function clearAdjust(store, id){ delete store.adjust[id]; return store; }
  function respond(store, item, r){
    if (!RK.responses.some(x => x.id === r.response)) throw new Error('Choose a response.');
    if (r.response === 'accept'){
      if (!item.can_accept) throw new Error('A red line cannot be accepted. Stop or change the use instead.');
      if (!r.by || !r.reason || !ISO.test(r.review_by || '')) throw new Error('Accepting a risk requires the name of the person who approves it, a reason, and a review date.');
    }
    store.response[item.id] = {
      response: r.response, owner: (r.owner || '').slice(0, 80), due: ISO.test(r.due || '') ? r.due : null,
      review_by: ISO.test(r.review_by || '') ? r.review_by : null,
      accept: r.response === 'accept' ? {by: r.by.slice(0, 80), reason: r.reason.slice(0, 300), review_by: r.review_by} : null,
    };
    return store;
  }
  function addCustom(store, c, today){
    if (!c.title || !c.title.trim()) throw new Error('Describe the risk in a few words.');
    if (!RK.levels.includes(c.impact) || !RK.levels.includes(c.likelihood)) throw new Error('Rate how serious it would be, and how likely.');
    const risk = {
      id: 'r-' + today.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6),
      title: c.title.trim().slice(0, 200), type: RK.types.some(t => t.id === c.type) ? c.type : 'other',
      impact: c.impact, likelihood: c.likelihood,
      likelihood_before: RK.levels.includes(c.likelihood_before) ? c.likelihood_before : null,
      control: (c.control || '').trim().slice(0, 300) || null, added: today,
    };
    store.custom.push(risk);
    return risk;
  }
  function suggestionsFor(profile, store){
    const ind = (profile && profile.industry) || [];
    return RK.suggestions.filter(s => (s.industry === '*' || s.industry.some(i => ind.includes(i))) &&
      !store.custom.some(c => c.title === s.title));
  }

  /* ---------- snapshots: movement between reviews ---------- */
  function snapshot(list, today){
    return {date: today, items: list.map(i => ({id: i.id, label: i.label, zone: i.zone, impact: i.impact, likelihood: i.now}))};
  }
  function movement(prev, list){
    if (!prev) return null;
    const before = new Map(prev.items.map(i => [i.id, i]));
    const moved = [], added = [];
    list.forEach(i => {
      const p = before.get(i.id);
      if (!p) added.push(i.label);
      else if (p.zone !== i.zone) moved.push({label: i.label, from: p.zone, to: i.zone});
      before.delete(i.id);
    });
    const removed = [...before.values()].map(i => i.label);
    /* group "N moved from Act now to Plan" */
    const groups = {};
    moved.forEach(m => { const k = `${m.from}>${m.to}`; groups[k] = (groups[k] || 0) + 1; });
    const lines = Object.entries(groups).map(([k, n]) => {
      const [f, t] = k.split('>');
      return `${n} moved from ${RK.zone_labels[f]} to ${RK.zone_labels[t]}`;
    });
    if (added.length) lines.push(`${added.length} new`);
    if (removed.length) lines.push(`${removed.length} no longer on the matrix`);
    return {since: prev.date, moved, added, removed, summary: lines.length ? lines.join(', ') : 'No change'};
  }

  /* ---------- the register as a spreadsheet ---------- */
  function cell(v){
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(list, stopped){
    const L = l => RK.level_labels[l] || '';
    const rows = [['id', 'use or risk', 'type', 'impact', 'likelihood before', 'likelihood now', 'zone', 'why', 'response', 'owner', 'due', 'review by', 'adjusted']];
    list.forEach((i, n) => rows.push([n + 1, i.label, i.type ? typeLabel(i.type) : 'All', L(i.impact), L(i.before), L(i.now), RK.zone_labels[i.zone],
      [].concat(i.why.impact, i.why.raises.map(x => '+ ' + x), i.why.lowers.map(x => '- ' + x)).join('; '),
      i.response ? RK.responses.find(r => r.id === i.response).label : '', i.owner, i.due, i.review_by,
      i.adjusted ? `Adjusted: ${i.adjusted.reason}` : '']));
    (stopped || []).forEach(s => rows.push(['', s.label, '', '', '', '', s.paused ? 'Paused' : 'Stopped', s.reasons.join('; '), 'Stop or change the use', '', '', '', '']));
    return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  /* ---------- loading the store: keep only what's valid ---------- */
  function cleanStore(raw){
    const st = emptyStore();
    if (!raw || typeof raw !== 'object') return st;
    const lv = v => RK.levels.includes(v);
    const txt = (s, n) => typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '';
    (Array.isArray(raw.custom) ? raw.custom : []).forEach(c => {
      if (c && txt(c.title, 200) && lv(c.impact) && lv(c.likelihood)) st.custom.push({
        id: txt(c.id, 40) || 'r-' + st.custom.length, title: txt(c.title, 200), type: RK.types.some(t => t.id === c.type) ? c.type : 'other',
        impact: c.impact, likelihood: c.likelihood, likelihood_before: lv(c.likelihood_before) ? c.likelihood_before : null,
        control: txt(c.control, 300) || null, added: ISO.test(c.added || '') ? c.added : null});
    });
    Object.entries(raw.adjust || {}).forEach(([k, a]) => {
      if (a && lv(a.impact) && lv(a.likelihood) && txt(a.reason, 300)) st.adjust[txt(k, 80)] = {impact: a.impact, likelihood: a.likelihood, reason: txt(a.reason, 300), date: ISO.test(a.date || '') ? a.date : null};
    });
    Object.entries(raw.response || {}).forEach(([k, r]) => {
      if (!r || !RK.responses.some(x => x.id === r.response)) return;
      const acc = r.response === 'accept' && r.accept && txt(r.accept.by, 80) && txt(r.accept.reason, 300) && ISO.test(r.accept.review_by || '')
        ? {by: txt(r.accept.by, 80), reason: txt(r.accept.reason, 300), review_by: r.accept.review_by} : null;
      if (r.response === 'accept' && !acc) return;
      st.response[txt(k, 80)] = {response: r.response, owner: txt(r.owner, 80), due: ISO.test(r.due || '') ? r.due : null,
        review_by: ISO.test(r.review_by || '') ? r.review_by : null, accept: acc};
    });
    (Array.isArray(raw.snapshots) ? raw.snapshots : []).slice(-20).forEach(s => {
      if (s && ISO.test(s.date || '') && Array.isArray(s.items)) st.snapshots.push({date: s.date, items: s.items.filter(i => i && typeof i.id === 'string' && RK.zone_order.includes(i.zone))
        .map(i => ({id: i.id.slice(0, 80), label: txt(i.label, 200), zone: i.zone, impact: lv(i.impact) ? i.impact : null, likelihood: lv(i.likelihood) ? i.likelihood : null}))});
    });
    return st;
  }

  return {matches, emptyStore, impact, likelihood, zone, types, typeLabel, items, prioritize,
    adjust, clearAdjust, respond, addCustom, suggestionsFor, snapshot, movement, csv, cleanStore};
})();
