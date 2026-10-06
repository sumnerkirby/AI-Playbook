/* Tests for the industry warnings (FIXES 1.4): the Get advice banner and its
   links, on step 0 of the playbook, the quick check result and the tool
   check result. Healthcare, education and defense are no longer covered
   (Oct 4, 2026). The page tests use the stand-in page
   in tests/fake_page.js.
   Run with the other tests: tests/run_tests.sh or tests/run_tests.html. */

var IndustryTestRun = (function(){
  const PR = ProfileEngine, O = PROFILE_OPTIONS;
  const {runPage} = FakePage;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'industry: ' + name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }
  const esc = UI.esc;
  const REGULATED = ['finance', 'professional', 'hiring'];
  const OTHERS = O.industry.options.map(o => o.id).filter(i => !REGULATED.includes(i));
  const profile = industry => ({profile_version: 3, team_size: 'small', ai_use: ['use'], industry: [industry], it_support: null});
  const BANNER = 'class="advice-banner"';

  test('each regulated industry has banner text and links; the others have none', () => {
    REGULATED.forEach(i => {
      const o = O.overlays[i];
      ok(o.seek_advice && /\.$/.test(o.seek_advice), i + ': banner text');
      ok(o.links && o.links.length, i + ': links');
      (o.links || []).forEach(l => {
        ok(/^https:\/\//.test(l.href), `${i}: ${l.href} is https`);
        ok(/^[^:]+: \S/.test(l.title), `${i}: "${l.title}" names where it goes`);
      });
    });
    ok(OTHERS.length >= 4, 'retail, trades, creative and other are not regulated here');
    OTHERS.forEach(i => ok(!(O.overlays[i] || {}).seek_advice, i + ': no banner'));
    ok(/^\d{4}-\d{2}-\d{2}$/.test(O.links_checked), 'links checked date');
    ok(!/[–—]/.test(JSON.stringify(O.overlays) + JSON.stringify(O.general_help)), 'no dashes');
  });
  test('the banner: one per regulated industry, links open with rel="noopener", and general help for everyone', () => {
    const h = PR.adviceHTML(['finance'], esc);
    ok(h.includes(BANNER) && h.includes('<b>Get advice</b>'), 'the advisor-note component');
    eq((h.match(/<a /g) || []).length, (h.match(/rel="noopener"/g) || []).length, 'every link has rel="noopener"');
    ok(h.includes('SBA: Strengthen your cybersecurity') && h.includes('Oklahoma Small Business Development Centers'), 'general help');
    eq(PR.adviceHTML(['retail'], esc), '', 'none for retail');
    eq(PR.adviceBanners(['retail', 'finance', 'hiring', 'finance']).map(b => b.industry), ['finance', 'hiring'], 'two industries, two banners, no repeats');
    ok(PR.adviceHTML(['finance', 'hiring'], esc).includes('<span class="ind">Finance and insurance.</span>'), 'with two, each is named');
    eq(PR.adviceBanners(['healthcare', 'education', 'defense']), [], 'nothing for industries no longer covered');
  });
  test('playbook step 0 shows the banner for a regulated industry, and nothing for the others', () => {
    REGULATED.forEach(i => ok(runPage('step_zero.js', {local: {'sb-ai-playbook:profile': JSON.stringify(profile(i))}}).includes(BANNER), i + ': banner'));
    OTHERS.forEach(i => ok(!runPage('step_zero.js', {local: {'sb-ai-playbook:profile': JSON.stringify(profile(i))}}).includes(BANNER), i + ': no banner'));
  });
  test('the quick check result opens with the banner for a regulated industry, and not for the others', () => {
    const E = QuickEngine;
    const hash = ind => {
      const st = {industry: ind, screener: {}, cards: [], none: false};
      E.screenerQuestions({industry: ind}, {}).forEach(q => { st.screener[q.id] = 'no'; });
      st.screener = E.pruneScreener({industry: ind}, st.screener);
      return '#' + E.encode(st) + '&s=result';
    };
    const top = html => { const i = html.indexOf('<h3 class="subhead">'); return i < 0 ? html : html.slice(0, i); };
    REGULATED.forEach(i => {
      const h = runPage('quick_check.js', {hash: hash(i), local: {'sb-ai-playbook:profile': JSON.stringify(profile(i))}});
      ok(top(h).includes(BANNER), i + ': banner above the findings');
      eq((top(h).match(/class="advice"/g) || []).length, 1, i + ': one note at the top, not two');
    });
    OTHERS.forEach(i => ok(!runPage('quick_check.js', {hash: hash(i), local: {'sb-ai-playbook:profile': JSON.stringify(profile(i))}}).includes(BANNER), i + ': no banner'));
  });
  test('the tool check result shows the banner for a regulated industry, and not for the others', () => {
    const run = i => {
      const P = profile(i);
      const l = ToolEngine.makeLine({mode: 'new', tool: 'Notes app', plan: 'business', access: ['website'], use: 'writing', data: ['internal'],
        training: 'no_checked', deletion: 'yes', published: 'yes', mfa: 'yes', output: ['internal'], acts: ['produces_only']}, P, '2026-10-03');
      return runPage('tool_check.js', {local: {'sb-ai-playbook:profile': JSON.stringify(P), 'sb-ai-playbook:ai-list': JSON.stringify({version: 1, lines: [l], skipped: []})},
        state: {tc: {name: 'line', lineId: l.id}, i: 1}});
    };
    REGULATED.forEach(i => ok(run(i).includes(BANNER), i + ': banner'));
    OTHERS.forEach(i => ok(!run(i).includes(BANNER), i + ': no banner'));
  });
  test('healthcare, education and defense: not offered, and the question says the site does not cover them', () => {
    ['healthcare', 'education', 'defense'].forEach(i => {
      ok(!O.industry.options.some(o => o.id === i), i + ': not offered');
      ok(!O.overlays[i], i + ': no notes');
    });
    ok(/does not cover the rules for healthcare, education or government contracting/.test(O.industry.why), 'said on the question');
  });

  /* ---------- FIXES 1.5: foreign AI tools, a neutral check ---------- */
  test('step 5 asks where a supplier is based and which law applies; step 7 covers phone apps', () => {
    const page = FakePage.need('playbook.html'), tpl = FakePage.need('policy-supplier-questions.html');
    ok(page.includes('where the company is based, where the data is stored and processed and which law governs it'), 'step 5, action 1');
    ok(page.includes('including whether a government there can require the supplier to hand data over'), 'step 5, why it matters');
    ok(page.includes('connectors and phone apps from developers you have not checked'), 'step 7, phone apps');
    ok(tpl.includes('under which country&rsquo;s law can a government require you to disclose our data?') && tpl.includes('Do any subprocessors outside'), 'two new supplier questions');
    const lists = tpl.split('<ol').slice(1).map(x => (x.split('</ol>')[0].match(/<li>/g) || []).length);
    eq([lists.reduce((a, b) => a + b, 0), (tpl.match(/<ol start="(\d+)">/g) || []).join(' ')], [17, '<ol start="8"> <ol start="11"> <ol start="14">'], 'seventeen questions, numbered in order');
    ok(tpl.includes('17 questions') && tpl.includes('Seventeen questions') && !/15 questions|Fifteen/.test(tpl), 'the count says 17');
    ok(FakePage.need('policies.html').includes('Step 5 &middot; 17 questions'), 'the templates page agrees');
  });

  /* ---------- one set of result words (Oct 4, 2026) ---------- */
  test('result words: acceptable, needs a check, or stop, on the home page, the quick check and the check-in', () => {
    const E = QuickEngine, ctx = {industry: 'retail'};
    const st = {industry: 'retail', screener: {}, none: false, cards: [
      {id: 'marketing', answers: {data: 'none', account: 'personal'}},
      {id: 'spreadsheets', answers: {data: 'sensitive', account: 'business'}}]};
    E.screenerQuestions(ctx, {}).forEach(q => { st.screener[q.id] = 'no'; });
    const h = runPage('quick_check.js', {hash: '#' + E.encode(st) + '&s=result', local: {'sb-ai-playbook:profile': JSON.stringify(profile('retail'))}});
    ok(h.includes('1 acceptable') && h.includes('1 needs a check'), 'the counts');
    ok(h.includes('Nothing to stop, 1 thing needs a check'), 'the headline');
    ok(!/>\s*\d+ go</.test(h) && !/\d+ check</.test(h), 'no go or check counts');
    const sentence = 'acceptable, needs a check, or stop';
    ok(FakePage.need('quick_check.html').includes(sentence), 'quick check intro');
    ok(!/go, check,? or stop/.test(FakePage.need('index.html')), 'the home page has no other words for them');
    ok(FakePage.need('quick_pulse.js').includes("{go: 'Acceptable', check: 'Needs a check', stop: 'Stop'}"), 'check-in labels');
  });
  test('all Not sure: the summary says what to find out, not what to check (FIXES 2.4)', () => {
    const E = QuickEngine, ctx = {industry: 'retail'};
    const st = {industry: 'retail', screener: {}, cards: [], none: true};
    E.screenerQuestions(ctx, {}).forEach(q => { st.screener[q.id] = 'not_sure'; });
    st.screener = E.pruneScreener(ctx, st.screener);
    const h = runPage('quick_check.js', {hash: '#' + E.encode(st) + '&s=result', local: {'sb-ai-playbook:profile': JSON.stringify(profile('retail'))}});
    ok(/No red flags confirmed yet: \d+ things to find out first/.test(h), 'find out first');
    ok(!h.includes('Nothing to stop'), 'does not read as a pass');
  });

  /* ---------- saving and exporting (feedback log items 98 to 103) ---------- */
  test('buttons that cannot be used yet look it, and a note says what turns them on', () => {
    ok(/\.btn:disabled[^{]*\{[^}]*not-allowed/.test(FakePage.need('site.css')), 'a disabled style for every button');
    const P = JSON.stringify(profile('retail'));
    const empty = runPage('tool_check.js', {local: {'sb-ai-playbook:profile': P}});
    ok(empty.includes('data-act="csv" disabled') && empty.includes('class="why-off"'), 'AI list, empty: off, with a note');
    const l = ToolEngine.makeLine({mode: 'new', tool: 'Notes app', plan: 'business', access: ['website'], use: 'writing', data: ['internal'],
      training: 'no_checked', deletion: 'yes', published: 'yes', mfa: 'yes', output: ['internal'], acts: ['produces_only']}, profile('retail'), '2026-10-04');
    const one = runPage('tool_check.js', {local: {'sb-ai-playbook:profile': P, 'sb-ai-playbook:ai-list': JSON.stringify({version: 1, lines: [l], skipped: []})}});
    ok(!one.includes('data-act="csv" disabled') && !one.includes('class="why-off"'), 'AI list, one tool: on, no note');
    const pulse = runPage('quick_pulse.js', {local: {'sb-ai-playbook:profile': P}});
    ok(pulse.includes('data-act="backup" disabled') && pulse.includes('class="why-off"'), 'check-in, none yet: off, with a note');
    ok(runPage('risk_matrix.js', {local: {'sb-ai-playbook:profile': P}}).includes('class="why-off"'), 'risk overview, empty: a note');
  });
  test('spreadsheets use the words on screen, not internal ids', () => {
    const P = profile('retail');
    const l = ToolEngine.makeLine({mode: 'new', tool: 'Notes app', plan: 'business', access: ['website'], use: 'writing', data: ['personal'],
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', mfa: 'yes', output: ['internal'], acts: ['produces_only']}, P, '2026-10-04');
    const row = ToolEngine.csv([l], P, '2026-10-04').split('\r\n')[1];
    ok(/,Go(,| once| for)/.test(row) && !/,(green|amber|red),/.test(row), 'AI list light: ' + row.slice(0, 160));
    ok(row.includes('Names and contact details') && !/,personal,/.test(row), 'AI list data');
    const log = {version: 1, checkins: [{date: '2026-10-04', new_tools: [], incidents: [], connections: [{name: 'Copilot', approval: 'some', light: 'check'}], people: {answer: 'no'}}]};
    const c = PulseEngine.csv(log);
    ok(c.includes('needs a check') && c.includes('Approval before it acts: For some things') && !/,(go|check)\r/.test(c), 'check-in: ' + c.slice(30, 220));
  });
  test('the record: Word file has its type, and one name for the risk register', () => {
    const src = FakePage.need('record.js');
    ok(src.includes("'application/vnd.openxmlformats-officedocument.wordprocessingml.document'"), 'Word type');
    ok(src.includes('ai_risk_register_') && !src.includes('`risk_register_'), 'same file name as the risk overview');
    ok(FakePage.need('risk_matrix.js').includes('ai_risk_register_'), 'risk overview name');
  });
  test('the check-in says three to five questions', () => {
    const h = FakePage.need('quick_pulse.html');
    ok(h.includes('three to five questions') && !/three or four/i.test(h), 'count');
  });

  /* ---------- site critique fixes (feedback log items 105 to 107) ---------- */
  test('the quick check result ends with steps in order: fix, policy, then the AI list', () => {
    const E = QuickEngine, ctx = {industry: 'retail'};
    const st = {industry: 'retail', screener: {}, none: false, cards: [{id: 'writing', answers: {data: 'customer', account: 'personal'}}]};
    E.screenerQuestions(ctx, {}).forEach(q => { st.screener[q.id] = 'no'; });
    const h = runPage('quick_check.js', {hash: '#' + E.encode(st) + '&s=result', local: {'sb-ai-playbook:profile': JSON.stringify(profile('retail'))}});
    const a = h.indexOf('Fix the one thing to stop now'), b = h.indexOf('Write your AI policy'), c = h.indexOf('Check the tool you use most');
    ok(a > 0 && b > a && c > b, 'order: ' + [a, b, c]);
    ok(h.includes('Then &middot; 8 to 10 minutes') && h.includes('Start my AI policy') && h.includes('data-act="save-go"'), 'policy second, AI list third');
    const clean = {industry: 'retail', screener: st.screener, none: false, cards: [{id: 'marketing', answers: {data: 'none', account: 'personal'}}]};
    const g = runPage('quick_check.js', {hash: '#' + E.encode(clean) + '&s=result', local: {'sb-ai-playbook:profile': JSON.stringify(profile('retail'))}});
    ok(g.includes('First &middot; 8 to 10 minutes') && g.indexOf('Write your AI policy') < g.indexOf('Check the tool you use most'), 'nothing to fix: the policy comes first');
  });
  test('the home page says what the site does not cover, and where to go', () => {
    const h = FakePage.need('index.html');
    ok(h.includes('id="not-covered"'), 'section');
    ['hhs.gov', 'studentprivacy.ed.gov', 'dodcio.defense.gov', 'owasp-llm-top-10-2026.html', 'ai-rmf-1-0.html', 'sba.gov'].forEach(x => ok(h.includes(x), x));
    ok((h.match(/href="https:[^"]+" rel="noopener"/g) || []).length >= 7, 'outside links open with rel="noopener"');
    ok(/home page lists where to go instead/.test(O.industry.why) && /home page lists where to go instead/.test(O.ai_use.why), 'step 0 points to it');
  });
  test('the record: no capital T in the middle of a sentence when no name is given', () => {
    const src = FakePage.need('record_engine.js');
    ok(src.includes('business === RC.business_fallback ? business.charAt(0).toLowerCase()'), 'statement uses this business');
  });

  test('the policy fills in the saved quick check when opened without its link (log item 134)', () => {
    const quick = JSON.stringify({hash: '#v=1&i=pr&a=1n2n3n4ydy5n6n&b=wr-dn.hi-pyly'});
    ok(runPage('quick_policy.js', {local: {'sb-ai-playbook:quick': quick}}).includes('Carried over from your quick check'), 'from the saved quick check');
    ok(!runPage('quick_policy.js', {}).includes('Carried over from your quick check'), 'nothing saved: nothing carried over');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} industry tests passed`};
})();
