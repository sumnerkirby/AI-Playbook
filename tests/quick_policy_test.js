/* Tests for D, answers become the policy (policy_engine.js).
   Run with the other tests: tests/run_tests.sh or tests/run_tests.html. */

var PolicyTestRun = (function(){
  const PE = PolicyEngine;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'policy: ' + name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }
  const TODAY = '2026-09-29';
  const docText = doc => PE.plain(doc);
  const section = (doc, id) => doc.sections.find(s => s.id === id);
  const secText = (doc, id) => { const s = section(doc, id); return s ? s.blocks.map(b => PE.text(b.p || (b.ul || b.checks).flat())).join(' ') : null; };

  function dana(){
    const a = PE.initial(TODAY, 'finance');
    Object.assign(a, {
      team: 'solo', business: 'Reyes Financial Planning',
      tools: [{name: 'ChatGPT', account: 'not_yet'}, {name: 'Microsoft Copilot', account: 'business'}],
      people_info: 'approved', decisions: 'no', acts: 'not_sure', telling: ['agreements'], recording: 'yes',
    });
    return a;
  }

  /* ---------- data ---------- */
  test('no em dashes or en dashes in any policy wording', () => {
    const s = JSON.stringify(POLICY);
    ok(!/[\u2013\u2014]/.test(s), 'found a dash');
  });
  test('every placeholder in the wording has a value or a blank label', () => {
    const known = ['business', 'decider', 'adopted', 'review', 'incident_who', 'speed', 'tools', 'date', 'kinds', 'tool'];
    const s = JSON.stringify(POLICY.text) + JSON.stringify(POLICY.todos) + JSON.stringify(POLICY.never_sheet);
    (s.match(/\{\w+\}/g) || []).forEach(p => ok(known.includes(p.slice(1, -1)), 'unknown placeholder ' + p));
  });
  test('both variants have the same sentences', () => {
    const t = Object.keys(POLICY.text.team).filter(k => !['who_h', 'who', 'sign'].includes(k));
    const s = Object.keys(POLICY.text.solo).filter(k => !['settings_h', 'settings'].includes(k));
    eq(s.sort(), t.sort(), 'keys');
  });

  test('a role at the start of a sentence gets a capital, mid-sentence it does not', () => {
    const a = PE.initial(TODAY); a.decider = 'the office manager';
    eq(secText(PE.build(a), 'who'),
      "The office manager decides which AI tools we can use. If you are not sure whether something is allowed, ask the office manager.", 'who');
  });

  /* ---------- dates ---------- */
  test('review date defaults to three months, clamped to month end', () => {
    eq(PE.initial(TODAY).review, '2026-12-29', 'default review');
    eq(PE.addMonths('2026-11-30', 3), '2027-02-28', 'end of February');
    eq(PE.fmtDate('2026-12-29'), 'December 29, 2026', 'format');
  });

  /* ---------- an empty policy looks unfinished, not finished ---------- */
  test('unanswered questions show as highlighted blanks', () => {
    const doc = PE.build(PE.initial(TODAY));
    eq(PE.text(doc.title), '[Business name]: Using AI at work', 'title');
    ok(secText(doc, 'who').includes('[Name or role] decides'), 'who');
    ok(secText(doc, 'tools').includes('[Approved tools]'), 'tools');
    ok(secText(doc, 'people').includes('[What customer and staff information can go in]'), 'people');
    ok(secText(doc, 'telling').includes('[How we tell customers about AI]'), 'telling');
  });

  /* ---------- the design's checks ---------- */
  test('check 1: "work accounts only" always comes with the tools still being moved', () => {
    const a = PE.initial(TODAY);
    Object.assign(a, {business: 'Acme', decider: 'Maria', tools: [{name: 'ChatGPT', account: 'not_yet'}, {name: 'Gemini', account: 'business'}]});
    const t = secText(PE.build(a), 'tools');
    ok(t.includes('Use only your work account'), 'rule');
    ok(t.includes('Being set up: ChatGPT. Do not use it for customer information until October 29, 2026.'), 'being set up line');
    ok(!/You may use these tools for work: ChatGPT/.test(t), 'not-yet tool is not listed as approved');
  });
  test('check 2: acting not sure writes the approval rule and a to-do', () => {
    const a = PE.initial(TODAY); a.acts = 'not_sure';
    const doc = PE.build(a);
    ok(secText(doc, 'acting').includes('must not send, pay or delete'), 'rule');
    ok(doc.todos.some(t => t.id === 'acts_not_sure'), 'to-do');
    a.acts = 'no';
    const doc2 = PE.build(a);
    ok(!secText(doc2, 'acting').includes('must not send'), 'no rule when nothing can act');
    ok(secText(doc2, 'acting').includes('before connecting'), 'but still ask before connecting');
  });
  test('check 3: the footer says it is a decision, not a record', () => {
    ok(PE.text(PE.build(PE.initial(TODAY)).footer).includes('is not a record of what has been checked'), 'team');
    const a = PE.initial(TODAY); a.team = 'solo';
    ok(PE.text(PE.build(a).footer).includes('are not a record of what has been checked'), 'solo');
  });
  test('customer information "only in approved tools" with no business tool says none until there is one', () => {
    const a = PE.initial(TODAY);
    Object.assign(a, {people_info: 'approved', tools: [{name: 'ChatGPT', account: 'not_yet'}]});
    const doc = PE.build(a);
    ok(secText(doc, 'people').includes('must not go into any AI tool until we have an approved business account'), 'sentence');
    ok(doc.todos.some(t => t.id === 'no_business'), 'to-do');
    a.tools.push({name: 'Copilot', account: 'business'}, {name: 'Claude', account: 'business'});
    ok(secText(PE.build(a), 'people').includes('may only go into Copilot and Claude'), 'names the approved tools');
  });

  /* ---------- Dana: the solo variant ---------- */
  test('Dana (solo adviser): rules and settings sheet', () => {
    const doc = PE.build(dana());
    eq(PE.text(doc.title), 'Reyes Financial Planning: My AI rules and settings', 'title');
    ok(!section(doc, 'who'), 'no who-to-ask section for a solo business');
    ok(!section(doc, 'sign'), 'no staff sign-off');
    ok(secText(doc, 'tools').includes('Moving to a business account: ChatGPT'), 'not-yet line in first person');
    ok(secText(doc, 'settings').includes('Microsoft Copilot'), 'settings checklist for the business tool');
    ok(!secText(doc, 'settings').includes('ChatGPT'), 'no settings checklist for the tool being moved');
    ok(secText(doc, 'never').includes('Client account numbers, statements and portfolio details'), 'finance suggestion');
    ok(secText(doc, 'wrong').includes('compliance consultant, custodian or insurer'), 'finance incident contacts');
    eq(doc.todos.map(t => t.id), ['not_yet_tools', 'acts_not_sure', 'settings'], 'to-dos');
    const second = docText(doc).match(/\byou(r|rs|'re|'d|'ll)?\b/gi);
    ok(!second, 'first person throughout, found: ' + second);
    const team = docText(doc).match(/\b(we|we're|we'll|our|us)\b/gi);
    ok(!team, 'no team voice in a solo sheet, found: ' + team);
  });

  /* ---------- industry ---------- */
  test('industry suggestions: ticked for that industry, and health swaps for patients', () => {
    ok(PE.neverDefaults('healthcare').includes('patients'), 'patients');
    ok(!PE.neverDefaults('healthcare').includes('health'), 'general health line replaced');
    ok(PE.neverDefaults(null).includes('health'), 'general health line otherwise');
    ok(!PE.neverDefaults('retail').includes('client_conf'), 'no other industry items');
    const a = PE.initial(TODAY, 'defense'); a.never_touched = true; a.never = ['passwords'];
    PE.setIndustry(a, 'healthcare');
    eq(a.never, ['passwords'], 'an edited list is kept when the industry changes');
  });

  /* ---------- carry-over from A and B ---------- */
  test('from the quick check: Dana\'s answers pre-fill D', () => {
    const q = QuickEngine.decode('#v=1&i=fi&a=1y2n3u4n5n6y7y&b=wr-dsap.mt-tndcab.mk-dn.ib-xudn.sp-dsab');
    const a = PE.fromQuick(q, PE.initial(TODAY));
    eq(a.industry, 'finance', 'industry');
    eq(a.acts, 'not_sure', 'acts from A q3 and the inbox card');
    eq(a.decisions, 'no', 'decisions from A q4');
    eq(a.recording, 'yes', 'recording from A q6');
    eq(a.prefilled.sort(), ['acts', 'decisions', 'industry', 'recording'], 'marked as prefilled');
    ok(a.never.includes('client_fin'), 'industry suggestions follow');
    const h = PE.quickHints(q);
    eq(h.personal, true, 'personal accounts were mentioned');
    eq(h.activities.length, 5, 'activities to jog memory');
  });
  test('from the quick check: hiring and customer cards', () => {
    const q = {industry: null, screener: {q4: 'no'}, cards: [{id: 'hiring', answers: {person_decides: 'yes'}}, {id: 'customers', answers: {says_ai: 'no'}}]};
    const a = PE.fromQuick(q, PE.initial(TODAY));
    eq(a.decisions, 'yes', 'hiring card wins over A q4');
    eq(a.decision_kinds, ['hiring'], 'kind');
    eq(a.telling, ['not_yet'], 'chatbot not saying it is AI');
  });
  test('from the quick check: nothing given means nothing assumed', () => {
    const a = PE.fromQuick(null, PE.initial(TODAY));
    eq([a.acts, a.decisions, a.recording, a.telling.length], [null, null, null, 0], 'untouched');
  });

  /* ---------- markup ---------- */
  test('markup escapes what the owner types', () => {
    const a = PE.initial(TODAY); a.business = '<script>x</script> & Co';
    const html = PE.toHTML(PE.build(a));
    ok(!html.includes('<script>'), 'no raw tag');
    ok(html.includes('&lt;script&gt;x&lt;/script&gt; &amp; Co'), 'escaped');
    ok(html.startsWith('<h4>'), 'title first, for docx.js');
  });
  test('carry-over fills playbook steps 1, 3, 4 and 6 and lists tools as finds', () => {
    const a = dana(); a.team = 'team'; a.decider = 'Dana';
    const c = PE.carryOver(a, TODAY);
    eq(c.playbook.step_1.decides_new_tools, 'Dana', 'step 1');
    eq(c.playbook.step_3.next_review, '2026-12-29', 'step 3');
    ok(c.playbook.step_4.never_put_in.length >= 5, 'step 4');
    ok(c.playbook.step_6.human_checks.includes('anything sent to a customer'), 'step 6');
    eq(c.finds.map(f => [f.name, f.tags.account]), [['ChatGPT', 'personal'], ['Microsoft Copilot', 'business']], 'finds');
  });

  /* ---------- two-step sign-in (FIXES 1.2) ---------- */
  test('the policy requires two-step sign-in, and a team policy removes accounts when someone leaves', () => {
    const team = Object.assign(dana(), {team: 'team', decider: 'Dana'});
    ok(secText(PE.build(team), 'tools').includes('Every AI account used for work has two-step sign-in turned on, and accounts are removed when someone leaves.'), 'team');
    ok(secText(PE.build(dana()), 'tools').includes('Every AI account I use for work has two-step sign-in turned on.'), 'solo');
    ok(secText(PE.build(dana()), 'settings').includes('Two-step sign-in: on'), 'solo settings checklist');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} policy tests passed`};
})();
