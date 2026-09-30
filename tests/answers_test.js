/* Tests for the playbook's done-when answers (answers_engine.js,
   data/done_when.js). Run with the other tests: tests/run_tests.sh or
   tests/run_tests.html. */

var AnswersTestRun = (function(){
  const A = AnswersEngine, D = DONE_WHEN;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'answers: ' + name, fails: []};
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
  const SECTIONS = ['responsibility', 'discovery', 'rules', 'suppliers', 'controls', 'incidents', 'reviews'];

  /* answer every question in a step */
  function fill(store, step, date){
    D.steps.find(s => s.step === step).questions.forEach(q => A.fieldsOf(q).forEach(k =>
      A.set(store, k, A.fields()[k].kind === 'date' ? '2026-09-01' : 'Answer for ' + k, date || TODAY)));
    return store;
  }

  /* ---------- the data ---------- */
  test('the questions match the playbook page word for word', () => {
    if (typeof readFile !== 'function'){ current.skipped = 'terminal only'; return; }
    const page = readFile('playbook.html');
    const unesc = s => s.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const found = {};
    const re = /data-step="(\d+)"[\s\S]*?<section class="sec sec-document"[^>]*>([\s\S]*?)<\/section>/g;
    let m;
    while ((m = re.exec(page))) found[m[1]] = (m[2].match(/<li>[\s\S]*?<\/li>/g) || []).map(unesc);
    eq(Object.keys(found), D.steps.map(s => s.step), 'steps on the page');
    D.steps.forEach(s => eq(s.questions.map(q => q.text), found[s.step], 'step ' + s.step));
  });
  test('ids are unique, sections are real, and there are no dashes', () => {
    const ids = D.steps.flatMap(s => s.questions.map(q => q.id));
    eq(ids.length, new Set(ids).size, 'unique ids');
    D.steps.forEach(s => s.questions.forEach(q => ok(SECTIONS.includes(q.record), `${q.id}: section ${q.record}`)));
    ok(!/[–—]/.test(JSON.stringify(D)), 'no em or en dashes');
    eq(D.steps.flatMap(s => s.questions).filter(q => q.role).map(q => q.role), ['decides', 'ask', 'out_of_hours'], 'responsibility roles');
  });

  /* ---------- keeping answers ---------- */
  test('an answer is kept with the date it last changed; clearing it removes it', () => {
    const st = A.empty();
    A.set(st, 's1.decides', '  Dana,   owner ', '2026-09-01');
    eq(st.answers['s1.decides'], {value: 'Dana, owner', date: '2026-09-01'}, 'tidied');
    A.set(st, 's1.decides', 'Dana, owner', TODAY);
    eq(st.answers['s1.decides'].date, '2026-09-01', 'same answer keeps its date');
    A.set(st, 's1.decides', 'Dana', TODAY);
    eq(st.answers['s1.decides'].date, TODAY, 'a change moves the date');
    A.set(st, 's1.decides', '   ', TODAY);
    ok(!('s1.decides' in st.answers), 'cleared');
    throws(() => A.set(st, 's1.nobody', 'x', TODAY), 'unknown question');
  });
  test('date fields take only real dates, and long answers are cut to size', () => {
    const st = A.empty();
    A.set(st, 's3.updated', 'last week', TODAY);
    A.set(st, 's9.when.last', '2026-02-30', TODAY);
    eq(Object.keys(st.answers), [], 'not dates');
    A.set(st, 's3.updated', '2026-09-01', TODAY);
    A.set(st, 's1.ask', 'x'.repeat(5000), TODAY);
    eq([st.answers['s3.updated'].value, st.answers['s1.ask'].value.length], ['2026-09-01', D.max_length], 'kept');
  });

  /* ---------- controls and evidence levels ---------- */
  test('Recorded needs the step marked done and every question answered', () => {
    const st = A.empty();
    A.set(st, 's1.decides', 'Dana', TODAY);
    let c = A.control(st, '1', ['1'], TODAY);
    eq([c.level, c.answered, c.total, c.missing.length], [null, 1, 3, 2], 'ticked, partly answered: a gap, not a claim');
    fill(st, '1');
    eq(A.control(st, '1', [], TODAY).level, null, 'answered but not marked done');
    eq(A.control(st, '1', new Set(['1']), TODAY).level, 'recorded', 'done and answered');
  });
  test('a question with parts needs every part', () => {
    const st = A.empty();
    A.set(st, 's9.when.last', '2026-09-01', TODAY);
    A.set(st, 's9.changed', 'New chatbot', TODAY);
    let c = A.control(st, '9', ['9'], TODAY);
    eq([c.level, c.answers[0].value], [null, 'Last review: 2026-09-01'], 'next review missing');
    A.set(st, 's9.when.next', '2026-12-01', TODAY);
    c = A.control(st, '9', ['9'], TODAY);
    eq([c.level, c.answers[0].parts], ['recorded', {last: '2026-09-01', next: '2026-12-01'}], 'both');
  });
  test('Supported adds a note; Confirmed is only ever set by the owner', () => {
    const st = fill(A.empty(), '6', '2026-06-01');
    A.setEvidence(st, '6', 'Rule shared at the team meeting, 5 June', '2026-06-05');
    eq(A.control(st, '6', ['6'], TODAY).level, 'supported', 'note');
    throws(() => A.confirm(st, '7', ['6', '7'], TODAY), 'step 7 is not answered');
    throws(() => A.confirm(st, '6', [], TODAY), 'step 6 is not marked done');
    A.confirm(st, '6', ['6'], '2026-09-28');
    eq(A.control(st, '6', ['6'], TODAY).level, 'confirmed', 'confirmed');
  });
  test('a confirmation lapses after the look-back window, or when an answer changes', () => {
    const st = fill(A.empty(), '6', '2026-06-01');
    A.confirm(st, '6', ['6'], '2026-06-02');
    eq(A.control(st, '6', ['6'], '2026-09-02').level, 'confirmed', 'within 92 days');
    eq(A.control(st, '6', ['6'], '2026-09-03').level, 'recorded', '93 days later');
    A.confirm(st, '6', ['6'], '2026-09-03');
    A.set(st, 's6.human', 'Everything a customer sees', '2026-09-10');
    const c = A.control(st, '6', ['6'], '2026-09-11');
    eq([c.level, c.confirmed_on, c.changed], ['recorded', '2026-09-03', '2026-09-10'], 'changed since confirmed');
  });

  /* ---------- feeding the record ---------- */
  test('answers reach the right record section, with roles for responsibility', () => {
    const st = A.empty();
    A.set(st, 's1.decides', 'Dana Ruiz, owner', TODAY);
    A.set(st, 's1.saturday', 'Dana, 555 0100', TODAY);
    A.set(st, 's8.pasted', 'Tell Dana, then delete the chat', TODAY);
    eq(A.forSection(st, 'responsibility').map(a => [a.role, a.value]), [['decides', 'Dana Ruiz, owner'], ['out_of_hours', 'Dana, 555 0100']], 'responsibility');
    eq(A.forSection(st, 'incidents').map(a => a.id), ['s8.pasted'], 'incidents');
    eq(A.forSection(st, 'discovery'), [], 'nothing typed for discovery');
  });
  test('loading keeps only what is valid', () => {
    const st = A.clean({answers: {'s1.decides': {value: 'Dana', date: TODAY}, 's1.nobody': {value: 'x'}, 's3.updated': {value: 'soon'},
      's1.ask': {value: '   '}, 's2.count': {value: 3}, 's1.saturday': {value: 'Sam', date: 'yesterday'}},
      evidence: {'6': {value: 'Notes', date: TODAY}, '12': {value: 'x'}}, confirmed: {'6': TODAY, '1': 'soon', '99': TODAY}});
    eq(Object.keys(st.answers), ['s1.decides', 's1.saturday'], 'answers');
    eq(st.answers['s1.saturday'].date, null, 'bad date dropped, answer kept');
    eq([Object.keys(st.evidence), st.confirmed], [['6'], {'6': TODAY}], 'evidence and confirmations');
    eq(A.clean('nonsense'), A.empty(), 'not an object');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} answers tests passed`};
})();
