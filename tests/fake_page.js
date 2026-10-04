/* A stand-in page for the tests: runs a real page script (quick_check.js,
   tool_check.js and the rest) with its own storage, address and history,
   and returns every piece of markup the script wrote with innerHTML. Used
   by the privacy tests (no element gets through from what people type)
   and the industry tests (the Get advice banner).

   The page scripts are read as text, so this needs to read the site's
   files: under JavaScriptCore (tests/run_tests.sh) with readFile, under Node
   with fs, and in a browser from the site itself (opened from disk, it
   cannot, and the tests that need it say so). */

var FakePage = (function(){
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
    STORAGE_KEYS: typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS : undefined,
    PrivacyEngine: typeof PrivacyEngine !== 'undefined' ? PrivacyEngine : undefined,
    progressBar: typeof progressBar !== 'undefined' ? progressBar : undefined,
    PROGRESS: typeof PROGRESS !== 'undefined' ? PROGRESS : undefined,
    ProgressEngine: typeof ProgressEngine !== 'undefined' ? ProgressEngine : undefined,
  };
  /* runs one page script; returns every piece of markup it wrote */
  function runPage(file, o){
    const log = [];
    const local = fakeStorage(o.local), session = fakeStorage(o.session);
    const location = {hash: o.hash || '', pathname: '/' + file, search: '', href: 'https://example.test/' + file + (o.hash || ''), replace(){}, reload(){}};
    const nav = (s, t, u) => { if (typeof u === 'string' && u.charAt(0) === '#'){ location.hash = u; } };
    const history = {state: o.state || null, pushState(s, t, u){ this.state = s; nav(s, t, u); }, replaceState(s, t, u){ this.state = s; nav(s, t, u); }, back(){}, forward(){}};
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

  return {readSource, need, fakeStorage, runPage};
})();
