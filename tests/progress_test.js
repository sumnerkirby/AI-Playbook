/* Tests for Your progress (progress_engine.js, data/progress.js, progress.js,
   home_progress.js): the two ways through, what counts as done, and the one
   next thing. Run with the other tests: tests/run_tests.sh or tests/run_tests.html. */

var ProgressTestRun = (function(){
  const PG = ProgressEngine, G = PROGRESS;
  const {runPage, need, fakeStorage} = FakePage;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'progress: ' + name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }

  const PROFILE = {profile_version: 3, team_size: 'small', ai_use: ['use'], industry: ['retail'], it_support: null};
  const LINE = {id: 'l1', answers: {tool: 'ChatGPT', use: 'writing'}, done: []};
  const ids = list => list.filter(x => x.done).map(x => x.id);

  test('the essentials, in the quick-win order, and the full playbook, steps 0 to 9 then two tools', () => {
    eq(G.essentials.stages.map(s => s.id), ['business', 'quick', 'policy', 'tool', 'reminder'], 'essentials order');
    eq(G.full.steps.map(s => s.n), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'steps');
    eq(G.full.tools.map(t => t.id), ['risk', 'record'], 'then');
    ok(!/[–—]/.test(JSON.stringify(G)), 'no dashes');
  });
  test('step titles match the playbook, and every link goes to a page that exists', () => {
    const pb = need('playbook.html');
    G.full.steps.filter(s => s.n > 0).forEach(s => ok(pb.includes(`<span class="title">${s.title}<small>`), `step ${s.n}: ${s.title}`));
    ok(pb.includes('Describe your business<small>'), 'step 0');
    const hrefs = G.essentials.stages.map(s => s.href).concat(G.full.steps.flatMap(s => s.helps.map(h => h.href)), G.full.tools.map(t => t.href), [G.all_done.href]);
    hrefs.forEach(h => { try { need(h.split('#')[0]); } catch (e) { ok(false, 'missing page ' + h); } });
  });

  test('nothing saved: nothing done, and the first essential is next', () => {
    const S = PG.status({});
    eq([S.any, S.track, S.next.id], [false, 'essentials', 'business'], 'start');
    eq([S.counts.essentials, S.counts.full], [[0, 5], [0, 12]], 'counts');
  });
  test('each essential is done by what its tool saved', () => {
    const base = {profile: PROFILE};
    eq(ids(PG.status(base).essentials), ['business'], 'profile');
    eq(PG.status(base).next.id, 'quick', 'then the quick check');
    const q = Object.assign({}, base, {quick: {hash: '#v=1', screener: {answers: {}}, finds: [{use: 'writing'}]}});
    eq(ids(PG.status(q).essentials), ['business', 'quick'], 'quick check saved');
    const p = Object.assign({}, q, {policy: {a: {business: 'Riverside'}}});
    eq(PG.status(p).next.id, 'tool', 'policy saved, then a tool');
    ok(/Your quick check found tasks/.test(PG.status(p).next.note), 'a tool: the note mentions the quick check finds');
    const t = Object.assign({}, p, {ai_list: {lines: [LINE]}});
    eq(PG.status(t).next.id, 'reminder', 'a tool on the list');
    eq(PG.status(Object.assign({}, t, {pulse_calendar: '2026-10-04'})).track, 'full', 'calendar reminder: essentials done');
    eq(PG.status(Object.assign({}, t, {pulse: {checkins: [{date: '2026-10-04'}]}})).track, 'full', 'or a first check-in');
  });
  test('what does not count: a retired tool, an unfinished profile, a policy only started', () => {
    eq(PG.status({ai_list: {lines: [Object.assign({}, LINE, {retired_on: '2026-10-01'})]}}).essentials.find(x => x.id === 'tool').done, false, 'retired');
    eq(PG.status({profile: {team_size: 'solo'}}).essentials[0].done, false, 'unfinished profile');
    const S = PG.status({profile: PROFILE, quick: {hash: '#x'}, policy_draft: {a: {}}});
    const pol = S.essentials.find(x => x.id === 'policy');
    eq([pol.done, pol.started, S.next.id], [false, true, 'policy'], 'started, not done');
  });
  test('the full playbook: steps marked done, a risk snapshot, a copy of the record', () => {
    const S = PG.status({profile: PROFILE, done: ['1', '3', 9], risk: {snapshots: [{date: '2026-10-04', items: []}]}, record: {generations: [{n: 1}]}});
    eq(ids(S.full), ['step-0', 'step-1', 'step-3', 'step-9', 'risk', 'record'], 'done');
    eq(S.full.find(x => x.id === 'step-2').href, 'playbook.html#step-2', 'link to the step');
  });
  test('a playbook step as the next thing: its own button, and a word when the essentials are done', () => {
    const t = {profile: PROFILE, quick: {hash: '#x'}, policy: {a: {}}, ai_list: {lines: [LINE]}, pulse_calendar: '2026-10-04'};
    const S = PG.status(t);
    eq([S.track, S.next.id, S.next.cta, S.next.href], ['full', 'step-1', 'Open step 1', 'playbook.html#step-1'], 'step 1 next');
    ok(/^The essentials are done\./.test(S.next.note) && /mark the step done/.test(S.next.note), 'note');
    ok(!/essentials are done/.test(PG.status({profile: PROFILE}).full[1].note), 'no such word before then');
  });
  test('everything done: keep it current', () => {
    const all = {profile: PROFILE, quick: {hash: '#x'}, policy: {a: {}}, ai_list: {lines: [LINE]}, pulse_calendar: '2026-10-04',
      done: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], risk: {snapshots: [{}]}, record: {generations: [{}]}};
    const S = PG.status(all);
    eq([S.track, S.next.id, S.next.href], ['done', 'all_done', 'quick_pulse.html'], 'all done');
  });
  test('reading storage: JSON values, the plain-text calendar date, and storage that throws', () => {
    const local = fakeStorage({'sb-ai-playbook:profile': JSON.stringify(PROFILE), 'sb-ai-playbook:pulse-calendar': '2026-10-04', 'sb-ai-playbook:done': '["2"]'});
    const s = PG.readSaved(local, fakeStorage({'sb-ai-playbook:policy-draft': '{"a":{}}'}));
    eq([s.profile.team_size, s.pulse_calendar, s.done, !!s.policy_draft, s.quick], ['small', '2026-10-04', ['2'], true, null], 'read');
    const broken = {getItem(){ throw new Error('blocked'); }};
    eq(PG.status(PG.readSaved(broken, broken)).any, false, 'blocked storage: nothing saved, no error');
  });

  test('the progress page: a next card, both tracks, and a note when nothing is saved', () => {
    const empty = runPage('progress.js', {});
    ok(empty.includes('Describe your business') && empty.includes('Answer three questions') && empty.includes('Nothing is saved in this browser yet'), 'first visit');
    ok(empty.includes('The essentials') && empty.includes('The full playbook') && empty.includes('Step 9: Hold a quarterly review'), 'both tracks');
    const some = runPage('progress.js', {local: {'sb-ai-playbook:profile': JSON.stringify(PROFILE)}});
    ok(some.includes('Essentials &middot; <b>step 2 of 5</b>') && some.includes('Do the quick check') && !some.includes('Nothing is saved'), 'next: the quick check');
    ok(some.includes('<span class="state">done</span>') && some.includes('<span class="state">next</span>'), 'states written out, not only shown by marks');
  });
  test('the home page: no card on a first visit, a welcome-back card after', () => {
    eq(runPage('home_progress.js', {}), '', 'first visit: nothing');
    const h = runPage('home_progress.js', {local: {'sb-ai-playbook:profile': JSON.stringify(PROFILE)}});
    ok(h.includes('Welcome back') && h.includes('The essentials, 1 of 5 done') && h.includes('href="quick_check.html"') && h.includes('href="progress.html"'), 'card');
    const page = need('index.html');
    ok(page.includes('<h2>The essentials</h2>') && page.includes('<h2>The full playbook</h2>') && page.includes('id="continue" hidden'), 'two ways through');
    ok(page.indexOf('src="data/progress.js"') > 0 && page.indexOf('src="home_progress.js"') > page.indexOf('src="progress_engine.js"'), 'scripts in order');
  });
  test('every page with a tools row starts it with Your progress', () => {
    ['index.html', 'playbook.html', 'quick_check.html', 'tool_check.html', 'risk_matrix.html', 'quick_policy.html', 'quick_pulse.html', 'record.html',
      'privacy.html', 'policies.html', 'guide-data.html', 'policy-ai-lead.html', 'ai-rmf-1-0.html', 'progress.html'].forEach(p => {
      const s = need(p), i = s.indexOf('<span class="k">Your tools</span>');
      ok(i > 0 && /^\s*<a href="progress.html"( aria-current="page")?>Your progress<\/a>/.test(s.slice(i + 34)), p);
    });
  });

  test('the quick check and the policy save themselves when finished (Sumner, Oct 4, 2026)', () => {
    const E = QuickEngine, ctx = {industry: 'retail'};
    const st = {industry: 'retail', screener: {}, none: false, cards: [{id: 'marketing', answers: {data: 'none', account: 'personal'}}]};
    E.screenerQuestions(ctx, {}).forEach(q => { st.screener[q.id] = 'no'; });
    const hash = '#' + E.encode(st) + '&s=result', local = {'sb-ai-playbook:profile': JSON.stringify(PROFILE)};
    const own = runPage('quick_check.js', {hash, local, state: {qc: 9}});
    ok(own.includes('Saved in this browser, so that the AI list') && !own.includes('data-act="save"'), 'finished here: saved, no button');
    const link = runPage('quick_check.js', {hash, local});
    ok(link.includes('data-act="save"') && !link.includes('Saved in this browser, so that the AI list'), 'opened from a link: not saved, button offered');
    const pol = need('quick_policy.js');
    ok(/const autoSaved = prev && JSON\.stringify\(prev\.a\) === JSON\.stringify\(a\)\s*\|\| sset\('localStorage', SAVE_KEY/.test(pol), 'policy saved when ready, unless unchanged');
    ok(!/if you choose|chose to save|Choose Save/.test(need('quick_check.html') + need('quick_policy.html') + need('progress.html') + need('data/storage_keys.js') + need('data/progress.js')), 'no wording says saving is a choice');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} progress tests passed`};
})();
