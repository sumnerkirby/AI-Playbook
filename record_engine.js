/* The AI use and risk record: pure functions, no DOM, so the record page,
   the exports and the tests run the same code. It assembles one document
   from everything the site keeps, and adds nothing of its own: every line
   traces back to an answer, a tick or a saved tool.
   Needs, loaded first: every data file and engine the other pages use
   (profile, quick check, policy, pulse, tool check, risk matrix, done-when
   answers), then data/record.js.
   Design: exploratory/feature_concepts/07_ai_use_and_risk_record.md

   The record's own store keeps only what belongs to the record:
     {v: 1, business, signoff: {name, date, fingerprint},
      generations: [{n, date, snapshot}]}  (the last five copies made) */

var RecordEngine = (function(){
  const RC = RECORD, T = ToolEngine, K = RiskEngine, A = AnswersEngine, PR = ProfileEngine;
  const PE = PolicyEngine, PU = PulseEngine, QE = QuickEngine, TQ = TOOL_QUESTIONS, RK = RISK;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const iso = s => ISO.test(s || '') ? s : null;
  const txt = (s, n) => typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 200) : '';
  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m);
  const byDate = (a, b) => (a.date || '') < (b.date || '') ? 1 : (a.date || '') > (b.date || '') ? -1 : 0;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const SUPPLIER_QS = ['training', 'deletion', 'agreement', 'published'];
  const question = id => TQ.questions.find(q => q.id === id);
  const optLabel = (qid, v) => { const q = question(qid), o = q && q.options.find(x => x.id === v); return o ? o.label : ''; };
  const dataLabel = v => (TQ.data_classes.find(c => c.id === v) || {}).label || optLabel('data', v).toLowerCase();

  /* ---------- the record's own store ---------- */
  const emptyStore = () => ({v: 1, business: '', signoff: null, generations: []});
  function cleanStore(raw){
    const st = emptyStore();
    if (!raw || typeof raw !== 'object') return st;
    st.business = txt(raw.business, 120);
    const s = raw.signoff;
    if (s && txt(s.name, 120) && iso(s.date) && typeof s.fingerprint === 'string')
      st.signoff = {name: txt(s.name, 120), date: s.date, fingerprint: s.fingerprint.slice(0, 40)};
    st.generations = (Array.isArray(raw.generations) ? raw.generations : [])
      .filter(g => g && Number.isInteger(g.n) && g.n > 0 && iso(g.date) && g.snapshot && typeof g.snapshot === 'object')
      .map(g => ({n: g.n, date: g.date, snapshot: cleanSnapshot(g.snapshot)})).slice(-5);
    return st;
  }
  function cleanSnapshot(s){
    const map = (o, f) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 500).map(([k, v]) => [txt(k, 80), f(v)]).filter(([, v]) => v));
    return {
      draft: !!s.draft,
      tools: map(s.tools, v => v && txt(v.label) ? {label: txt(v.label), light: ['green', 'amber', 'red'].includes(v.light) ? v.light : null} : null),
      zones: map(s.zones, v => v && txt(v.label) && RK.zone_order.includes(v.zone) ? {label: txt(v.label), zone: v.zone} : null),
      controls: map(s.controls, v => Object.keys(RC.levels).includes(v) ? v : null),
      actions: Number.isInteger(s.actions) && s.actions >= 0 ? s.actions : 0,
    };
  }

  /* ---------- reading everything the site keeps, checked again ---------- */
  function cleanPolicy(saved, today){
    if (!saved || typeof saved !== 'object' || !saved.a || typeof saved.a !== 'object') return null;
    const raw = saved.a, a = PE.initial(iso(raw.adopted) || today, typeof raw.industry === 'string' ? raw.industry : null);
    Object.keys(a).forEach(k => {
      const v = raw[k], d = a[k];
      if (Array.isArray(d)) a[k] = Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, 200)) : d;
      else if (typeof d === 'string') a[k] = ISO.test(d) ? (iso(v) || d) : (typeof v === 'string' ? v.slice(0, 200) : d);
      else if (typeof d === 'boolean') a[k] = typeof v === 'boolean' ? v : d;
      else if (d === null) a[k] = typeof v === 'string' ? v.slice(0, 200) : null;
    });
    a.tools = (Array.isArray(raw.tools) ? raw.tools : []).filter(t => t && txt(t.name, 120))
      .map(t => ({name: txt(t.name, 120), account: typeof t.account === 'string' ? t.account.slice(0, 40) : 'personal'}));
    try { return {a, doc: PE.build(a), saved_on: iso(saved.saved_on)}; } catch (e) { return null; }
  }
  function cleanQuick(saved){
    if (!saved || typeof saved.hash !== 'string') return null;
    const state = QE.decode(saved.hash);
    if (!state) return null;
    const date = iso(saved.saved_on);
    return {state, carry: Object.assign(QE.carryOver(state, date), {hash: saved.hash}), saved_on: date};
  }

  /* raw: whatever was read from storage or a file, under these names */
  function gather(raw, today){
    raw = raw || {};
    const problems = [];
    const profile = PR.clean(raw.profile);
    const answers = A.clean(raw.answers);
    const steps = DONE_WHEN.steps.map(s => s.step);
    const done = [...new Set((Array.isArray(raw.done) ? raw.done : []).map(String).filter(s => steps.includes(s)))];
    let lines = [], skipped = [];
    if (raw.ai_list){
      try {
        lines = T.restore(raw.ai_list, profile, today).lines;
        skipped = Array.isArray(raw.ai_list.skipped) ? raw.ai_list.skipped.filter(s => typeof s === 'string').slice(0, 500) : [];
      } catch (e) { problems.push('Your AI list couldn’t be read.'); }
    }
    const policy = cleanPolicy(raw.policy, today);
    if (raw.policy && !policy) problems.push('Your saved policy couldn’t be read.');
    const quick = cleanQuick(raw.quick);
    if (raw.quick && !quick) problems.push('Your saved quick check couldn’t be read.');
    let pulse = null;
    if (raw.pulse){
      try { pulse = PU.restore(raw.pulse, {industry: profile.industry[0] || null}).log; }
      catch (e) { problems.push('Your monthly check-ins couldn’t be read.'); }
    }
    return {profile, answers, done, lines, skipped, risk: K.cleanStore(raw.risk), policy, quick, pulse, record: cleanStore(raw.record), problems};
  }

  /* ---------- one section at a time ---------- */
  const secDef = id => RC.sections.find(s => s.id === id);
  const section = (id, status, body) => Object.assign({id, n: secDef(id).n, title: secDef(id).title, status,
    empty: secDef(id).empty || null, fix: secDef(id).fix || null, appendix: !!secDef(id).appendix}, body || {});

  function evaluated(inp, today){
    return inp.lines.map(l => {
      const r = T.evaluate(Object.assign({}, l.answers, {_evidence: l.evidence}), inp.profile, l.done);
      return {line: l, r, st: T.state(l, inp.profile, today), name: T.name(l), use: T.useLabel(l.answers.use)};
    });
  }

  function responsibility(inp){
    const rows = A.forSection(inp.answers, 'responsibility').map(a => ({role: RC.roles[a.role], value: a.value, date: a.date}));
    const pol = inp.policy && inp.policy.a.team !== 'solo' && inp.policy.a.decider.trim()
      ? {text: `Named in the AI policy as the person who decides: ${inp.policy.a.decider.trim()}`} : null;
    const status = rows.length === 3 ? 'complete' : rows.length || pol ? 'partial' : 'empty';
    return section('responsibility', status, {rows, policy: pol});
  }

  function discovery(inp, ev){
    const sources = [];
    if (inp.quick){
      const c = inp.quick.carry;
      sources.push({date: inp.quick.saved_on, text: `Quick check saved: ${plural(c.finds.length, 'kind of AI use', 'kinds of AI use')} tapped, ${plural(c.screener.flags.length, 'red flag')} from the screener.`});
    }
    if (inp.pulse) PU.sorted(inp.pulse).forEach(c => {
      if (c.sweep && c.sweep.answer !== 'not_looked')
        sources.push({date: c.date, text: c.sweep.answer === 'yes' ? `Card statement checked: ${plural(c.sweep.found.length, 'AI charge')} found.` : `Card statement checked: no new AI charges.`});
      if (c.new_tools.length) sources.push({date: c.date, text: `Monthly check-in: ${plural(c.new_tools.length, 'new tool')} reported.`});
    });
    const found = ev.filter(e => e.line.answers.mode === 'discovered').length;
    if (found) sources.push({date: null, text: `${plural(found, 'use was', 'uses were')} found already in use and checked in the tool check.`});
    sources.sort(byDate);
    const answers = A.forSection(inp.answers, 'discovery');
    const queue = T.queue({quick: inp.quick && inp.quick.carry, policy: inp.policy && {a: inp.policy.a}, pulse: inp.pulse}, inp.lines, inp.skipped);
    const status = inp.quick || answers.length ? 'complete' : sources.length ? 'partial' : 'empty';
    return section('discovery', status, {sources, answers, to_check: queue.map(q => ({label: q.label, source: q.source})), limit: secDef('discovery').limit});
  }

  function aiInUse(inp, ev){
    const live = ev.filter(e => !e.line.retired_on);
    const rows = live.map(e => ({
      id: e.line.id, tool: e.name, plan: optLabel('plan', e.line.answers.plan), use: e.use,
      information: (e.line.answers.data || []).map(dataLabel).join(', '),
      light: e.r.light, light_label: e.r.label, state: e.st.label + (e.st.due ? ' (re-check due)' : ''),
      standing: e.r.standing, open: e.r.todos.filter(t => !t.done).length,
      checked: e.line.checked, recheck_by: e.line.recheck_by,
    }));
    const lights = {green: 0, amber: 0, red: 0};
    live.forEach(e => lights[e.r.light]++);
    const retired = ev.filter(e => e.line.retired_on).map(e => ({tool: e.name, use: e.use, date: e.line.retired_on}));
    return section('ai_in_use', rows.length ? 'complete' : 'empty', {rows, retired, lights});
  }

  function rules(inp, ev){
    let policy = null;
    if (inp.policy){
      const d = inp.policy.doc;
      const blocks = s => s.blocks.map(b => b.p ? {p: PE.text(b.p)} : {ul: (b.ul || b.checks).map(li => PE.text(li))});
      policy = {adopted: inp.policy.a.adopted, review: inp.policy.a.review, saved_on: inp.policy.saved_on,
        title: PE.text(d.title), sections: d.sections.map(s => ({heading: s.heading || null, blocks: blocks(s)})),
        never: d.never_sheet.items.map(i => typeof i === 'string' ? i : PE.text(i)),
        blanks: /\[[^\]]+\]/.test(PE.plain(d))};
    }
    const standing = new Map();
    ev.filter(e => !e.line.retired_on).forEach(e => e.r.standing.forEach(s => {
      if (!standing.has(s)) standing.set(s, []);
      if (!standing.get(s).includes(e.name)) standing.get(s).push(e.name);
    }));
    const answers = A.forSection(inp.answers, 'rules');
    const status = policy ? 'complete' : standing.size || answers.length ? 'partial' : 'empty';
    return section('rules', status, {policy, standing: [...standing].map(([text, tools]) => ({text, tools})), answers});
  }

  function suppliers(inp, ev){
    const groups = new Map();
    ev.filter(e => !e.line.retired_on).forEach(e => {
      const k = e.name.toLowerCase();
      if (!groups.has(k)) groups.set(k, {tool: e.name, plan: optLabel('plan', e.line.answers.plan), answers: {}});
      const g = groups.get(k);
      SUPPLIER_QS.forEach(q => {
        const v = e.line.answers[q];
        if (v === undefined || g.answers[q]) return;
        const src = e.line.evidence[q];
        g.answers[q] = {question: question(q).text, answer: optLabel(q, v), dont_know: v === 'dont_know',
          source: src && src.note ? src.note : null, date: src && src.date || null};
      });
    });
    const rows = [...groups.values()].filter(g => Object.keys(g.answers).length).map(g => Object.assign(g, {answers: SUPPLIER_QS.filter(q => g.answers[q]).map(q => g.answers[q])}));
    const public_only = [...groups.values()].filter(g => !g.answers.length).map(g => g.tool);
    const answers = A.forSection(inp.answers, 'suppliers');
    return section('suppliers', rows.length ? 'complete' : answers.length ? 'partial' : 'empty', {rows, public_only, answers});
  }

  function risk(inp){
    const {items, stopped} = K.items(inp.lines, inp.profile, inp.risk);
    const count = key => Object.fromEntries(RK.zone_order.map(z => [z, items.filter(i => i[key] === z).length]));
    const snaps = inp.risk.snapshots.slice().sort(byDate);
    const last = snaps[0] || null;
    const response = id => (RK.responses.find(r => r.id === id) || {}).label || null;
    const rows = items.map(i => ({
      label: i.label, type: i.type ? K.typeLabel(i.type) : null, source: i.source, paused: i.paused,
      impact: RK.level_labels[i.impact], before: RK.level_labels[i.before], now: RK.level_labels[i.now],
      zone: i.zone, zone_label: RK.zone_labels[i.zone], zone_before: i.zone_before,
      why: [].concat(i.why.impact, i.why.raises.map(x => 'Raises: ' + x), i.why.lowers.map(x => 'Lowers: ' + x)),
      response: response(i.response), owner: i.owner || null, due: i.due, review_by: i.review_by,
      accept: i.accept ? {by: i.accept.by, reason: i.accept.reason, review_by: i.accept.review_by || i.review_by} : null,
      adjusted: i.adjusted || null, control: i.why.control || null,
    }));
    /* the grid, as counts and names per cell */
    const grid = {};
    items.forEach(i => { const k = i.impact + ':' + i.now; (grid[k] = grid[k] || []).push(i.label); });
    return section('risk', items.length || stopped.length ? 'complete' : 'empty', {
      rows, grid, now: count('zone'), before: count('zone_before'),
      stopped: stopped.map(s => ({label: s.label, paused: s.paused, reasons: s.reasons})),
      movement: last ? {since: last.date, summary: K.movement(last, items).summary} : null,
      items,
    });
  }

  function controls(inp, today){
    const list = A.controls(inp.answers, inp.done, today).map(c => ({
      step: c.step, control: c.control, level: c.level || 'none', level_label: RC.levels[c.level || 'none'].label,
      answers: c.answers.filter(a => a.value).map(a => ({text: a.text, value: a.value})), missing: c.missing, done: c.done,
      evidence: c.evidence && c.evidence.value, confirmed_on: c.confirmed_on,
    }));
    const n = list.filter(c => c.level !== 'none').length;
    return section('controls', n === list.length ? 'complete' : n ? 'partial' : 'empty', {list, in_place: n});
  }

  function actions(inp, ev, riskSec){
    const out = [];
    const zoneOf = id => { const i = riskSec.items.find(x => x.line === id); return i ? RK.zone_labels[i.zone] : null; };
    ev.filter(e => !e.line.retired_on).forEach(e => {
      e.r.stops.forEach(s => out.push({text: s.fix, owner: s.owner, tool: `${e.name} · ${e.use}`, due: null, source: 'Tool check', risk: 'Stopped'}));
      e.r.todos.filter(t => !t.done).forEach(t => out.push({text: t.text, owner: t.owner, tool: `${e.name} · ${e.use}`,
        due: e.line.recheck_by, source: 'Tool check', risk: zoneOf(e.line.id)}));
    });
    if (inp.policy) inp.policy.doc.todos.forEach(t => out.push({text: t.text, owner: POLICY.owner_labels[t.owner] || null, tool: null, due: null, source: 'AI policy', risk: null}));
    riskSec.items.filter(i => i.source === 'custom' && i.zone !== 'watch' && i.response !== 'accept').forEach(i =>
      out.push({text: i.why.control || `Decide how to reduce this risk`, owner: i.owner || null, tool: i.label, due: i.due, source: 'Risk overview', risk: RK.zone_labels[i.zone]}));
    out.sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0);
    return section('actions', 'complete', {list: out, none: secDef('actions').none});
  }

  function incidents(inp, ev){
    const list = [];
    if (inp.pulse) PU.incidents(inp.pulse).forEach(i => list.push({date: i.date, what: i.text, source: 'Monthly check-in'}));
    ev.forEach(e => e.line.events.forEach(x => list.push({date: x.date, what: (TQ.events.find(t => t.id === x.id) || {}).label + (x.note ? `: ${x.note}` : ''),
      tool: e.name, source: 'AI list'})));
    list.sort(byDate);
    const plan = A.forSection(inp.answers, 'incidents');
    return section('incidents', list.length || plan.length ? 'complete' : 'empty', {list, plan, none: secDef('incidents').none});
  }

  function reviews(inp, today, fingerprint){
    const checkins = inp.pulse ? PU.sorted(inp.pulse).slice().reverse().slice(0, 12).map(c => ({date: c.date, summary: PU.summary(c)})) : [];
    const snaps = inp.risk.snapshots.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const snapshots = snaps.map((s, i) => ({date: s.date, items: s.items.length,
      movement: i ? K.movement(snaps[i - 1], s.items.map(x => ({id: x.id, label: x.label, zone: x.zone}))).summary : null}));
    const when = A.control(inp.answers, '9', inp.done, today).answers[0].parts;
    const changed = A.forSection(inp.answers, 'reviews').filter(a => a.id === 's9.changed').map(a => a.value)[0] || null;
    const next = when.next || (inp.policy && inp.policy.a.review) || null;
    const s = inp.record.signoff;
    const signoff = s ? {name: s.name, date: s.date, current: s.fingerprint === fingerprint} : null;
    const status = signoff && signoff.current && (when.last || checkins.length) ? 'complete' : checkins.length || when.last || snapshots.length ? 'partial' : 'empty';
    return section('reviews', status, {checkins, snapshots, last: when.last, next, changed, signoff});
  }

  function framework(ctrl){
    return section('framework', 'complete', {list: ctrl.list.map(c => ({step: c.step, control: c.control, level_label: c.level_label, sources: RC.framework[c.step] || []}))});
  }
  function industry(inp){
    const notes = PR.complete(inp.profile) ? PR.overlays(inp.profile) : [];
    return section('industry', notes.length ? 'complete' : 'empty', {notes: notes.map(o => ({label: o.label, summary: o.summary, points: o.points,
      advice: o.advice, red_line: o.red_line, last_reviewed: o.last_reviewed})), none: secDef('industry').none});
  }

  /* ---------- the whole record ---------- */
  function build(inp, today){
    const ev = evaluated(inp, today);
    const business = inp.record.business || (inp.policy && inp.policy.a.business.trim()) || RC.business_fallback;
    const riskSec = risk(inp);
    const ctrl = controls(inp, today);
    const rulesSec = rules(inp, ev);
    const s = {
      responsibility: responsibility(inp), discovery: discovery(inp, ev), ai_in_use: aiInUse(inp, ev), rules: rulesSec,
      suppliers: suppliers(inp, ev), risk: riskSec, controls: ctrl, actions: actions(inp, ev, riskSec), incidents: incidents(inp, ev),
      framework: framework(ctrl), industry: industry(inp),
      /* section 6 names the policy; its full wording is kept at the end */
      policy_text: section('policy_text', rulesSec.policy ? 'complete' : 'empty', {policy: rulesSec.policy, none: secDef('policy_text').none}),
    };
    const missing = RC.minimum.filter(id => s[id].status !== 'complete').map(id => ({n: s[id].n, title: s[id].title, fix: s[id].fix}));
    const draft = missing.length > 0;

    /* when to generate it again: the soonest of the review, a re-check, or three months */
    const dates = [T.addMonths(today, RC.stale_after_months)];
    const when = A.control(inp.answers, '9', inp.done, today).answers[0].parts;
    if (when.next) dates.push(when.next);
    ev.filter(e => !e.line.retired_on && e.line.recheck_by).forEach(e => dates.push(e.line.recheck_by));
    riskSec.items.filter(i => i.review_by).forEach(i => dates.push(i.review_by));
    const recheck_by = dates.sort()[0];

    const snapshot = snap(s, draft);
    const fingerprint = hash(JSON.stringify(snapshot));
    s.reviews = reviews(inp, today, fingerprint);

    const last = inp.record.generations[inp.record.generations.length - 1] || null;
    s.summary = section('summary', 'complete', {
      uses: s.ai_in_use.rows.length, lights: s.ai_in_use.lights, retired: s.ai_in_use.retired.length,
      zones: riskSec.now, stopped: riskSec.stopped.length, actions: s.actions.list.length,
      controls: {in_place: ctrl.in_place, total: ctrl.list.length},
      last_review: [s.reviews.last, s.reviews.checkins[0] && s.reviews.checkins[0].date].filter(Boolean).sort().pop() || null,
      to_check: s.discovery.to_check.length,
    });
    s.about = section('about', 'complete', {
      business, profile: PR.summary(inp.profile), scope: RC.scope, not_covered: RC.not_covered,
      statement: fill(RC.statement, {business}),
    });
    return {
      title: RC.title, business, today, draft, missing, recheck_by, problems: inp.problems,
      stale: recheck_by < today,
      versions: {record: RC.version, rules: TOOL_RULES.version, risk: RK.version, done_when: DONE_WHEN.version},
      last_copy: last ? {n: last.n, date: last.date} : null, next_n: last ? last.n + 1 : 1,
      changes: last ? changes(last.snapshot, snapshot) : null,
      snapshot, fingerprint,
      sections: RC.sections.map(d => s[d.id]),
    };
  }

  /* ---------- what changed since the last copy ---------- */
  function snap(s, draft){
    return {
      draft,
      tools: Object.fromEntries(s.ai_in_use.rows.map(r => [r.id, {label: `${r.tool} · ${r.use}`, light: r.light}])),
      zones: Object.fromEntries(s.risk.items.map(i => [i.id, {label: i.label, zone: i.zone}])),
      controls: Object.fromEntries(s.controls.list.map(c => [c.step, c.level])),
      actions: s.actions.list.length,
    };
  }
  const LIGHT = {green: 'Go', amber: 'Go with conditions', red: 'Stopped'};
  function changes(prev, cur){
    const out = [];
    if (prev.draft && !cur.draft) out.push('The record now has everything it needs and is no longer a draft.');
    if (!prev.draft && cur.draft) out.push('The record is a draft again: something it needs is missing.');
    Object.entries(cur.tools).forEach(([id, t]) => {
      const p = prev.tools[id];
      if (!p) out.push(`Added to the AI list: ${t.label} (${LIGHT[t.light]}).`);
      else if (p.light !== t.light) out.push(`${t.label}: ${LIGHT[p.light]} to ${LIGHT[t.light]}.`);
    });
    Object.entries(prev.tools).forEach(([id, t]) => { if (!cur.tools[id]) out.push(`No longer in use: ${t.label}.`); });
    Object.entries(cur.zones).forEach(([id, z]) => {
      const p = prev.zones[id];
      if (p && p.zone !== z.zone) out.push(`Risk moved: ${z.label}, ${RK.zone_labels[p.zone]} to ${RK.zone_labels[z.zone]}.`);
      if (!p && !cur.tools[id]) out.push(`New risk: ${z.label} (${RK.zone_labels[z.zone]}).`);
    });
    Object.entries(cur.controls).forEach(([step, lv]) => {
      const p = prev.controls[step];
      if (p && p !== lv) out.push(`Step ${step}: ${RC.levels[p].label} to ${RC.levels[lv].label}.`);
    });
    if (prev.actions !== cur.actions) out.push(`Open actions: ${prev.actions} to ${cur.actions}.`);
    return out;
  }
  /* a short, stable fingerprint, so a sign-off knows when the record changed */
  function hash(s){
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* ---------- the owner's actions on the record ---------- */
  function generate(store, model, today){
    const n = model.next_n;
    store.generations.push({n, date: today, snapshot: model.snapshot});
    store.generations = store.generations.slice(-5);
    return n;
  }
  function sign(store, name, model, today){
    const n = txt(name, 120);
    if (!n) throw new Error('Type your name to sign.');
    if (model.draft) throw new Error('A draft can’t be signed. Complete the sections listed on page 1 first.');
    store.signoff = {name: n, date: today, fingerprint: model.fingerprint};
    return store;
  }
  function stamp(model, n){
    return fill(RC.word_stamp, {date: PE.fmtDate(model.today), record_version: n || model.next_n, rules_version: model.versions.rules});
  }

  /* ---------- everything as one file, and back ---------- */
  const KINDS = ['profile', 'answers', 'done', 'ai_list', 'risk', 'policy', 'quick', 'pulse', 'record'];
  function bundle(raw, today){
    const inp = gather(raw, today);
    return {
      kind: 'ai_use_and_risk_record', version: 1, record_version: RC.version, generated: today,
      note: 'Everything this browser keeps for the AI playbook. Open it on the record page to use it in another browser.',
      data: {
        profile: inp.profile, answers: inp.answers, done: inp.done,
        ai_list: {version: 1, lines: inp.lines, skipped: inp.skipped}, risk: inp.risk,
        policy: inp.policy ? {a: inp.policy.a, saved_on: inp.policy.saved_on, policy_version: POLICY.version} : null,
        quick: inp.quick ? inp.quick.carry : null, pulse: inp.pulse, record: inp.record,
      },
    };
  }
  /* a file from bundle(): every part checked again, as if typed today */
  function unbundle(obj, today){
    if (!obj || obj.kind !== 'ai_use_and_risk_record' || !obj.data || typeof obj.data !== 'object') throw new Error('This file is not a saved AI use and risk record.');
    const back = bundle(obj.data, today).data;
    const empty = {profile: !PR.complete(back.profile) && !back.profile.team_size, answers: !Object.keys(back.answers.answers).length,
      done: !back.done.length, ai_list: !back.ai_list.lines.length, risk: !back.risk.custom.length && !Object.keys(back.risk.response).length && !back.risk.snapshots.length,
      policy: !back.policy, quick: !back.quick, pulse: !back.pulse, record: !back.record.business && !back.record.signoff && !back.record.generations.length};
    return {data: back, found: KINDS.filter(k => !empty[k])};
  }

  return {emptyStore, cleanStore, gather, build, changes, generate, sign, stamp, bundle, unbundle, KINDS};
})();
