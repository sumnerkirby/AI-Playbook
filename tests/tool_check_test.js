/* Tests for the full tool check (tool_engine.js, data/tool_rules.js).
   The five worked examples come from exploratory/feature_concepts/02_tool_check.md,
   including how each result changes as things are fixed.
   Run with the other tests: tests/run_tests.sh or tests/run_tests.html. */

var ToolTestRun = (function(){
  const T = ToolEngine, R = TOOL_RULES, Q = TOOL_QUESTIONS;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'tool check: ' + name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }
  const TODAY = '2026-09-29';
  const prof = o => Object.assign({team_size: 'small', ai_use: ['use'], industry: ['other'], it_support: null}, o || {});
  const ev = (a, p, done) => T.evaluate(a, p, done);
  const allDone = (a, p) => ev(a, p).todos.map(t => t.id);
  const has = (r, id) => r.reasons.includes(id);
  /* a clean use that should be green once the team has been told */
  const CLEAN = {mode: 'new', tool: 'Gemini', plan: 'business', extension: 'no', use: 'marketing', data: ['public'], output: ['internal'], acts: ['produces_only']};

  /* ---------- data ---------- */
  test('no em dashes or en dashes in questions or rules', () => {
    ok(!/[\u2013\u2014]/.test(JSON.stringify(Q) + JSON.stringify(R)), 'found a dash');
  });
  test('every rule is complete, and names real questions and answers', () => {
    const ids = {};
    const known = {_industry: PROFILE_OPTIONS.industry.options.map(o => o.id), _team: PROFILE_OPTIONS.team_size.options.map(o => o.id),
      _path: ['none', 'use', 'configure', 'build'], _mode: ['new', 'discovered'], _records: ['yes', 'no', 'dont_know']};
    Q.questions.forEach(q => { if (q.options) known[q.id] = q.options.map(o => o.id); });
    function walk(c, id){
      if (c.all || c.any) return (c.all || c.any).forEach(x => walk(x, id));
      if (c.not) return walk(c.not, id);
      ok(known[c.q], `${id}: unknown question ${c.q}`);
      c.in.forEach(v => ok(known[c.q] && known[c.q].includes(v), `${id}: ${c.q} has no answer ${v}`));
    }
    R.rules.forEach(r => {
      ok(!ids[r.id], 'duplicate ' + r.id); ids[r.id] = 1;
      ok(['stop', 'condition'].includes(r.outcome), r.id + ': outcome');
      ok(r.reason && r.fix && r.how && r.how.href, r.id + ': reason, fix and link');
      ok(['you', 'it', 'supplier', 'advisor'].includes(r.owner), r.id + ': owner');
      (r.allowed || []).forEach(c => ok(T.CLASSES.includes(c), r.id + ': allowed class ' + c));
      walk(r.when, r.id);
    });
    Q.questions.forEach(q => q.show_if && walk(q.show_if, 'question ' + q.id));
  });

  test('every question changes something: a rule or a later question reads it', () => {
    const used = new Set();
    const walk = c => { if (c.all || c.any) return (c.all || c.any).forEach(walk); if (c.not) return walk(c.not); used.add(c.q); };
    R.rules.forEach(r => walk(r.when));
    Q.questions.forEach(q => q.show_if && walk(q.show_if));
    used.add('mode'); used.add('tool');   // read as _mode, and the name on the list
    if (used.has('_mode')) used.add('mode');
    if (used.has('_records')){ used.add('records'); used.add('use'); }
    Q.questions.forEach(q => ok(used.has(q.id), q.id + ' changes nothing'));
  });

  /* ---------- questions ---------- */
  test('questions appear only when earlier answers make them relevant', () => {
    const p = prof();
    const ids = a => T.visible(a, p).map(q => q.id);
    ok(!ids({data: ['public']}).includes('training'), 'no supplier questions for public information');
    ok(ids({data: ['internal']}).includes('training'), 'supplier questions beyond public');
    ok(!ids({data: ['internal']}).includes('agreement'), 'no agreement question for internal only');
    ok(ids({data: ['personal']}).includes('agreement'), 'agreement for personal information');
    ok(ids({acts: ['acts']}).includes('approval') && !ids({acts: ['reads']}).includes('approval'), 'approval only if it can act');
    ok(!ids({mode: 'new'}).includes('already_in') && ids({mode: 'discovered'}).includes('already_in'), 'clean-up questions only for discovered tools');
    ok(!T.visible({}, p).find(q => q.id === 'plan').options.some(o => o.id === 'own'), '"set up ourselves" hidden for the Use path');
    ok(T.visible({}, prof({ai_use: ['configure']})).find(q => q.id === 'plan').options.some(o => o.id === 'own'), 'shown for Configure');
    eq(T.visible({data: ['sensitive']}, prof({industry: ['healthcare']})).find(q => q.id === 'agreement').text,
      'Is there a business associate agreement (BAA) that covers this AI feature?', 'BAA wording for healthcare');
  });

  /* ---------- the scoring model ---------- */
  test('a clean use is green once its to-dos are done, and a solo business has none', () => {
    eq(ev(CLEAN, prof()).light, 'amber', 'team: tell the team first');
    eq(ev(CLEAN, prof(), allDone(CLEAN, prof())).light, 'green', 'then green');
    eq(ev(CLEAN, prof({team_size: 'solo'})).light, 'green', 'solo: green straight away');
  });
  test('worst answer wins: any red line makes it red, whatever else is true', () => {
    const reds = [
      {data: ['public', 'secrets']},
      {data: ['personal'], plan: 'free_personal'},
      {acts: ['acts'], approval: 'none'},
      {output: ['person'], person_decides: 'no'},
    ];
    reds.forEach(x => {
      const a = Object.assign({}, CLEAN, x);
      const r = ev(a, prof({team_size: 'solo'}), allDone(a, prof({team_size: 'solo'})));
      eq(r.light, 'red', JSON.stringify(x));
    });
  });
  test('"don\'t know" never gives green, even with every to-do ticked', () => {
    let n = 0;
    const p = prof({team_size: 'solo', industry: ['healthcare'], ai_use: ['configure']});
    const base = {mode: 'discovered', tool: 'X', plan: 'business', extension: 'no', use: 'hiring', data: ['sensitive'], special: 'no',
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', output: ['person'], person_decides: 'yes', nyc_co: 'no',
      acts: ['acts'], approval: 'all', already_in: ['nothing_sensitive']};
    T.visible(base, p).forEach(q => {
      if (!q.options || !q.options.some(o => o.id === 'dont_know')) return;
      const a = Object.assign({}, base, {[q.id]: q.kind === 'many' ? ['dont_know'] : 'dont_know'});
      if (!T.visible(a, p).some(x => x.id === q.id)) return;
      const r = ev(a, p, allDone(a, p));
      ok(r.light !== 'green', `${q.id} = don't know gave green`);
      n++;
    });
    ok(n >= 9, 'checked ' + n + ' questions');
    const dk = Object.assign({}, base, {training: 'dont_know'});
    ok(ev(dk, p, allDone(dk, p)).todos.find(t => t.id === 't.dk.training').answer === 'training', 'the to-do points back to the question');
  });
  test('what is allowed meanwhile narrows to what every open rule allows', () => {
    const a = Object.assign({}, CLEAN, {data: ['internal', 'personal'], training: 'dont_know', deletion: 'yes', agreement: 'dont_know', published: 'yes'});
    const r = ev(a, prof({team_size: 'solo'}));
    eq(r.label, 'Go for limited use', 'label');
    eq(r.allowed, ['public'], 'training unknown allows public only');
    eq(T.allowedText(r), 'Public information only.', 'in words');
  });
  test('confidence counts don\'t-knows and supplier answers with no source', () => {
    const a = Object.assign({}, CLEAN, {data: ['internal'], training: 'no_checked', deletion: 'dont_know', published: 'yes',
      _evidence: {training: {note: 'Admin console, data controls', date: TODAY}}});
    const c = ev(a, prof()).confidence;
    eq([c.dont_know, c.unsourced], [1, 1], 'one don\'t know; published has no source');
  });
  test('re-check dates: red after the change, amber 30 days, green 90 days or 12 months', () => {
    eq(T.recheckBy({light: 'red'}, TODAY), null, 'red');
    eq(T.recheckBy({light: 'amber'}, TODAY), '2026-10-29', 'amber');
    eq(T.recheckBy({light: 'green', touches_people: true}, TODAY), '2026-12-28', 'green with personal data');
    eq(T.recheckBy({light: 'green'}, TODAY), '2027-09-29', 'green otherwise');
  });
  test('owners follow the profile', () => {
    eq(T.ownerLabel('it', prof({it_support: 'provider'})), 'Your IT provider', 'IT company');
    eq(T.ownerLabel('it', prof({it_support: 'none'})), 'You', 'nobody');
    eq(T.ownerLabel('advisor', prof({industry: ['finance']})), 'Ask your compliance consultant', 'gap 2');
  });

  /* ---------- the five worked examples ---------- */
  test('example 1: staff using free ChatGPT for customer replies (small retail team)', () => {
    const p = prof({industry: ['retail']});
    const a = {mode: 'discovered', tool: 'ChatGPT', plan: 'free_personal', extension: 'no', use: 'customers', direct: 'no',
      data: ['personal'], training: 'yes', deletion: 'yes', agreement: 'no', published: 'yes', output: ['customers'], acts: ['produces_only'],
      already_in: ['personal']};
    const r = ev(a, p);
    eq([r.light, r.label], ['red', 'Pause this use'], 'red, paused');
    ok(has(r, 't.personal.personal_plan'), 'personal plan');
    eq(r.allowed, ['public'], 'allowed now: nothing with customer details');
    ok(has(r, 't.clean.chats') && has(r, 't.clean.team'), 'clean-up: delete chats, tell the team without blame');
    ok(r.stops[0].fix.includes('business plan'), 'what would change it');
    const after = Object.assign({}, a, {plan: 'business', training: 'no_checked', agreement: 'yes'});
    eq(ev(after, p).light, 'amber', 'business plan: to-dos left');
    const g = ev(after, p, allDone(after, p));
    eq(g.light, 'green', 'green when done');
    ok(g.standing.includes('A person reads AI output before it goes to a customer or the public.'), 'standing rule: read replies before sending');
  });
  test('example 2: AI notes in practice software, BAA unknown (healthcare)', () => {
    const p = prof({industry: ['healthcare']});
    const a = {mode: 'new', tool: 'Practice notes AI', plan: 'built_in', extension: 'no', use: 'meetings', data: ['sensitive'], special: 'yes',
      training: 'no_checked', deletion: 'yes', agreement: 'dont_know', published: 'yes', output: ['internal'], acts: ['produces_only']};
    const r = ev(a, p);
    eq([r.light, r.label], ['amber', 'Go for limited use'], 'limited use');
    eq(r.allowed, ['public', 'internal'], 'no patient information until the BAA is confirmed');
    ok(has(r, 't.recording.consent') && has(r, 't.retention'), 'recording consent (gap 7) and records (gap 6)');
    const yes = Object.assign({}, a, {agreement: 'yes'});
    eq(ev(yes, p, allDone(yes, p)).light, 'green', 'BAA covers it: green once done');
    eq(ev(Object.assign({}, a, {agreement: 'no'}), p).light, 'red', 'BAA does not cover it: red');
  });
  test('example 3: automation that reads invoices and schedules payment (trades, 11 to 50)', () => {
    const p = prof({team_size: 'medium', ai_use: ['use', 'configure'], industry: ['trades'], it_support: 'provider'});
    const a = {mode: 'new', tool: 'Zapier invoices', plan: 'own', extension: 'no', use: 'finance', data: ['internal'],
      training: 'no_checked', deletion: 'yes', published: 'yes', output: ['internal'], safety: 'no', acts: ['reads', 'acts'], approval: 'none',
      own_access: 'team', own_docs: 'internal', own_tested: 'yes'};
    eq(ev(a, p).light, 'red', 'pays with no approval');
    const fixed = Object.assign({}, a, {approval: 'all'});
    const r = ev(fixed, p);
    eq(r.light, 'amber', 'approval added: amber');
    ok(has(r, 't.reads') && has(r, 't.acts.log'), 'limit what it reads; log what it does');
    eq(r.todos.find(t => t.id === 't.reads').owner, 'Your IT provider', 'IT provider does it');
    eq(ev(fixed, p, allDone(fixed, p)).light, 'green', 'green when done');
  });
  test('example 4: candidate screening, recruiter decides, hires in NYC', () => {
    const p = prof({industry: ['hiring']});
    const a = {mode: 'new', tool: 'Screening add-on', plan: 'business', extension: 'no', use: 'hiring', data: ['personal'],
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', output: ['person'], person_decides: 'yes', nyc_co: 'yes', acts: ['produces_only']};
    const r = ev(a, p);
    eq(r.light, 'amber', 'amber');
    ok(r.allowed_notes.some(n => n.startsWith('Stop until advised for roles in New York City')), 'stop until advised for NYC roles');
    ok(r.todos.some(t => t.id === 't.person.nyc_co' && t.flag === 'get_advice'), 'get advice');
    eq(ev(Object.assign({}, a, {person_decides: 'no'}), p).light, 'red', 'no person deciding: red');
  });
  test('example 5: a solo consultant\'s writing extension, client work', () => {
    const p = prof({team_size: 'solo', industry: ['professional']});
    const a = {mode: 'discovered', tool: 'Writing helper', plan: 'business', extension: 'yes', use: 'writing', data: ['internal', 'regulated'],
      special: 'yes', training: 'dont_know', deletion: 'dont_know', agreement: 'dont_know', published: 'no', output: ['customers'], acts: ['produces_only'],
      already_in: ['sensitive']};
    const r = ev(a, p);
    eq(r.light, 'red', 'red for client work');
    ok(has(r, 't.confidential.may_train') && has(r, 't.extension') && has(r, 't.published.no'), 'overlay, extension, unpublished terms');
    eq(r.allowed, ['public'], 'personal and public writing only (public is all the training rule allows)');
    ok(has(r, 't.clean.advice'), 'gap 8: does this need follow-up?');
    const better = Object.assign({}, a, {training: 'no_checked', published: 'yes', deletion: 'yes', agreement: 'yes'});
    ok(ev(better, p).light !== 'red', 'a supplier with published terms and no training: no longer red');
  });

  /* ---------- the life of a checked tool ---------- */
  test('lines: states, re-checks, events, waiting and retiring', () => {
    const p = prof({team_size: 'solo'});
    const l = T.makeLine(CLEAN, p, TODAY);
    eq([l.light, l.recheck_by], ['green', '2027-09-29'], 'green line');
    eq(T.state(l, p, TODAY).label, 'In use', 'in use');
    const lim = T.makeLine(Object.assign({}, CLEAN, {data: ['internal'], training: 'dont_know', deletion: 'yes', published: 'yes'}), p, TODAY);
    eq(T.state(lim, p, TODAY).label, 'In limited use', 'limited only when something is restricted');
    eq(T.state(T.makeLine(CLEAN, prof(), TODAY), prof(), TODAY).label, 'In use, with to-dos', 'to-dos but no limits');
    ok(T.state(l, p, '2027-10-01').due, 're-check due after the date');
    ok(T.state(l, prof({team_size: 'small'}), TODAY).due, 're-check due when the profile changes');
    T.logEvent(l, 'connected', TODAY, 'Connected to shared drive');
    ok(T.state(l, p, TODAY).why.some(w => w.includes('we connected it')), 'an event reopens it');
    const again = T.reopenAnswers(l);
    eq(again.tool, 'Gemini', 'previous answers kept for the re-check');
    T.recheck(l, Object.assign(again, {acts: ['reads']}), p, TODAY);
    eq([l.light, l.reopen], ['amber', null], 're-checked with the change');
    const red = T.makeLine(Object.assign({}, CLEAN, {mode: 'discovered', data: ['personal'], plan: 'free_personal', training: 'yes', deletion: 'yes', agreement: 'no', published: 'yes', already_in: ['nothing_sensitive']}), p, TODAY);
    eq([T.state(red, p, TODAY).label, red.recheck_by], ['Paused', null], 'discovered red is paused');
    l.waiting = {until: '2026-10-15', note: 'Asked about the data agreement'};
    ok(T.state(l, p, TODAY).waiting, 'gap 5: waiting on the supplier');
    Q.retire_checklist.forEach((_, i) => T.retire(l, i, true, TODAY));
    eq(T.state(l, p, TODAY).state, 'retired', 'retired when all five are done');
    T.retire(l, 0, false, TODAY);
    eq(l.retired_on, null, 'unticking one un-retires it');
  });
  test('gap 3: another use keeps the tool, plan and supplier answers, and nothing else', () => {
    const l = T.makeLine(Object.assign({}, CLEAN, {data: ['internal'], training: 'no_checked', deletion: 'yes', published: 'yes',
      _evidence: {training: {note: 'Admin console', date: TODAY}}}), prof(), TODAY);
    const a = T.anotherUse(l);
    eq([a.tool, a.plan, a.training, a.published, a.use, a.data], ['Gemini', 'business', 'no_checked', 'yes', undefined, undefined], 'kept and cleared');
    eq(a._evidence.training.note, 'Admin console', 'evidence kept');
  });
  test('rules changing flags every line for a re-check', () => {
    const l = T.makeLine(CLEAN, prof(), TODAY);
    l.rules_version = '2026.08.0-tool';
    ok(T.state(l, prof(), TODAY).why.some(w => w.includes('guidance has changed')), 'flagged');
  });

  /* ---------- the queue ---------- */
  test('the "to check" queue: from the quick tools, worst first, nothing twice', () => {
    const saved = {
      quick: {finds: [
        {use: 'marketing', quick_light: 'go', tags: {customer_info: 'no'}},
        {use: 'writing', quick_light: 'stop', tags: {account: 'personal', customer_info: 'yes'}},
        {use: 'inbox', quick_light: 'check', tags: {can_act: 'dont_know'}},
      ]},
      policy: {a: {tools: [{name: 'Copilot', account: 'business'}, {name: 'ChatGPT', account: 'not_yet'}]}},
      pulse: {checkins: [{date: '2026-10-02', new_tools: [], connections: [{name: 'Zapier', approval: 'none', light: 'stop'}], sweep: {answer: 'yes', found: ['Otter.ai']}}]},
    };
    /* a business writing tool: it clears Copilot from the policy, but not the personal writing find */
    const lines = [T.makeLine(Object.assign({}, CLEAN, {tool: 'Copilot', use: 'writing'}), prof(), TODAY)];
    const q = T.queue(saved, lines, ['stmt:otter.ai']);
    /* rank: the quick light, plus personal account (3), customer details (2), can act (3) */
    eq(q.map(i => i.label), ['Writing emails, letters or documents', 'Zapier', 'Handling your inbox or calendar', 'ChatGPT', 'Marketing: posts, images, ads'], 'order');
    ok(!q.some(i => i.name === 'Copilot'), 'already checked');
    ok(!q.some(i => i.name === 'Otter.ai'), 'skipped');
    eq(T.fromQueue(q[0]), {mode: 'discovered', use: 'writing'}, 'pre-fill from a quick check card');
    eq(T.fromQueue(q.find(i => i.name === 'ChatGPT')), {mode: 'discovered', tool: 'ChatGPT'}, 'a not-yet tool from the policy');
  });

  test('the queue knows a tool by a longer or shorter version of its name, not by a lookalike', () => {
    const saved = {policy: {a: {tools: [{name: 'Microsoft Copilot', account: 'business'}, {name: 'chat-gpt', account: 'not_yet'}, {name: 'Copi', account: 'business'}]}}};
    const lines = [T.makeLine(Object.assign({}, CLEAN, {tool: 'Microsoft Copilot Chat'}), prof(), TODAY),
                   T.makeLine(Object.assign({}, CLEAN, {tool: 'Chat GPT'}), prof(), TODAY)];
    eq(T.queue(saved, lines, []).map(i => i.name), ['Copi'], 'Copilot Chat covers Microsoft Copilot; Chat GPT covers chat-gpt; Copi is not Copilot');
  });

  test('a quick-check find is covered by a checked tool for the same job, on the same kind of account', () => {
    const saved = {quick: {finds: [
      {use: 'writing', quick_light: 'stop', tags: {account: 'personal', customer_info: 'yes'}},
      {use: 'meetings', quick_light: 'check', tags: {account: 'business'}},
      {use: 'summarizing', quick_light: 'go', tags: {customer_info: 'no'}},
      {use: 'marketing', quick_light: 'go', tags: {customer_info: 'no'}},
    ]}};
    const line = (tool, plan, use) => T.makeLine(Object.assign({}, CLEAN, {tool, plan, use}), prof(), TODAY);
    const labels = lines => T.queue(saved, lines, []).map(i => i.use);
    eq(labels([line('Copilot', 'business', 'writing'), line('Otter', 'free_personal', 'meetings')]), ['writing', 'meetings', 'summarizing', 'marketing'],
      'a business writing tool does not cover a personal writing find, nor a personal meetings tool a business one');
    eq(labels([line('ChatGPT', 'paid_personal', 'writing'), line('Zoom', 'business', 'meetings'), line('Claude', 'free_personal', 'summarizing')]), ['marketing'],
      'same job and same kind of account covers it; with no account noted, the job is enough');
  });

  /* ---------- exports ---------- */
  test('CSV and restore: formulas defused, lights worked out again, junk dropped', () => {
    const p = prof({team_size: 'solo'});
    const l = T.makeLine(Object.assign({}, CLEAN, {tool: '=HYPERLINK("x")'}), p, TODAY);
    ok(T.csv([l], p, TODAY).includes(`"'=HYPERLINK(""x"")"`), 'formula defused');
    const tampered = JSON.parse(JSON.stringify(l));
    tampered.answers.data = ['secrets']; tampered.light = 'green';
    const r = T.restore({lines: [tampered, {answers: {}}, null, {answers: {tool: '  '}}]}, p, TODAY);
    eq([r.lines.length, r.dropped], [1, 3], 'kept one, dropped three');
    eq(r.lines[0].light, 'red', 'light worked out from the answers, not the file');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} tool check tests passed`};
})();
