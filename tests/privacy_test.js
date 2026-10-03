/* Tests for privacy: Delete everything, the list of storage keys, the tags
   every page carries, and that nothing typed or put in an address can add
   markup to a page.

   The injection tests run the real page scripts (quick_check.js,
   tool_check.js and the rest) against a stand-in page: every assignment to
   innerHTML is kept, and checked for an <img> element. The page scripts are
   read as text, so this file needs to read the site's files: under
   JavaScriptCore (tests/run_tests.sh) with readFile, under Node with fs, and
   in a browser from the site itself (opened from disk, it cannot, and says
   so). */

var PrivacyTestRun = (function(){
  const PE = PrivacyEngine, SK = STORAGE_KEYS;
  const results = [];
  let current = null;

  function test(name, fn){
    current = {name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }

  /* ---------- reading the site's own files ---------- */
  function readSource(path){
    try { if (typeof readFile === 'function') return readFile(path); } catch (e) {}
    try { if (typeof require === 'function') return require('fs').readFileSync(path, 'utf8'); } catch (e) {}
    try {
      if (typeof XMLHttpRequest === 'function'){
        const x = new XMLHttpRequest();
        x.open('GET', '../' + path, false);
        x.send();
        if (x.status === 200 || (x.status === 0 && x.responseText)) return x.responseText;
      }
    } catch (e) {}
    return null;
  }
  const NO_FILES = 'could not read the site’s files here; open this page from the site, or run tests/run_tests.sh';
  const need = path => {
    const s = readSource(path);
    if (s == null) throw new Error(NO_FILES + ' (' + path + ')');
    return s;
  };

  /* every page, and every script a page loads (checked against the pages below) */
  const PAGES = ['404.html', 'ai-rmf-1-0.html', 'ai-rmf-genai-profile.html', 'ai-rmf-playbook.html', 'guide-ai-inventory.html',
    'guide-ai-policy.html', 'guide-data.html', 'index.html', 'owasp-llm-top-10-2026.html', 'playbook.html', 'policies.html',
    'policy-ai-lead.html', 'policy-connected-ai.html', 'policy-human-review.html', 'policy-incident-response.html',
    'policy-quarterly-review.html', 'policy-supplier-questions.html', 'policy-tool-approval.html', 'privacy.html', 'profile.html',
    'quick_check.html', 'quick_policy.html', 'quick_pulse.html', 'record.html', 'risk_matrix.html', 'tool_check.html'];
  const SCRIPTS = ['answers_engine.js', 'docx.js', 'done_when.js', 'home_forward.js', 'policy_engine.js', 'privacy.js', 'privacy_engine.js',
    'profile.js', 'profile_bar.js', 'profile_engine.js', 'progress_bar.js', 'pulse_engine.js', 'quick_check.js', 'quick_engine.js',
    'quick_policy.js', 'quick_pulse.js', 'record.js', 'record_engine.js', 'risk_engine.js', 'risk_matrix.js', 'site.js', 'sitebar.js',
    'step_zero.js', 'tool_check.js', 'tool_engine.js', 'ui_common.js',
    'data/done_when.js', 'data/policy_questions.js', 'data/profile_effects.js', 'data/profile_options.js', 'data/pulse_questions.js',
    'data/questions.js', 'data/record.js', 'data/risk_matrix.js', 'data/rules.js', 'data/storage_keys.js', 'data/tool_questions.js',
    'data/tool_rules.js'];

  /* ---------- a stand-in page ---------- */
  function fakeStorage(init){
    const m = new Map(Object.entries(init || {}));
    return {
      getItem: k => m.has(k) ? m.get(k) : null,
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: k => { m.delete(k); },
      key: i => { const ks = [...m.keys()]; return i < ks.length ? ks[i] : null; },
      get length(){ return m.size; },
      _map: m,
    };
  }
  const TEXT = ['innerHTML', 'outerHTML', 'textContent', 'innerText', 'value', 'id', 'className', 'href', 'src'];
  /* any element: properties and methods give another stand-in, and innerHTML is kept */
  function fakeEl(log){
    const props = {
      classList: {add(){}, remove(){}, toggle(){}, contains(){ return false; }},
      dataset: {}, style: {setProperty(){}}, files: [],
    };
    return new Proxy(function(){}, {
      get(t, k){
        if (k in props) return props[k];
        if (k === Symbol.toPrimitive) return () => '';
        if (k === Symbol.iterator) return function*(){};
        if (typeof k === 'symbol' || k === 'then') return undefined;
        if (TEXT.includes(k)) return '';
        if (k === 'length' || k === 'scrollWidth' || k === 'clientWidth' || k === 'offsetLeft') return 0;
        if (k === 'hidden' || k === 'checked' || k === 'disabled' || k === 'open') return false;
        if (k === 'querySelectorAll' || k === 'getElementsByTagName') return () => [];
        return fakeEl(log);
      },
      set(t, k, v){
        if (k === 'innerHTML' || k === 'outerHTML') log.push(String(v));
        props[k] = v;
        return true;
      },
      apply(){ return fakeEl(log); },
    });
  }
  /* the data and engines a page script may use, passed in by name (under
     Node they are not globals) */
  const LIBS = {
    PROFILE_OPTIONS: typeof PROFILE_OPTIONS !== 'undefined' ? PROFILE_OPTIONS : undefined,
    PROFILE_EFFECTS: typeof PROFILE_EFFECTS !== 'undefined' ? PROFILE_EFFECTS : undefined,
    ProfileEngine: typeof ProfileEngine !== 'undefined' ? ProfileEngine : undefined,
    YES_NO_NOT_SURE: typeof YES_NO_NOT_SURE !== 'undefined' ? YES_NO_NOT_SURE : undefined,
    SCREENER: typeof SCREENER !== 'undefined' ? SCREENER : undefined,
    CARD_QUESTIONS: typeof CARD_QUESTIONS !== 'undefined' ? CARD_QUESTIONS : undefined,
    CARDS: typeof CARDS !== 'undefined' ? CARDS : undefined,
    RULE_SOURCES: typeof RULE_SOURCES !== 'undefined' ? RULE_SOURCES : undefined,
    RULES: typeof RULES !== 'undefined' ? RULES : undefined,
    QuickEngine: typeof QuickEngine !== 'undefined' ? QuickEngine : undefined,
    POLICY: typeof POLICY !== 'undefined' ? POLICY : undefined,
    PolicyEngine: typeof PolicyEngine !== 'undefined' ? PolicyEngine : undefined,
    PULSE: typeof PULSE !== 'undefined' ? PULSE : undefined,
    PulseEngine: typeof PulseEngine !== 'undefined' ? PulseEngine : undefined,
    TOOL_QUESTIONS: typeof TOOL_QUESTIONS !== 'undefined' ? TOOL_QUESTIONS : undefined,
    TOOL_RULES: typeof TOOL_RULES !== 'undefined' ? TOOL_RULES : undefined,
    ToolEngine: typeof ToolEngine !== 'undefined' ? ToolEngine : undefined,
    RISK: typeof RISK !== 'undefined' ? RISK : undefined,
    RiskEngine: typeof RiskEngine !== 'undefined' ? RiskEngine : undefined,
    DONE_WHEN: typeof DONE_WHEN !== 'undefined' ? DONE_WHEN : undefined,
    AnswersEngine: typeof AnswersEngine !== 'undefined' ? AnswersEngine : undefined,
    RECORD: typeof RECORD !== 'undefined' ? RECORD : undefined,
    RecordEngine: typeof RecordEngine !== 'undefined' ? RecordEngine : undefined,
    STORAGE_KEYS: SK, PrivacyEngine: PE,
    progressBar: typeof progressBar !== 'undefined' ? progressBar : undefined,
  };
  /* runs one page script; returns every piece of markup it wrote */
  function runPage(file, o){
    const log = [];
    const local = fakeStorage(o.local), session = fakeStorage(o.session);
    const location = {hash: o.hash || '', pathname: '/' + file, search: '', href: 'https://example.test/' + file + (o.hash || ''), replace(){}, reload(){}};
    const nav = (s, t, u) => { if (typeof u === 'string' && u.charAt(0) === '#'){ location.hash = u; } };
    const history = {state: null, pushState(s, t, u){ this.state = s; nav(s, t, u); }, replaceState(s, t, u){ this.state = s; nav(s, t, u); }, back(){}, forward(){}};
    const el = () => fakeEl(log);
    const document = {querySelector: el, getElementById: el, createElement: el, querySelectorAll: () => [],
      body: el(), head: el(), documentElement: el(), addEventListener(){}, currentScript: null, title: ''};
    const noop = () => {};
    const window = {localStorage: local, sessionStorage: session, location, history, document,
      addEventListener: noop, removeEventListener: noop, scrollTo: noop, print: noop,
      matchMedia: () => ({matches: false, addEventListener: noop}),
      navigator: {clipboard: {writeText: () => Promise.resolve()}},
      getSelection: () => ({removeAllRanges: noop, addRange: noop}),
      setTimeout: () => 0, clearTimeout: noop};
    const env = Object.assign({}, LIBS, window, {window});
    const run = (src, ret) => {
      const names = Object.keys(env);
      return new Function(names.join(','), src + (ret ? '\nreturn ' + ret + ';' : '')).apply(null, names.map(n => env[n]));
    };
    /* ui_common.js reads storage through window, so each page gets its own */
    env.UI = run(need('ui_common.js'), 'UI');
    run(need(file));
    return log.join('\n');
  }

  const BAD = '"\'><img src=x onerror=alert(1)>';
  const DAY = '2026-10-03';
  /* no <img> element in what the page wrote, and the payload shown as text where it is meant to appear */
  function clean(html, shown, where){
    ok(html.length > 0, where + ': the page wrote nothing');
    ok(!/<img/i.test(html), where + ': an <img> element got through');
    if (shown) ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), where + ': the text was not shown, escaped');
  }
  const PROFILE = {profile_version: 2, team_size: 'small', ai_use: ['use'], industry: ['retail'], finance_subtype: null, registration: null, it_support: null};
  const pkey = k => SK.prefix + k;
  function aiList(){
    const T = ToolEngine;
    const l = T.makeLine({mode: 'new', tool: BAD, plan: 'business', access: ['website'], use: 'writing', data: ['personal'], special: 'no',
      training: 'no_checked', deletion: 'yes', agreement: 'yes', published: 'yes', output: ['customers'], acts: ['produces_only']}, PROFILE, DAY);
    return {version: 1, lines: [T.refresh(l, PROFILE, DAY, false)], skipped: [BAD]};
  }
  function riskStore(){
    const st = RiskEngine.emptyStore();
    RiskEngine.addCustom(st, {title: BAD, type: 'used_against', impact: 'high', likelihood: 'moderate', control: BAD}, DAY);
    return st;
  }
  function quickHash(){
    const E = QuickEngine, state = {industry: 'retail', screener: {}, cards: [], none: false};
    E.screenerQuestions({industry: 'retail'}, {}).forEach(q => { state.screener[q.id] = 'no'; });
    state.screener = E.pruneScreener({industry: 'retail'}, state.screener);
    return '#' + E.encode(state);
  }

  /* ================= Delete everything ================= */

  test('delete everything: removes every key the site saved, in both kinds of storage, and nothing else', () => {
    const local = fakeStorage({}), session = fakeStorage({});
    SK.keys.forEach(k => (k.area === 'local' ? local : session).setItem(pkey(k.key), '{}'));
    local.setItem(pkey('from-an-older-version'), '1');
    local.setItem('another-site:profile', 'keep');
    session.setItem('sb-ai-playbook-without-colon', 'keep');
    const gone = PE.deleteAll({local, session});
    eq(gone.length, SK.keys.length + 1, 'items deleted');
    eq([...local._map.keys()], ['another-site:profile'], 'left in local storage');
    eq([...session._map.keys()], ['sb-ai-playbook-without-colon'], 'left in session storage');
    ok(gone.some(g => g.key === pkey('from-an-older-version') && /older version/.test(g.what)), 'an unlisted key is deleted and named');
    ok(gone.filter(g => g.area === 'session').length === SK.keys.filter(k => k.area === 'session').length, 'session items reported as session');
  });

  test('delete everything: lists what it deleted in the privacy page’s words, and copes with blocked storage', () => {
    const local = fakeStorage({[pkey('ai-list')]: '{}', [pkey('profile')]: '{}'});
    const gone = PE.deleteAll({local, session: null});
    eq(gone.map(g => g.what), [SK.keys.find(k => k.key === 'profile').what, SK.keys.find(k => k.key === 'ai-list').what], 'named, in the privacy page\u2019s order');
    const blocked = {get length(){ throw new Error('blocked'); }, key(){ throw new Error('blocked'); }};
    eq(PE.deleteAll({local: blocked, session: blocked}), [], 'blocked storage: nothing found, nothing thrown');
    eq(PE.found({local: fakeStorage({}), session: fakeStorage({})}), [], 'empty: nothing found');
  });

  test('delete everything: the privacy page asks first, then deletes and says what went', () => {
    const html = runPage('privacy.js', {local: {[pkey('quick')]: '{}', [pkey('profile')]: '{}'}, session: {[pkey('view')]: '[]'}});
    ok(html.includes('data-act="ask"') && html.includes('Delete everything this site saved'), 'the button is shown when something is saved');
    ok(/Saved now[\s\S]*Yes/.test(html), 'the table says what is saved now');
    const none = runPage('privacy.js', {});
    ok(none.includes('Nothing from this site is saved in this browser.') && !none.includes('data-act="ask"'), 'with nothing saved, no button');
    eq((none.match(/<tr>/g) || []).length, SK.keys.length, 'one row per key');
  });

  test('every key the code saves under is on the privacy page’s list, and every listed key is used', () => {
    const listed = new Set(SK.keys.map(k => k.key)), used = new Set();
    SCRIPTS.filter(f => f !== 'data/storage_keys.js').forEach(f => {
      const src = need(f);
      const re = /sb-ai-playbook:([^'"`\s]*)(['"`])?/g;
      let m;
      while ((m = re.exec(src))){
        if (!m[2] || !m[1]) { current.fails.push(`${f}: a key built while the page runs (sb-ai-playbook:${m[1]}...); list it in data/storage_keys.js`); continue; }
        used.add(m[1]);
        ok(listed.has(m[1]), `${f}: sb-ai-playbook:${m[1]} is not in data/storage_keys.js`);
      }
    });
    listed.forEach(k => ok(used.has(k), `data/storage_keys.js lists ${k}, which no script uses`));
  });

  /* ================= what every page carries ================= */

  test('every page: a content security policy that blocks sending, no referrer, and no inline script without its hash', () => {
    const scripts = new Set();
    PAGES.forEach(p => {
      const html = need(p);
      const head = html.slice(0, html.indexOf('</head>'));
      const csp = /<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="([^"]+)">\n<meta name="referrer" content="no-referrer">/.exec(head);
      if (!csp) return current.fails.push(p + ': the policy and referrer tags are missing or not straight after <meta charset>');
      const pol = csp[1];
      ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "font-src 'self'", "style-src 'self' 'unsafe-inline'"].forEach(d => ok(pol.includes(d), `${p}: ${d}`));
      ok(/script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')*;/.test(pol), p + ': script-src is the site and hashes only');
      ok(pol.includes(p === '404.html' ? "base-uri 'self'" : "base-uri 'none'"), p + ': base-uri');
      ok(!/\son[a-z]+=["']/i.test(html.replace(/<script>[\s\S]*?<\/script>/g, '')), p + ': an inline event handler attribute');
      const inline = (html.match(/<script>/g) || []).length;
      ok(inline === (pol.match(/'sha256-/g) || []).length, p + ': inline scripts and hashes do not match in number');
      (html.match(/<script src="[^"]+"/g) || []).forEach(s => scripts.add(s.slice(13, -1)));
    });
    scripts.forEach(s => ok(SCRIPTS.includes(s), 'a page loads ' + s + ', which the key scan does not read'));
  });

  test('every page links to the privacy page from its footer', () => {
    PAGES.forEach(p => {
      const html = need(p), foot = html.slice(html.lastIndexOf('<footer'), html.lastIndexOf('</footer>'));
      ok(foot.includes('href="privacy.html"'), p + ': no privacy link in the footer');
      ok(!/nothing (you (enter|type) )?is sent anywhere|leaves (this|your) browser|never send to a server/i.test(html), p + ': an absolute claim that nothing leaves the browser');
    });
  });

  /* ================= nothing typed becomes markup ================= */

  test('injection: a quick check address with markup in it writes no element', () => {
    clean(runPage('quick_check.js', {hash: '#' + BAD}), false, 'markup as the whole address');
    clean(runPage('quick_check.js', {hash: quickHash() + '&' + BAD + '=1&s=result'}), false, 'markup added to a real result');
    clean(runPage('quick_policy.js', {hash: '#' + BAD}), false, 'policy from a quick check address');
    clean(runPage('profile.js', {hash: '#' + BAD}), false, 'profile from a share link');
  });

  test('injection: text typed on the quick check and the policy is shown as text', () => {
    clean(runPage('quick_check.js', {hash: quickHash() + '&o=1&s=result', session: {[pkey('quick-other')]: BAD}, local: {[pkey('profile')]: JSON.stringify(PROFILE)}}), true, 'Something else');
    const a = PolicyEngine.initial(DAY, 'retail');
    Object.assign(a, {business: BAD, tools: [{name: BAD, account: 'business'}]});
    clean(runPage('quick_policy.js', {local: {[pkey('policy')]: JSON.stringify({a, saved_on: DAY, policy_version: POLICY.version})},
      session: {[pkey('policy-draft')]: JSON.stringify({a, step: 99, quick: null})}}), true, 'business and tool names in the policy');
  });

  test('injection: a tool name on the AI list, and a risk description, are shown as text', () => {
    const local = {[pkey('profile')]: JSON.stringify(PROFILE), [pkey('ai-list')]: JSON.stringify(aiList()), [pkey('risk')]: JSON.stringify(riskStore())};
    clean(runPage('tool_check.js', {local}), true, 'AI list');
    clean(runPage('risk_matrix.js', {local}), true, 'risk overview');
    const pulse = PulseEngine.emptyLog();
    pulse.checkins.push(Object.assign(PulseEngine.newCheckin(DAY), {incidents: [{text: BAD}]}));
    clean(runPage('record.js', {local: Object.assign({}, local, {[pkey('record')]: JSON.stringify({business: BAD}), [pkey('pulse')]: JSON.stringify(pulse)})}), true, 'record');
  });

  /* ================= sharing a link ================= */

  test('sharing: the quick check and profile links say they contain your answers, and offer a link without them', () => {
    const WARN = 'This link contains your answers. Anyone who opens it can read them.';
    const qc = runPage('quick_check.js', {hash: quickHash() + '&s=result', local: {[pkey('profile')]: JSON.stringify(PROFILE)}});
    ok(qc.includes(WARN), 'quick check: the warning');
    ok(qc.includes('data-act="copy-plain"'), 'quick check: copy the address without answers');
    const pr = runPage('profile.js', {hash: '#' + ProfileEngine.encode(PROFILE), local: {[pkey('profile')]: JSON.stringify(PROFILE)}});
    ok(pr.includes(WARN), 'profile: the warning');
    ok(pr.includes('data-act="copy-plain"'), 'profile: copy the address without answers');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} privacy tests passed`};
})();
