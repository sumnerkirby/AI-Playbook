/* The full tool check: pure functions, no DOM, so the page and the tests run
   the same code.
   Needs, loaded first: data/profile_options.js, data/questions.js (for the
   quick check's cards), data/tool_questions.js, data/tool_rules.js.

   A line on the AI list is one use of one tool:
     {id, answers, evidence: {question: {note, date}}, done: [rule ids],
      state_override, waiting: {until, note}, events: [{date, id, note}],
      retire: [bool x5], retired_on, checked, recheck_by, light,
      rules_version, profile_version}
   The light is always worked out again from the answers and today's rules;
   the stored copy is only for sorting and export. */

var ToolEngine = (function(){
  const Q = TOOL_QUESTIONS, R = TOOL_RULES;
  const CLASSES = Q.data_classes.map(c => c.id);
  const RANK = {green: 0, amber: 1, red: 2};
  const PATHS = ['none', 'use', 'configure', 'build'];

  /* ---------- dates ---------- */
  function addDays(s, n){ const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
  function addMonths(s, n){
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    t.setUTCDate(Math.min(d, new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()));
    return t.toISOString().slice(0, 10);
  }

  /* ---------- facts: the answers plus the profile ---------- */
  function pathOf(profile){
    const uses = (profile && profile.ai_use) || [];
    return uses.length ? uses.reduce((a, b) => PATHS.indexOf(b) > PATHS.indexOf(a) ? b : a) : null;
  }
  function facts(answers, profile){
    const p = profile || {};
    const records = answers.use === 'meetings' ? 'yes' : answers.records;
    return Object.assign({}, answers, {
      _industry: p.industry || [], _team: p.team_size || null, _path: pathOf(p), _mode: answers.mode, _records: records,
    });
  }
  function matches(cond, f){
    if (!cond) return true;
    if (cond.all) return cond.all.every(c => matches(c, f));
    if (cond.any) return cond.any.some(c => matches(c, f));
    if (cond.not) return !matches(cond.not, f);
    const v = f[cond.q];
    return Array.isArray(v) ? v.some(x => cond.in.includes(x)) : cond.in.includes(v);
  }

  /* ---------- questions ---------- */
  function questionText(q, profile){
    const ind = ((profile && profile.industry) || []).find(i => q.text_by_industry && q.text_by_industry[i]);
    return ind ? q.text_by_industry[ind] : q.text;
  }
  /* visible questions in order; each is judged only on answers to the
     questions before it that are themselves visible */
  function visible(answers, profile){
    const seen = {};
    const out = [];
    Q.questions.forEach(q => {
      const f = facts(seen, profile);
      f._mode = answers.mode;
      if (!matches(q.show_if, f)) return;
      const options = q.options ? q.options.filter(o => matches(o.show_if, f)) : null;
      out.push(Object.assign({}, q, {text: questionText(q, profile), options}));
      if (answers[q.id] !== undefined) seen[q.id] = answers[q.id];
    });
    return out;
  }
  const answered = (q, v) => q.kind === 'text' ? typeof v === 'string' && v.trim() !== ''
    : q.kind === 'many' ? Array.isArray(v) && v.length > 0 : v !== undefined && v !== null;
  function prune(answers, profile){
    const out = {};
    visible(answers, profile).forEach(q => {
      const v = answers[q.id];
      if (!answered(q, v)) return;
      if (q.kind === 'one' && !q.options.some(o => o.id === v)) return;
      if (q.kind === 'many'){
        const ok = v.filter(x => q.options.some(o => o.id === x));
        if (ok.length) out[q.id] = ok;
        return;
      }
      out[q.id] = v;
    });
    return out;
  }
  function nextQuestion(answers, profile){
    return visible(answers, profile).find(q => !answered(q, answers[q.id])) || null;
  }
  const complete = (answers, profile) => !nextQuestion(answers, profile);

  /* ---------- the result ---------- */
  const OWNER = {you: 'You', it: 'You or your IT provider', supplier: 'Ask your supplier', advisor: 'Ask your advisor or compliance consultant'};
  function ownerLabel(owner, profile){
    const p = profile || {};
    if (owner === 'it') return p.it_support === 'provider' ? 'Your IT provider' : p.it_support === 'internal' ? 'Whoever looks after IT' : 'You';
    if (owner === 'advisor' && (p.industry || []).includes('finance')) return 'Ask your compliance consultant';
    return OWNER[owner];
  }
  function evaluate(answers, profile, done){
    const a = prune(answers, profile);
    const f = facts(a, profile);
    const doneSet = new Set(done || []);
    const hits = R.rules.filter(r => matches(r.when, f));
    const stops = hits.filter(r => r.outcome === 'stop');
    const conds = hits.filter(r => r.outcome === 'condition');
    /* a don't-know closes only when the answer changes, never by a tick */
    const isDone = r => doneSet.has(r.id) && !r.answer;
    const open = conds.filter(r => !isDone(r));
    const light = stops.length ? 'red' : open.length ? 'amber' : 'green';

    /* what's allowed meanwhile: what every open rule allows */
    let allowed = null;
    stops.concat(open).filter(r => r.allowed).forEach(r => {
      allowed = allowed ? allowed.filter(c => r.allowed.includes(c)) : r.allowed.slice();
    });
    const used = (a.data || []).filter(c => CLASSES.includes(c));
    const limited = allowed !== null && used.some(c => !allowed.includes(c));
    const label = light === 'red' ? (a.mode === 'discovered' ? 'Pause this use' : 'Stop for this use')
      : light === 'amber' ? (limited ? 'Go for limited use' : 'Go once these are done') : 'Go';

    /* how sure: don't-knows, and supplier answers with no source */
    const vis = visible(a, profile);
    let dk = 0, n = 0, unsourced = 0;
    vis.forEach(q => {
      const v = a[q.id];
      if (v === undefined || q.kind === 'text') return;
      n++;
      if (v === 'dont_know' || (Array.isArray(v) && v.includes('dont_know'))) dk++;
      else if (q.evidence && !(answers._evidence && answers._evidence[q.id] && answers._evidence[q.id].note)) unsourced++;
    });

    return {
      light, label, limited,
      reasons: stops.concat(conds).map(r => r.id),
      stops: stops.map(r => ({id: r.id, reason: r.reason, fix: r.fix, flag: r.flag, flag_text: r.flag_text, how: r.how, owner: ownerLabel(r.owner, profile)})),
      todos: conds.map(r => ({id: r.id, reason: r.reason, text: r.fix, owner: ownerLabel(r.owner, profile), done: isDone(r), answer: r.answer || null,
        cleanup: !!r.cleanup, flag: r.flag, flag_text: r.flag_text, how: r.how, standing: r.standing || null, where_to_look: !!r.where_to_look, supplier: r.owner === 'supplier'})),
      standing: conds.filter(r => r.standing && isDone(r)).map(r => r.standing),
      allowed: allowed === null ? null : CLASSES.filter(c => allowed.includes(c)),
      allowed_notes: stops.concat(open).map(r => r.allowed_note).filter(Boolean),
      confidence: {answers: n, dont_know: dk, unsourced},
      touches_people: used.some(c => ['personal', 'sensitive', 'regulated'].includes(c)),
      can_reach: (a.acts || []).some(x => x === 'reads' || x === 'acts'),
    };
  }
  /* red: when the change happens; amber: 30 days; green: 90 days if it
     touches personal data or acts, otherwise 12 months */
  function recheckBy(result, today){
    if (result.light === 'red') return null;
    if (result.light === 'amber') return addDays(today, 30);
    return result.touches_people || result.can_reach ? addDays(today, 90) : addMonths(today, 12);
  }
  function allowedText(result){
    if (result.allowed === null) return null;
    if (!result.allowed.length) return 'Nothing, until this is sorted out.';
    const labels = result.allowed.map(c => Q.data_classes.find(x => x.id === c).label);
    const s = labels.length > 1 ? labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1] : labels[0];
    return `${s.charAt(0).toUpperCase() + s.slice(1)} only.`;
  }

  /* ---------- lines on the AI list ---------- */
  const PROFILE_VERSION = (typeof PROFILE_OPTIONS !== 'undefined' && PROFILE_OPTIONS.profile_version) || 2;
  function makeLine(answers, profile, today, extra){
    const line = Object.assign({
      id: 'c-' + today.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 7),
      answers: prune(answers, profile), evidence: answers._evidence || {}, done: [], waiting: null,
      events: [], retire: Q.retire_checklist.map(() => false), retired_on: null, paused_on: null,
    }, extra || {});
    return refresh(line, profile, today, true);
  }
  /* work the light out again: after a to-do is ticked, the rules change, or
     the profile changes */
  function refresh(line, profile, today, checkedNow){
    const withEv = Object.assign({}, line.answers, {_evidence: line.evidence});
    const r = evaluate(withEv, profile, line.done);
    const valid = new Set(r.todos.map(t => t.id));
    line.done = line.done.filter(id => valid.has(id));
    line.light = r.light;
    if (checkedNow){
      line.checked = today;
      line.rules_version = R.version;
      line.profile_version = PROFILE_VERSION;
      line.recheck_by = recheckBy(r, today);
      line.profile_snapshot = profileKey(profile);
    }
    return line;
  }
  const profileKey = p => JSON.stringify([p && p.team_size, p && p.industry, pathOf(p), p && p.it_support]);
  /* Directions for a named tool (data/tool_questions.js, where_to_look.tools):
     the first tool whose name matches, with the plan groups that fit the
     plan answer. A personal plan shows personal steps, a business or
     enterprise plan business steps, anything else both. Null when no tool
     matches. */
  const PLAN_GROUPS = {free_personal: ['personal'], paid_personal: ['personal'], business: ['business'], enterprise: ['business']};
  function vendorHelp(answers){
    const name = String((answers && answers.tool) || '').toLowerCase();
    if (!name.trim()) return null;
    const tools = Q.where_to_look.tools;
    const id = Object.keys(tools).find(k => tools[k].match.some(m => new RegExp(m, 'i').test(name)));
    if (!id) return null;
    const t = tools[id];
    const groups = t.plans.any ? ['any'] : (PLAN_GROUPS[answers.plan] || ['personal', 'business']);
    return {id, name: t.name, checked: t.checked, sources: t.sources,
      sections: groups.filter(g => t.plans[g]).map(g => ({group: g, label: t.plans[g].label, steps: t.plans[g].steps}))};
  }

  function name(line){ return line.answers.tool || 'Unnamed tool'; }
  function useLabel(id){ const o = Q.questions.find(q => q.id === 'use').options.find(x => x.id === id); return o ? o.label : ''; }

  /* found | checked (not started) | in_use | paused | retired, plus
     re-check due and waiting on supplier */
  function state(line, profile, today){
    if (line.retired_on) return {state: 'retired', label: 'Retired', due: false, why: []};
    const why = [];
    if (line.recheck_by && today > line.recheck_by) why.push('The re-check date has passed.');
    if (line.rules_version !== R.version) why.push('The guidance has changed since this was checked.');
    if (line.profile_snapshot && line.profile_snapshot !== profileKey(profile)) why.push('Your business profile has changed.');
    if (line.reopen) why.push('Something changed: ' + line.reopen + '.');
    const r = evaluate(Object.assign({}, line.answers, {_evidence: line.evidence}), profile, line.done);
    const light = r.light;
    const base = light === 'red' ? (line.answers.mode === 'discovered' ? 'paused' : 'not_started') : 'in_use';
    const labels = {paused: 'Paused', not_started: 'Not started',
      in_use: light === 'amber' ? (r.limited ? 'In limited use' : 'In use, with to-dos') : 'In use'};
    return {state: base, label: labels[base], light, due: why.length > 0, why,
      waiting: line.waiting && line.waiting.until ? line.waiting : null};
  }
  function logEvent(line, eventId, today, note){
    const e = Q.events.find(x => x.id === eventId);
    if (!e) return line;
    line.events.push({date: today, id: eventId, note: (note || '').slice(0, 200)});
    line.reopen = e.label.charAt(0).toLowerCase() + e.label.slice(1);
    return line;
  }
  /* re-check: the previous answers, ready to change */
  function reopenAnswers(line){ return Object.assign({}, line.answers, {_evidence: Object.assign({}, line.evidence)}); }
  function recheck(line, answers, profile, today){
    line.answers = prune(answers, profile);
    line.evidence = answers._evidence || line.evidence;
    line.reopen = null;
    return refresh(line, profile, today, true);
  }
  function retire(line, index, value, today){
    line.retire[index] = !!value;
    line.retired_on = line.retire.every(Boolean) ? today : null;
    return line;
  }
  /* walkthrough gap 3: another use keeps the tool, plan and supplier answers */
  const CARRY = ['mode', 'tool', 'plan', 'extension', 'training', 'deletion', 'agreement', 'published'];
  function anotherUse(line){
    const a = {};
    CARRY.forEach(k => { if (line.answers[k] !== undefined) a[k] = line.answers[k]; });
    a._evidence = {};
    ['training', 'deletion', 'agreement', 'published'].forEach(k => { if (line.evidence[k]) a._evidence[k] = line.evidence[k]; });
    return a;
  }

  /* ---------- the "to check" queue, from the quick tools ---------- */
  const CARD_USE = {writing: 'writing', summarizing: 'summarizing', meetings: 'meetings', customers: 'customers', marketing: 'marketing',
    bookkeeping: 'finance', inbox: 'scheduling', hiring: 'hiring', research: 'research', spreadsheets: 'data', website: 'coding',
    phone: 'customers', extensions: 'writing', patient_notes: 'meetings', client_planning: 'summarizing'};
  function queue(saved, lines, skipped){
    const items = [];
    const cardLabel = id => { const c = typeof QuickEngine !== 'undefined' && QuickEngine.card(id); return c ? c.label : id; };
    const q = saved.quick;
    ((q && q.finds) || []).forEach(f => items.push({
      key: 'quick:' + f.use, name: null, label: cardLabel(f.use), use: CARD_USE[f.use] || null, source: 'Quick check',
      light: f.quick_light, account: f.tags && f.tags.account, customer_info: f.tags && f.tags.customer_info, can_act: f.tags && f.tags.can_act,
      extension: f.use === 'extensions',
    }));
    const pol = saved.policy && saved.policy.a;
    ((pol && pol.tools) || []).forEach(t => items.push({
      key: 'policy:' + t.name.toLowerCase(), name: t.name, label: t.name, use: null, source: 'Your AI policy',
      light: null, account: t.account === 'business' ? 'business' : 'personal',
    }));
    const pulse = saved.pulse;
    ((pulse && pulse.checkins) || []).forEach(c => {
      (c.new_tools || []).forEach(t => items.push({key: 'pulse:' + t.name.toLowerCase(), name: t.name, label: t.name, use: CARD_USE[t.card] || null,
        source: `Monthly check-in, ${c.date}`, light: t.light, account: (t.answers || {}).account}));
      (c.connections || []).forEach(x => items.push({key: 'pulse-c:' + x.name.toLowerCase(), name: x.name, label: x.name, use: null,
        source: `Monthly check-in, ${c.date}`, light: x.light, can_act: 'yes'}));
      if (c.sweep && c.sweep.answer === 'yes') (c.sweep.found || []).forEach(n => items.push({key: 'stmt:' + n.toLowerCase(), name: n, label: n, use: null,
        source: `Card statement, ${c.date}`, light: null}));
    });
    const checked = lines.filter(l => !l.retired_on);
    const seen = new Set();
    return items.filter(i => {
      if (seen.has(i.key)) return false;
      seen.add(i.key);
      if ((skipped || []).includes(i.key)) return false;
      return !checked.some(l => (l.from === i.key) ||
        (i.name && sameTool(name(l), i.name) && (!i.use || l.answers.use === i.use)) ||
        (!i.name && i.key.startsWith('quick:') && coversFind(l, i)));
    }).map(i => Object.assign(i, {rank: rank(i)})).sort((a, b) => b.rank - a.rank);
  }
  /* The same tool, as people write it: case and punctuation don't matter, and
     one name may add whole words to the other (Microsoft Copilot, Microsoft
     Copilot Chat). Only for names typed in the quick tools. */
  function sameTool(a, b){
    const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const x = words(a), y = words(b);
    if (!x || !y) return false;
    return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');
  }
  /* A quick-check find has no tool name: a checked tool covers it when it is
     for the same job and, if the quick check noted the kind of account, on
     that kind (a personal find is not covered by a business plan). */
  const PLAN_KIND = {free_personal: 'personal', paid_personal: 'personal', business: 'business', enterprise: 'business', built_in: 'business', own: 'business'};
  function coversFind(l, i){
    if (!i.use || l.answers.use !== i.use) return false;
    if (i.account !== 'personal' && i.account !== 'business') return true;
    return PLAN_KIND[l.answers.plan] === i.account;
  }
  /* likely worst first, from the quick tags */
  function rank(i){
    const L = {stop: 6, red: 6, check: 3, amber: 3, go: 1, green: 1};
    return (L[i.light] || 2) + (i.account === 'personal' ? 3 : 0) + (i.customer_info === 'yes' ? 2 : 0)
      + (i.can_act && i.can_act !== 'no' ? 3 : 0) + (i.extension ? 1 : 0);
  }
  function fromQueue(i){
    const a = {mode: 'discovered'};
    if (i.name) a.tool = i.name;
    if (i.use) a.use = i.use;
    if (i.extension) a.extension = 'yes';
    if (i.account === 'business') a.plan = 'business';
    return a;
  }

  /* ---------- exports ---------- */
  function cell(v){
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(lines, profile, today){
    const planLabel = id => { const o = Q.questions.find(q => q.id === 'plan').options.find(x => x.id === id); return o ? o.label : ''; };
    const rows = [['tool', 'plan', 'use', 'data', 'light', 'state', 'open to-dos', 'standing rules', 'checked', 're-check by', 'rules version']];
    lines.forEach(l => {
      const r = evaluate(Object.assign({}, l.answers, {_evidence: l.evidence}), profile, l.done);
      const st = state(l, profile, today);
      rows.push([name(l), planLabel(l.answers.plan), useLabel(l.answers.use), (l.answers.data || []).join('; '), r.light,
        st.label + (st.due ? ' (re-check due)' : ''), r.todos.filter(t => !t.done).map(t => t.text).join(' | '),
        r.standing.join(' | '), l.checked, l.recheck_by || 'after the change', l.rules_version]);
    });
    return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  /* restoring a backup: keep only what's valid, and work every light out again */
  function restore(obj, profile, today){
    if (!obj || !Array.isArray(obj.lines)) throw new Error('This file is not an AI list backup.');
    let dropped = 0;
    const lines = [];
    obj.lines.forEach(raw => {
      if (!raw || typeof raw !== 'object' || !raw.answers || typeof raw.answers.tool !== 'string'){ dropped++; return; }
      const answers = Object.assign({}, raw.answers, {tool: raw.answers.tool.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120)});
      const clean = prune(answers, profile);
      if (!clean.tool){ dropped++; return; }
      const ev = {};
      Object.entries(raw.evidence || {}).forEach(([k, v]) => {
        if (['training', 'deletion', 'agreement', 'published'].includes(k) && v && typeof v.note === 'string')
          ev[k] = {note: v.note.slice(0, 300), date: /^\d{4}-\d{2}-\d{2}$/.test(v.date || '') ? v.date : null};
      });
      const iso = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null;
      const line = {
        id: typeof raw.id === 'string' ? raw.id.slice(0, 40) : 'c-restored-' + lines.length,
        answers: clean, evidence: ev,
        done: Array.isArray(raw.done) ? raw.done.filter(id => typeof id === 'string') : [],
        waiting: raw.waiting && iso(raw.waiting.until) ? {until: raw.waiting.until, note: String(raw.waiting.note || '').slice(0, 200)} : null,
        events: (Array.isArray(raw.events) ? raw.events : []).filter(e => e && iso(e.date) && Q.events.some(x => x.id === e.id)).map(e => ({date: e.date, id: e.id, note: String(e.note || '').slice(0, 200)})),
        retire: Q.retire_checklist.map((_, i) => !!(Array.isArray(raw.retire) && raw.retire[i])),
        retired_on: iso(raw.retired_on), checked: iso(raw.checked) || today, recheck_by: iso(raw.recheck_by),
        rules_version: typeof raw.rules_version === 'string' ? raw.rules_version.slice(0, 40) : 'unknown',
        profile_version: raw.profile_version, profile_snapshot: typeof raw.profile_snapshot === 'string' ? raw.profile_snapshot.slice(0, 300) : null,
        reopen: typeof raw.reopen === 'string' ? raw.reopen.slice(0, 200) : null, from: typeof raw.from === 'string' ? raw.from.slice(0, 200) : null,
      };
      lines.push(refresh(line, profile, today, false));
    });
    return {lines, dropped};
  }

  return {
    addDays, addMonths, facts, matches, questionText, visible, prune, nextQuestion, complete,
    evaluate, recheckBy, allowedText, ownerLabel,
    makeLine, refresh, state, name, useLabel, logEvent, reopenAnswers, recheck, retire, anotherUse,
    queue, fromQueue, csv, restore, vendorHelp, CLASSES,
  };
})();
