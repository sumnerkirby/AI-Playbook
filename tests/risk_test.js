/* Tests for the risk matrix (risk_engine.js, data/risk_matrix.js).
   The centrepiece is Northgate Supply Co., the worked example in
   exploratory/feature_concepts/06_risk_matrix.md: its five uses entered as
   tool-check answers, run through the suggested rules.
   Run with the other tests: tests/run_tests.sh or tests/run_tests.html. */

var RiskTestRun = (function(){
  const K = RiskEngine, T = ToolEngine, RK = RISK;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'risk: ' + name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }
  function throws(fn, what){ try { fn(); current.fails.push(what + ': expected an error'); } catch (e) {} }
  const TODAY = '2026-09-29';
  const src = note => ({note, date: TODAY});

  /* a line as the tool check would save it, with some to-dos done */
  function line(answers, profile, done){
    const l = T.makeLine(answers, profile, TODAY);
    const all = T.evaluate(Object.assign({}, l.answers, {_evidence: l.evidence}), profile, []).todos.map(t => t.id);
    l.done = done === 'all' ? all : (done || []);
    return T.refresh(l, profile, TODAY, false);
  }

  /* ---------- Northgate Supply Co.: 25 people, a distributor ---------- */
  const NG = {team_size: 'medium', ai_use: ['use', 'configure'], industry: ['trades'], it_support: 'provider'};
  const base = {mode: 'new', plan: 'business', access: ['website'], acts: ['produces_only']};
  const northgate = () => ({
    marketing: line(Object.assign({}, base, {tool: 'Copy generator', use: 'marketing', data: ['public'], output: ['customers']}), NG, 'all'),
    chatbot: line(Object.assign({}, base, {tool: 'Website chatbot', use: 'customers', direct: 'yes', records: 'no', data: ['personal'], special: 'no',
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', output: ['customers'],
      _evidence: {training: src('Vendor admin console')}}), NG, 'all'),
    invoices: line(Object.assign({}, base, {tool: 'Invoice reader', use: 'finance', data: ['sensitive'], special: 'no',
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', output: ['internal'],
      _evidence: {training: src('Contract section 4'), deletion: src('Retention settings'), agreement: src('DPA signed'), published: src('Trust page')}}), NG, 'all'),
    code: line(Object.assign({}, base, {tool: 'Code assistant', use: 'coding', data: ['internal'], special: 'no',
      training: 'no_checked', deletion: 'yes', published: 'yes', output: ['internal'],
      _evidence: {training: src('Business plan terms')}}), NG, 'all'),
    meetings: line(Object.assign({}, base, {tool: 'Meeting summarizer', use: 'meetings', data: ['internal', 'regulated'], special: 'dont_know',
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', output: ['internal'],
      _evidence: {training: src('Admin console')}}), NG, []),
  });
  const pos = (it) => [RK.level_labels[it.impact], RK.level_labels[it.before] + ' to ' + RK.level_labels[it.now], RK.zone_labels[it.zone]];

  test('Northgate: the five uses against the worked table', () => {
    const n = northgate();
    const {items} = K.items(Object.values(n), NG, K.emptyStore());
    const by = id => items.find(i => i.line === n[id].id);
    eq(pos(by('chatbot')), ['Moderate', 'High to Moderate', 'Plan'], 'website chatbot');
    eq(pos(by('invoices')), ['High', 'Moderate to Low', 'Plan'], 'invoice data extraction');
    eq(pos(by('code')), ['Moderate', 'Moderate to Low', 'Watch'], 'code assistant');
    eq(pos(by('meetings')), ['High', 'Moderate to Moderate', 'Act now'], 'meeting-notes summarizer');
    /* The design's first table said Low impact here. Its own impact rules
       make published output at least Moderate; the user chose to keep the
       rule and correct the table (2026-09-29). The zone is Watch either way. */
    eq(pos(by('marketing')), ['Moderate', 'Moderate to Low', 'Watch'], 'marketing copy generator');
  });
  test('Northgate: priority order is Act now, then Plan, then Watch', () => {
    const n = northgate();
    const {items} = K.items(Object.values(n), NG, K.emptyStore());
    eq(items.map(i => i.label.split(' · ')[0]), ['Meeting summarizer', 'Invoice reader', 'Website chatbot', 'Copy generator', 'Code assistant'], 'order');
  });
  test('Northgate: if the summarizer could act without approval, it is a red line and leaves the matrix', () => {
    const n = northgate();
    const red = line(Object.assign({}, T.reopenAnswers(n.meetings), {acts: ['reads', 'acts'], approval: 'none'}), NG, []);
    const {items, stopped} = K.items([red], NG, K.emptyStore());
    eq([items.length, stopped.length, stopped[0].paused], [0, 1, false], 'listed under Stopped, not on the grid');
  });
  test('the meeting summarizer moves to Plan once the team has been told, and a snapshot shows it', () => {
    const n = northgate();
    const store = K.emptyStore();
    const first = K.items(Object.values(n), NG, store).items;
    store.snapshots.push(K.snapshot(first, '2026-06-30'));
    n.meetings.done = ['t.team.tell'];
    const later = K.items(Object.values(n), NG, store).items;
    eq(RK.zone_labels[later.find(i => i.line === n.meetings.id).zone], 'Plan', 'now Plan');
    eq(K.movement(store.snapshots[0], later).summary, '1 moved from Act now to Plan', 'movement since June');
  });

  /* ---------- the model ---------- */
  test('zones match the design, and nothing is multiplied into a score', () => {
    eq(['high', 'moderate', 'low'].map(i => ['low', 'moderate', 'high'].map(l => RK.zone_labels[K.zone(i, l)])),
      [['Plan', 'Act now', 'Act now'], ['Watch', 'Plan', 'Act now'], ['Watch', 'Watch', 'Plan']], 'grid');
    const {items} = K.items(Object.values(northgate()), NG, K.emptyStore());
    ok(items.every(i => !Object.values(i).some(v => typeof v === 'number')), 'no numeric score on any item');
  });
  test('every condition names a real answer or fact', () => {
    const known = {_team: ['solo', 'small', 'medium', 'large'], _mode: ['new', 'discovered'], _done: TOOL_RULES.rules.map(r => r.id),
      _sourced: ['training', 'deletion', 'agreement', 'published'], _sourced_any: ['yes', 'no'], _unsourced_any: ['yes', 'no']};
    TOOL_QUESTIONS.questions.forEach(q => { if (q.options) known[q.id] = q.options.map(o => o.id); });
    const walk = (c, id) => {
      if (c.all || c.any) return (c.all || c.any).forEach(x => walk(x, id));
      if (c.not) return walk(c.not, id);
      ok(known[c.q], `${id}: unknown ${c.q}`);
      c.in.forEach(v => ok(known[c.q] && known[c.q].includes(v), `${id}: ${c.q} has no ${v}`));
    };
    RK.impact.forEach((r, i) => walk(r.when, 'impact ' + i));
    RK.raises.concat(RK.lowers).forEach(r => walk(r.when, r.id));
    ok(!/[\u2013\u2014]/.test(JSON.stringify(RK)), 'no em or en dashes');
  });
  test('likelihood: two raising factors make it High; Low needs none raising and two lowering', () => {
    const P = {team_size: 'solo', ai_use: ['use'], industry: ['other']};
    const l = line({mode: 'new', tool: 'X', plan: 'free_personal', access: ['extension'], use: 'writing', data: ['internal'], output: ['internal'], acts: ['produces_only']}, P, []);
    eq(K.likelihood(l, P, 'now').level, 'high', 'personal plan with internal information, and a browser add-on');
    const plain = line({mode: 'new', tool: 'ChatGPT', plan: 'business', access: ['website'], use: 'writing', data: ['public'], output: ['internal'], acts: ['produces_only']}, P, []);
    eq(K.likelihood(plain, P, 'now').lowers, ['Nothing personal or confidential goes in'], 'one lowering factor is not enough');
    eq(K.likelihood(plain, P, 'now').level, 'moderate', 'so it stays Moderate');
  });
  test('Dana: public writing on ChatGPT Plus reaches Low, because nothing private goes in', () => {
    /* Calibrated with the user (2026-09-29): a personal account only raises
       likelihood when something private goes in, and nothing personal or
       confidential going in lowers it. Walkthrough, 1:35 to 1:45. */
    const P = {team_size: 'solo', ai_use: ['use'], industry: ['finance']};
    const dana = line({mode: 'discovered', tool: 'ChatGPT', plan: 'paid_personal', access: ['website'], use: 'writing', data: ['public'],
      output: ['customers'], acts: ['produces_only']}, P, 'all');
    const it = K.items([dana], P, K.emptyStore()).items[0];
    eq(pos(it), ['Moderate', 'Moderate to Low', 'Watch'], 'Dana\'s public writing');
    eq(K.likelihood(dana, P, 'now').lowers, ['A person checks output before it leaves', 'Nothing personal or confidential goes in'], 'why');
    const clients = line(Object.assign({}, T.reopenAnswers(dana), {data: ['public', 'personal']}), P, []);
    ok(K.likelihood(clients, P, 'before').raises.includes('Personal or free account, and something private goes in'), 'a client name in the mix brings the personal account back');
    ok(!K.likelihood(clients, P, 'now').lowers.includes('Nothing personal or confidential goes in'), 'and removes the lowering factor');
  });
  test('impact: controls don\'t lower it; changing what goes in does', () => {
    eq(K.impact({data: ['sensitive'], acts: ['produces_only']}).level, 'high', 'sensitive');
    eq(K.impact({data: ['public'], output: ['internal'], acts: ['produces_only']}).level, 'low', 'public, internal, suggestions');
    eq(K.impact({data: ['public'], acts: ['acts']}).level, 'high', 'can act');
    eq(K.impact({data: ['sensitive'], acts: ['acts']}, 'unwanted_action').level, 'high', 'by type');
    eq(K.impact({data: ['sensitive'], acts: ['produces_only']}, 'unwanted_action').level, 'low', 'a type that does not apply');
  });
  test('split by type: each use appears once per kind of risk that applies', () => {
    const n = northgate();
    const {items} = K.items([n.invoices, n.chatbot], NG, K.emptyStore(), {split: true});
    eq(items.filter(i => i.line === n.invoices.id).map(i => i.type).sort(), ['leak', 'supplier'], 'invoices');
    eq(items.filter(i => i.line === n.chatbot.id).map(i => i.type).sort(), ['leak', 'supplier', 'wrong_output'], 'chatbot');
  });
  test('a discovered use that crossed a red line is a hollow marker and listed as paused', () => {
    const P = {team_size: 'solo', ai_use: ['use'], industry: ['retail']};
    const l = line({mode: 'discovered', tool: 'ChatGPT', plan: 'free_personal', access: ['website'], use: 'customers', direct: 'no', data: ['personal'],
      training: 'yes', deletion: 'yes', agreement: 'no', published: 'yes', output: ['customers'], acts: ['produces_only'], already_in: ['personal']}, P, []);
    const {items, stopped} = K.items([l], P, K.emptyStore());
    eq([items.length, items[0].paused, stopped[0].paused], [1, true, true], 'paused');
    throws(() => K.respond(K.emptyStore(), items[0], {response: 'accept', by: 'Me', reason: 'x', review_by: '2026-12-01'}), 'a red line can\'t be accepted');
  });

  /* ---------- the owner's choices ---------- */
  test('moving a position needs a reason, and shows as adjusted', () => {
    const n = northgate(), store = K.emptyStore();
    throws(() => K.adjust(store, n.code.id, 'low', 'low', '  ', TODAY), 'no reason');
    K.adjust(store, n.code.id, 'low', 'low', 'No client code goes in: only our own website', TODAY);
    const it = K.items([n.code], NG, store).items[0];
    eq([it.impact, it.now, it.suggested.impact, !!it.adjusted], ['low', 'low', 'moderate', true], 'adjusted, suggestion kept');
  });
  test('responses: reduce by default for Act now and Plan; living with it needs a sign-off', () => {
    const n = northgate(), store = K.emptyStore();
    const its = K.items(Object.values(n), NG, store).items;
    eq(its.map(i => i.response), ['mitigate', 'mitigate', 'mitigate', null, null], 'defaults');
    throws(() => K.respond(store, its[4], {response: 'accept'}), 'no sign-off');
    K.respond(store, its[4], {response: 'accept', by: 'Operations lead', reason: 'Public copy only', review_by: '2026-12-29'});
    eq(K.items(Object.values(n), NG, store).items.find(i => i.id === its[4].id).accept.by, 'Operations lead', 'recorded');
  });
  test('a business-wide risk: Dana\'s client impersonation lands in Act now', () => {
    const store = K.emptyStore();
    const s = K.suggestionsFor({industry: ['finance']}, store);
    ok(s.some(x => x.id === 'client_money'), 'suggested for finance');
    ok(!K.suggestionsFor({industry: ['retail']}, store).some(x => x.id === 'client_money'), 'not for retail');
    const pick = s.find(x => x.id === 'client_money');
    K.addCustom(store, {title: pick.title, type: pick.type, impact: 'high', likelihood: 'moderate', control: pick.control}, TODAY);
    const it = K.items([], {industry: ['finance']}, store).items[0];
    eq(RK.zone_labels[it.zone], 'Act now', 'zone');
    ok(!K.suggestionsFor({industry: ['finance']}, store).some(x => x.id === 'client_money'), 'not suggested twice');
    throws(() => K.addCustom(store, {title: 'x', impact: 'huge', likelihood: 'low'}, TODAY), 'levels checked');
  });

  /* ---------- exports and loading ---------- */
  test('CSV: one row per item and per stopped use, formulas defused', () => {
    const store = K.emptyStore();
    K.addCustom(store, {title: '=cmd|x', impact: 'low', likelihood: 'low'}, TODAY);
    const rows = K.csv(K.items([], NG, store).items, [{label: 'Stopped tool', paused: false, reasons: ['r']}]).trim().split('\r\n');
    eq(rows.length, 3, 'header, item, stopped');
    ok(rows[1].includes(",'=cmd|x,"), 'formula defused: ' + rows[1]);
  });
  test('loading the store keeps only what is valid', () => {
    const st = K.cleanStore({custom: [{title: 'Ok', impact: 'high', likelihood: 'low'}, {title: '', impact: 'high', likelihood: 'low'}, {title: 'Bad', impact: 'x', likelihood: 'low'}],
      adjust: {a: {impact: 'low', likelihood: 'low', reason: ''}, b: {impact: 'low', likelihood: 'low', reason: 'fine'}},
      response: {c: {response: 'accept'}, d: {response: 'avoid'}}, snapshots: [{date: 'soon', items: []}]});
    eq([st.custom.length, Object.keys(st.adjust), Object.keys(st.response), st.snapshots.length], [1, ['b'], ['d'], 0], 'cleaned');
  });

  /* ---------- FIXES 1.3: a business plan is not enough on its own ---------- */
  test('a business plan with training off never lowers the impact of patient, CUI or client-confidential information', () => {
    const cases = [
      [{team_size: 'small', ai_use: ['use'], industry: ['healthcare']}, {data: ['sensitive'], special: 'yes'}],
      [NG, {data: ['regulated'], special: 'dont_know'}],   // CUI marked Yes is a red line, so the use is stopped, not placed
      [{team_size: 'small', ai_use: ['use'], industry: ['professional']}, {data: ['regulated'], special: 'yes'}],
    ];
    cases.forEach(([p, extra]) => {
      const a = Object.assign({}, base, {tool: 'X', use: 'writing', output: ['internal'], deletion: 'yes', agreement: 'yes', published: 'yes'}, extra);
      const business = line(Object.assign({}, a, {training: 'no_checked', _evidence: {training: src('Admin console')}}), p, []);
      const bi = K.items([business], p, K.emptyStore(), {split: false}).items[0];
      ok(bi && bi.impact === 'high', `${p.industry}: impact stays High on a business plan (got ${bi && bi.impact})`);
      ok(bi && bi.why.lowers.includes('Business plan, training off, with a source noted'), `${p.industry}: the factor still counts for likelihood`);
    });
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} risk tests passed`};
})();
