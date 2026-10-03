/* Tests for the industry warnings (FIXES 1.4): the Get advice banner and its
   links, on step 0 of the playbook, the quick check result and the tool
   check result, and the defense notes. The page tests use the stand-in page
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
  const REGULATED = ['healthcare', 'defense', 'finance', 'professional', 'hiring', 'education'];
  const OTHERS = O.industry.options.map(o => o.id).filter(i => !REGULATED.includes(i));
  const profile = industry => ({profile_version: 2, team_size: 'small', ai_use: ['use'], industry: [industry], finance_subtype: null, registration: null, it_support: null});
  const BANNER = 'class="advice-banner"';

  test('each regulated industry has banner text and links; the others have none', () => {
    REGULATED.forEach(i => {
      const o = O.overlays[i];
      ok(o.seek_advice && /\.$/.test(o.seek_advice), i + ': banner text');
      ok(o.links && o.links.length, i + ': links');
      (o.links || []).forEach(l => {
        ok(/^https:\/\//.test(l.href), `${i}: ${l.href} is https`);
        ok(/^[^:]+: \S/.test(l.title) || /^APEX Accelerators/.test(l.title), `${i}: "${l.title}" names where it goes`);
      });
    });
    ok(OTHERS.length >= 4, 'retail, trades, creative and other are not regulated here');
    OTHERS.forEach(i => ok(!(O.overlays[i] || {}).seek_advice, i + ': no banner'));
    ok(/^\d{4}-\d{2}-\d{2}$/.test(O.links_checked), 'links checked date');
    ok(!/[–—]/.test(JSON.stringify(O.overlays) + JSON.stringify(O.general_help)), 'no dashes');
  });
  test('the banner: one per regulated industry, links open with rel="noopener", and general help for everyone', () => {
    const h = PR.adviceHTML(['healthcare'], esc);
    ok(h.includes(BANNER) && h.includes('<b>Get advice</b>'), 'the advisor-note component');
    eq((h.match(/<a /g) || []).length, (h.match(/rel="noopener"/g) || []).length, 'every link has rel="noopener"');
    ok(h.includes('SBA: Strengthen your cybersecurity') && h.includes('Oklahoma Small Business Development Centers'), 'general help');
    eq(PR.adviceHTML(['retail'], esc), '', 'none for retail');
    eq(PR.adviceBanners(['retail', 'healthcare', 'hiring', 'healthcare']).map(b => b.industry), ['healthcare', 'hiring'], 'two industries, two banners, no repeats');
    ok(PR.adviceHTML(['healthcare', 'hiring'], esc).includes('<span class="ind">Healthcare and wellness.</span>'), 'with two, each is named');
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
  test('defense notes: what DFARS requires, where CMMC stands, and export control', () => {
    const pts = O.overlays.defense.points.join(' ');
    ok(/NIST SP 800-171/.test(pts) && /FedRAMP Moderate or equivalent/.test(pts), 'DFARS 252.204-7012');
    ok(/Phase 1 self-assessments are in effect/.test(pts) && /July 13, 2026/.test(pts) && /current status/.test(pts), 'CMMC status, dated, with where to check');
    ok(/ITAR or EAR/.test(pts) && /can count as an export/.test(pts), 'export control');
    ok(!/DFARS 252.204-7012 and CMMC require CUI to stay/.test(pts), 'the old wording is gone');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} industry tests passed`};
})();
