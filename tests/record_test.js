/* Tests for the AI use and risk record (record_engine.js, data/record.js).
   The centrepiece is Dana, the solo financial adviser from
   exploratory/walkthroughs/solo_financial_adviser.md: her saved profile,
   quick check, policy, AI list, risk overview, answers and check-ins,
   stored the way the pages store them, assembled into one record.
   Run with the other tests: tests/run_tests.sh or tests/run_tests.html. */

var RecordTestRun = (function(){
  const R = RecordEngine, T = ToolEngine, K = RiskEngine, A = AnswersEngine, PE = PolicyEngine, PU = PulseEngine;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'record: ' + name, fails: []};
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
  const clone = o => JSON.parse(JSON.stringify(o));
  const sec = (m, id) => m.sections.find(s => s.id === id);
  const record = (raw, today) => R.build(R.gather(raw, today || TODAY), today || TODAY);

  /* ---------- Dana, stored the way the pages store things ---------- */
  const P = {profile_version: 2, team_size: 'solo', ai_use: ['use'], industry: ['finance'], finance_subtype: 'advice', registration: 'state', it_support: null};
  function line(answers, done){
    const l = T.makeLine(answers, P, '2026-09-28');
    const all = T.evaluate(Object.assign({}, l.answers, {_evidence: l.evidence}), P, []).todos.map(t => t.id);
    l.done = done === 'all' ? all : (done || []);
    return T.refresh(l, P, '2026-09-28', false);
  }
  function dana(){
    const copilot = line({mode: 'new', tool: 'Microsoft Copilot Chat', plan: 'business', extension: 'no', use: 'writing', data: ['personal', 'regulated'], special: 'no',
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', output: ['customers'], acts: ['produces_only'],
      _evidence: {training: {note: 'Checked in the admin center', date: '2026-09-28'}}}, 'all');
    const chatgpt = line({mode: 'discovered', tool: 'ChatGPT', plan: 'paid_personal', extension: 'no', use: 'writing', data: ['public'],
      output: ['customers'], acts: ['produces_only']}, 'all');
    const a = PE.initial('2026-09-28', 'finance');
    Object.assign(a, {team: 'solo', business: 'Reyes Financial Planning',
      tools: [{name: 'ChatGPT', account: 'not_yet'}, {name: 'Microsoft Copilot', account: 'business'}],
      people_info: 'approved', decisions: 'no', acts: 'not_sure', telling: ['agreements'], recording: 'yes'});
    const answers = A.empty();
    A.set(answers, 's1.decides', 'Dana Reyes, owner', '2026-09-28');
    A.set(answers, 's1.ask', 'Dana', '2026-09-28');
    A.set(answers, 's1.saturday', 'Dana, 555 0100', '2026-09-28');
    A.set(answers, 's8.pasted', 'Delete the chat, then tell the client', '2026-09-28');
    const risk = K.emptyStore();
    K.addCustom(risk, {title: 'Someone impersonates a client (voice or email) to request a money movement', type: 'used_against',
      impact: 'high', likelihood: 'moderate', control: 'Confirm any request to move money by calling the client back on the number already on file.'}, '2026-09-28');
    const pulse = PU.emptyLog();
    pulse.checkins.push(Object.assign(PU.newCheckin('2026-09-28'), {incidents: [{text: 'Client name pasted into ChatGPT; chat deleted'}]}));
    return {
      profile: P, answers, done: ['1'],
      ai_list: {version: 1, lines: [copilot, chatgpt], skipped: []},
      risk, policy: {a, saved_on: '2026-09-28', policy_version: POLICY.version},
      quick: {hash: 'v=1&i=fi&a=1y2n3u4n5n6y7y&b=wr-dsap.mt-tndcab.mk-dn', saved_on: '2026-09-27'},
      pulse, record: R.emptyStore(),
    };
  }

  /* ---------- the data ---------- */
  test('wording: no dashes, known placeholders, every section in order', () => {
    ok(!/[–—]/.test(JSON.stringify(RECORD)), 'no em or en dashes');
    const s = JSON.stringify(RECORD);
    (s.match(/\{\w+\}/g) || []).forEach(p => ok(['{business}', '{date}', '{record_version}', '{rules_version}'].includes(p), 'unknown placeholder ' + p));
    eq(RECORD.sections.map(x => x.n), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'A', 'B', 'C'], 'numbering');
    RECORD.minimum.forEach(id => ok(RECORD.sections.find(x => x.id === id).fix, id + ' says how to fix it'));
  });
  test('appendix A lists exactly the sources each playbook step quotes', () => {
    if (typeof readFile !== 'function'){ current.skipped = 'terminal only'; return; }
    const page = readFile('playbook.html');
    page.split(/<article class="item" id="step-/).slice(1).forEach(a => {
      const n = /data-step="(\d+)"/.exec(a)[1];
      const cites = [...new Set((a.match(/<figcaption><span>[\s\S]*?<\/span>/g) || []).map(c => c.replace(/<[^>]+>/g, '').replace(/ &middot; /, ': ')))];
      eq(RECORD.framework[n], cites, 'step ' + n);
    });
  });

  /* ---------- an empty browser ---------- */
  test('with nothing saved: a draft that lists what is missing and claims nothing', () => {
    const m = record({});
    eq([m.draft, m.missing.map(x => x.n)], [true, ['3', '4', '5', '6']], 'draft, and the four minimum sections');
    eq(m.sections.map(s => s.n), RECORD.sections.map(s => s.n), 'every section is present, even empty');
    eq(sec(m, 'controls').list.map(c => c.level), Array(9).fill('none'), 'no control claimed');
    ok(sec(m, 'about').statement.startsWith('This record is a self-assessment'), 'self-attested on page 1');
    ok(sec(m, 'about').statement.includes('This business is responsible'), 'fallback name');
    eq([sec(m, 'summary').uses, sec(m, 'summary').actions, m.problems], [0, 0, []], 'nothing counted');
  });

  /* ---------- Dana ---------- */
  test('Dana: the record is complete enough to leave draft', () => {
    const m = record(dana());
    eq([m.draft, m.business], [false, 'Reyes Financial Planning'], 'not a draft; name from the policy');
    eq(sec(m, 'responsibility').rows.map(r => [r.role, r.value]), [['Decides on new AI tools', 'Dana Reyes, owner'], ['Whom to ask if unsure', 'Dana'], ['Out of hours', 'Dana, 555 0100']], 'responsibility');
    eq(sec(m, 'ai_in_use').rows.map(r => [r.tool, r.light]), [['Microsoft Copilot Chat', 'green'], ['ChatGPT', 'green']], 'AI in use');
    ok(sec(m, 'about').statement.includes('Reyes Financial Planning is responsible for its accuracy'), 'responsibility for accuracy');
    ok(sec(m, 'rules').policy.sections.length > 3 && sec(m, 'rules').policy.never.length > 3, 'the policy, quoted');
    eq(sec(m, 'policy_text').policy, sec(m, 'rules').policy, 'the full wording is kept in Appendix C');
    eq(sec(m, 'policy_text').appendix, true, 'as an appendix');
  });
  test('Dana: every claim traces back to something recorded', () => {
    const m = record(dana());
    const sup = sec(m, 'suppliers');
    eq(sup.rows.map(r => r.tool), ['Microsoft Copilot Chat'], 'only a tool with supplier answers');
    eq(sup.rows[0].answers.map(a => [a.answer, a.source]), [['No, and we have checked the setting or the terms', 'Checked in the admin center'], ['Yes', null], ['Yes', null], ['Yes', null]], 'sources only where one was noted');
    eq(sup.public_only, ['ChatGPT'], 'public information only: no supplier questions asked');
    const c = sec(m, 'controls').list;
    eq([c[0].level, c[7].level, c[7].answers.length], ['recorded', 'none', 1], 'step 1 recorded; step 8 answered but not marked done');
    eq(sec(m, 'discovery').sources[0].text, 'Quick check saved: 3 kinds of AI use selected, 4 red flags from the screener.', 'discovery source');
    ok(sec(m, 'discovery').limit.includes('No full discovery sweep'), 'the limit is stated');
  });
  test('Dana: risks, open actions and incidents', () => {
    const m = record(dana());
    const r = sec(m, 'risk');
    eq(r.rows.map(x => [x.label.split(' · ')[0], x.zone_label]), [['Someone impersonates a client (voice or email) to request a money movement', 'Act now'],
      ['Microsoft Copilot Chat', 'Plan'], ['ChatGPT', 'Watch']], 'register in priority order');
    const acts = sec(m, 'actions').list;
    ok(acts.some(x => x.source === 'Risk overview' && x.text.startsWith('Confirm any request to move money')), 'the business-wide risk has an action');
    ok(acts.filter(x => x.source === 'AI policy').length === PE.build(dana().policy.a).todos.length, 'policy to-dos carried');
    ok(acts.filter(x => x.source === 'AI policy').every(x => Object.values(POLICY.owner_labels).includes(x.owner)), 'owners as the owner reads them');
    eq(sec(m, 'incidents').list.map(i => [i.date, i.what]), [['2026-09-28', 'Client name pasted into ChatGPT; chat deleted']], 'incident from the check-in');
    eq(sec(m, 'incidents').plan.map(p => p.value), ['Delete the chat, then tell the client'], 'the plan from step 8');
  });

  /* ---------- the minimum ---------- */
  test('each minimum section, missing on its own, makes it a draft again', () => {
    const cases = {
      '3': d => { A.set(d.answers, 's1.saturday', '', TODAY); },
      '4': d => { d.quick = null; },
      '5': d => { d.ai_list = null; },
      '6': d => { d.policy = null; },
    };
    Object.entries(cases).forEach(([n, change]) => {
      const d = dana(); change(d);
      const m = record(d);
      eq([m.draft, m.missing.map(x => x.n)], [true, [n]], 'without section ' + n);
    });
  });
  test('discovery: a quick check or a step 2 answer counts; a check-in sweep alone does not', () => {
    const d = dana(); d.quick = null;
    A.set(d.answers, 's2.count', 'Three: ChatGPT (personal), Copilot, Grammarly', TODAY);
    eq(sec(record(d), 'discovery').status, 'complete', 'step 2 answer');
    const e = dana(); e.quick = null;
    e.pulse.checkins.push(Object.assign(PU.newCheckin('2026-10-02'), {sweep: {answer: 'yes', found: ['Otter.ai']}}));
    const m = record(e, '2026-10-02');
    eq([sec(m, 'discovery').status, m.draft], ['partial', true], 'statement sweep only');
    ok(sec(m, 'discovery').to_check.some(q => q.label === 'Otter.ai'), 'the find waits in the queue');
  });

  /* ---------- copies, changes and sign-off ---------- */
  test('what changed since the last copy', () => {
    const d = dana(); d.policy = null;
    const store = d.record;
    const first = record(d);
    eq([first.next_n, first.changes], [1, null], 'no copy yet');
    R.generate(store, first, TODAY);
    const e = Object.assign(dana(), {record: store});
    e.ai_list.lines.push(line({mode: 'new', tool: 'Otter.ai', plan: 'free_personal', extension: 'no', use: 'meetings', records: 'yes', data: ['personal'],
      output: ['internal'], acts: ['produces_only']}));
    e.done = ['1', '3'];
    const second = record(e);
    eq(second.next_n, 2, 'next copy');
    ok(second.changes.includes('The record now has everything it needs and is no longer a draft.'), 'no longer a draft: ' + second.changes);
    ok(second.changes.some(c => c.startsWith('Added to the AI list: Otter.ai')), 'new tool');
    ok(second.changes.some(c => /^Open actions: \d+ to \d+\.$/.test(c)), 'actions count');
  });
  test('sign-off: never a draft, and it lapses when the record changes', () => {
    const d = dana();
    throws(() => R.sign(d.record, 'Dana Reyes', record({}), TODAY), 'a draft');
    throws(() => R.sign(d.record, '   ', record(d), TODAY), 'no name');
    R.sign(d.record, 'Dana Reyes', record(d), TODAY);
    eq(sec(record(d), 'reviews').signoff, {name: 'Dana Reyes', date: TODAY, current: true}, 'signed');
    d.done = ['1', '6'];
    eq(sec(record(d), 'reviews').signoff.current, true, 'ticking a step with no answers changes no claim');
    d.ai_list.lines[0].done = [];
    eq(sec(record(d), 'reviews').signoff.current, false, 'a to-do reopened: sign again');
  });
  test('re-check date: the soonest of a review, a tool re-check, or three months', () => {
    const d = dana();
    eq(record(d).recheck_by, record(d).sections.find(s => s.id === 'ai_in_use').rows.map(r => r.recheck_by).concat(['2026-12-29']).sort()[0], 'soonest');
    A.set(d.answers, 's9.when.next', '2026-10-15', TODAY);
    const m = record(d);
    eq([m.recheck_by, m.stale], ['2026-10-15', false], 'the next review');
    eq(record(d, '2026-10-16').stale, true, 'past it');
  });
  test('retired uses leave the list of AI in use and the actions', () => {
    const d = dana();
    const l = d.ai_list.lines[1];
    l.retire = l.retire.map(() => true); l.retired_on = TODAY;
    const m = record(d);
    eq([sec(m, 'ai_in_use').rows.length, sec(m, 'ai_in_use').retired.map(r => r.tool)], [1, ['ChatGPT']], 'retired');
    ok(!sec(m, 'actions').list.some(a => (a.tool || '').startsWith('ChatGPT')), 'no actions for it');
  });

  /* ---------- one file for everything ---------- */
  test('the saved file reads back to the same record in another browser', () => {
    const d = dana();
    const file = JSON.parse(JSON.stringify(R.bundle(d, TODAY)));
    const back = R.unbundle(file, TODAY);
    eq(back.found, ['profile', 'answers', 'done', 'ai_list', 'risk', 'policy', 'quick', 'pulse'], 'what the file holds');
    const strip = m => JSON.stringify(m.sections.map(s => Object.assign({}, s, {items: undefined})));
    eq(strip(record(back.data)), strip(record(d)), 'same record');
    throws(() => R.unbundle({kind: 'something_else', data: {}}, TODAY), 'wrong kind');
    eq(R.KINDS.filter(k => !RECORD.parts[k]), [], 'every part has a name for the owner');
  });
  test('a tampered file is checked like anything typed', () => {
    const file = clone(R.bundle(dana(), TODAY));
    file.data.profile.team_size = 'enormous';
    file.data.answers.answers['s1.nobody'] = {value: 'x', date: TODAY};
    file.data.done.push('42', '<b>');
    file.data.record.signoff = {name: 'Someone', date: 'today', fingerprint: 'x'};
    const back = R.unbundle(file, TODAY).data;
    eq([back.profile.team_size, 's1.nobody' in back.answers.answers, back.done, back.record.signoff], [null, false, ['1'], null], 'cleaned');
  });
  test('something unreadable is reported, not fatal', () => {
    const d = dana();
    d.ai_list = {lines: 'nonsense'};
    d.policy = {a: 'nonsense'};
    const m = record(d);
    eq(m.problems, ['Your AI list could not be read.', 'Your saved policy could not be read.'], 'both reported');
    eq([sec(m, 'ai_in_use').status, sec(m, 'rules').status], ['empty', 'empty'], 'shown as gaps');
  });
  test('the Word stamp says when, from what, and that edits don\'t flow back', () => {
    const s = R.stamp(record(dana()), 3);
    ok(s.includes('September 29, 2026') && s.includes('record 3') && s.includes(TOOL_RULES.version) && s.includes('do not update the record'), s);
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} record tests passed`};
})();
