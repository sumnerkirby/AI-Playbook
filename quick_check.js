/* Quick check page: A (red-flag screener) then B (tap what you do).
   All decisions come from quick_engine.js and the data files; this script
   only draws screens and moves between them.

   Where state lives: the answers are in the address after the #, so the
   browser's back button undoes an answer, a reload resumes, and a result can
   be bookmarked or shared. Browsers never send the part after # to a server.
   Free text ("something else") never goes in the address; it stays in this
   tab, and in this browser only if the owner presses Save. */
(function(){
  const E = QuickEngine;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const main = $('#main'), root = $('#qc');

  const SAVE_KEY = 'sb-ai-playbook:quick';
  const OTHER_KEY = 'sb-ai-playbook:quick-other';

  /* storage can be missing or blocked; the page must work without it */
  const sget = (area, k) => { try { return window[area].getItem(k); } catch (e) { return null; } };
  const sset = (area, k, v) => { try { window[area].setItem(k, v); return true; } catch (e) { return false; } };
  const sdel = (area, k) => { try { window[area].removeItem(k); } catch (e) {} };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const today = () => new Date().toLocaleDateString('en-CA');
  const fmtDate = iso => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

  $('#rules-version').textContent = RULES.version;
  $('#rules-reviewed').textContent = fmtDate(RULES.last_reviewed);

  /* ---------- lights: shape + word, never colour alone ---------- */
  const ICON = {
    go: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="M5.6 10.4l2.9 2.9 5.9-6.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.2l9.2 17H.8z" fill="currentColor"/><path d="M10 7.2v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="15.1" r="1.3" fill="#fff"/></svg>',
    stop: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.3 1h7.4L19 6.3v7.4L13.7 19H6.3L1 13.7V6.3z" fill="currentColor"/><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };
  const LABEL = {go: 'Acceptable', check: 'Needs a check', stop: 'Stop'};
  const light = (l, text) => `<span class="light ${l}">${ICON[l]}${esc(text || LABEL[l])}</span>`;
  const WHO = {
    you: 'You can do this yourself',
    it_provider: 'You or your IT provider',
    supplier: 'Ask your supplier',
    advisor: 'Ask your advisor or compliance consultant',
  };

  /* ---------- state ---------- */
  let state = null;      // {industry, screener, cards, none} from the engine
  let extra = {};        // page-only: s (screen hint), o (something else)
  let otherText = sget('sessionStorage', OTHER_KEY) || '';
  let firstRender = true;

  function readHash(){
    const h = location.hash.replace(/^#/, '');
    state = E.decode(h);
    extra = {};
    h.split('&').forEach(kv => {
      const [k, v] = kv.split('=');
      if (k === 's' && ['tap', 'result'].includes(v)) extra.s = v;
      if (k === 'o' && v === '1') extra.o = true;
    });
  }
  function hashFor(s){
    if (!state) return location.pathname.split('/').pop() || 'quick_check.html';
    return '#' + E.encode(state) + (extra.o ? '&o=1' : '') + (s ? '&s=' + s : '');
  }
  function depth(){ return (history.state && history.state.qc) || 0; }
  /* move to the next screen; push makes the browser's back button undo it */
  function go(s, push = true){
    extra.s = s;
    if (push) history.pushState({qc: depth() + 1}, '', hashFor(s));
    else history.replaceState({qc: depth()}, '', hashFor(s));
    render();
  }
  const ctx = () => ({industry: state.industry});

  /* ---------- routing: the state decides the screen ---------- */
  function render(){
    const z = !state && zeroHere();
    root.classList.toggle('started', !!state || !!z);
    if (!state) return z ? showZero(z.zero, z.then) : showIntro();
    const c = ctx();
    if (!E.screenerComplete(c, state.screener)) return showScreenerQuestion();
    if (extra.s === 'tap') return showTap();
    const hasB = state.cards.length || state.none || extra.o;
    if (!hasB) return extra.s === 'result' ? showResult() : showFlags();
    const next = state.cards.find(cd => !E.cardComplete(cd.id, cd.answers));
    if (next) return showCardQuestion(next);
    showResult();
  }

  function screen(html){
    main.innerHTML = `<section class="screen">${html}</section>`;
    const h = $('h2', main);
    if (!firstRender){
      window.scrollTo(0, 0);
      if (h){ h.tabIndex = -1; h.focus({preventScroll: true}); }
    }
    firstRender = false;
  }
  const backRow = () => `<div class="backrow">${depth() > 0 ? '<button class="btn quiet" type="button" data-act="back">&larr; Back</button>' : ''}<button class="btn quiet" type="button" data-act="restart">Start again</button></div>`;

  /* ---------- intro ---------- */
  function loadSaved(){
    try { const s = JSON.parse(sget('localStorage', SAVE_KEY) || 'null'); return s && s.hash ? s : null; }
    catch (e) { return null; }
  }
  /* ---------- part 0: the business ----------
     The same questions as step 0 of the playbook (profile_engine.js), saved
     as the business profile. They come before part 1 until they have been
     answered, here or in the playbook, and part 1 takes its industry from
     them. Part 0 is not counted in the two parts or in part 1's questions.
     The question on screen is kept in its history entry, so Back works. */
  const PR = ProfileEngine, PROFILE_KEY = 'sb-ai-playbook:profile';
  let prof = (() => { try { return PR.clean(JSON.parse(sget('localStorage', PROFILE_KEY) || 'null')); } catch (e) { return PR.blank(); } })();
  let chosenIndustry = prof.industry[0] || null;
  let zeroAt = null;   // {id, then}: the part 0 question on screen, and where it leads
  const zeroHere = () => history.state && history.state.zero ? history.state : null;
  /* does this industry get a question or card of its own? */
  const industryHasExtras = id => SCREENER.questions.concat(CARDS.cards)
    .some(x => x.applies_to && [].concat(x.applies_to.industry || []).includes(id));
  /* part 1's length depends on the industry (some add a question), so the intro says the exact number */
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const redFlagCount = () => WORDS[E.screenerQuestions({industry: chosenIndustry}, {}).length] || 'Several';
  function syncRedFlagCount(){
    const w = redFlagCount();
    $$('.q-count').forEach(el => { el.textContent = el.classList.contains('cap') ? w[0].toUpperCase() + w.slice(1) : w; });
  }
  function showIntro(){
    const saved = loadSaved();
    const done0 = PR.zeroComplete(prof);
    screen(`
      ${saved ? `<div class="callout resume"><span class="k">Saved in this browser</span>
        <p>You saved a quick check on ${esc(fmtDate(saved.saved_on))}.${saved.rules_version !== RULES.version ? ' The rules have changed since then, so it will be checked again against the current rules.' : ''}</p>
        <p><button class="btn" type="button" data-act="resume">Open it</button> <button class="btn quiet" type="button" data-act="forget">Delete it</button></p></div>` : ''}
      <div class="parts three">
        <div class="part" style="--c:var(--ink)"><span class="k">Part 0 &middot; under a minute</span><span class="t">Your business</span>${done0
          ? `<p>Answered: ${esc(PR.summary(prof).join(' · '))}. <button class="linkish" type="button" data-act="zero-change">Change</button></p>`
          : `<p>Three questions, asked once. The playbook and the other tools use the same answers.</p>`}</div>
        <div class="part" style="--c:var(--part3)"><span class="k">Part 1 &middot; 2 minutes</span><span class="t">Red flags</span><p><span class="q-count cap">${redFlagCount()}</span> questions, each answered yes, no or not sure, about the situations most likely to cause harm.</p></div>
        <div class="part" style="--c:var(--part2)"><span class="k">Part 2 &middot; 5 to 8 minutes</span><span class="t">Everyday tasks</span><p>Select the tasks in which AI is used, answer one or two questions about each, and see which need attention.</p></div>
      </div>
      <div class="go-row"><button class="btn primary" type="button" data-act="start">${done0 ? 'Start part 1' : 'Start part 0'}</button><span class="small-note">No sign-up. No email.</span></div>
      <p class="privacy"><span aria-hidden="true">&#9679;</span><span><b>Nothing you enter is sent to us or to anyone else.</b> There are no accounts and no tracking. The answers about your business are saved in this browser for the rest of the site. The other answers are kept in this page&rsquo;s address, so that you can bookmark the result. That puts them in your browser history and in any link you copy. They are saved in this browser only if you choose. <a href="privacy.html">Privacy and your data</a></span></p>
    `);
    syncRedFlagCount();
  }

  /* ---------- part 0: one question per screen ---------- */
  function showZero(id, then){
    const q = PR.zeroQuestion(id), list = PR.zeroSteps(prof);
    if (!q || !list.includes(id)) return showIntro();
    const chosen = PR.zeroValue(prof, id);
    zeroAt = {id, then};
    onAnswer = null;
    screen(`
      ${progressBar({left: '<b>Part 0</b> &middot; Your business', n: list.indexOf(id) + 1, total: list.length})}
      <div class="qhead"><h2 id="q-h">${esc(q.label)}</h2></div>
      <p class="example">${esc(q.why)}</p>
      <div class="answers${q.multi ? ' multi' : ''}" role="group" aria-labelledby="q-h">
        ${q.options.map(o => `<button type="button" class="answer" data-zero="${o.id}" aria-pressed="${chosen.includes(o.id)}">${esc(o.label)}${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}
      </div>
      ${q.multi ? `<div class="go-row" style="margin-top:16px"><button class="btn primary" type="button" data-act="zero-next"${chosen.length ? '' : ' disabled'}>Next</button></div>` : ''}
      ${backRow()}
    `);
  }
  function goZero(id, then){
    history.pushState({qc: depth() + 1, zero: id, then}, '', hashFor());
    render();
  }
  function answerZero(v){
    const {id} = zeroAt, q = PR.zeroQuestion(id);
    prof = PR.zeroAnswer(prof, id, v);
    sset('localStorage', PROFILE_KEY, JSON.stringify(prof));
    chosenIndustry = prof.industry[0] || null;
    syncRedFlagCount();
    if (window.ProfileBar) ProfileBar.refresh();
    /* several answers: stay on this question until Next */
    if (q.multi){
      const chosen = PR.zeroValue(prof, id);
      $$('[data-zero]', main).forEach(b => b.setAttribute('aria-pressed', chosen.includes(b.dataset.zero)));
      $('[data-act="zero-next"]', main).disabled = !chosen.length;
      return;
    }
    nextZero();
  }
  /* changing the answers walks through every question; starting asks only what is missing */
  function nextZero(){
    const {id, then} = zeroAt, list = PR.zeroSteps(prof);
    const next = then === 'intro' ? list[list.indexOf(id) + 1] : list.find(x => !PR.zeroValue(prof, x).length);
    if (next) return goZero(next, then);
    if (then === 'intro'){ history.pushState({qc: depth() + 1}, '', hashFor()); return render(); }
    startPart1();
  }
  function startPart1(){
    state = {industry: chosenIndustry, screener: {}, cards: [], none: false};
    extra = {};
    go();
  }

  /* ---------- one question per screen ---------- */
  let onAnswer = null;
  function ask(o){
    const q = o.q;
    onAnswer = o.onAnswer;
    screen(`
      ${progressBar({left: o.left, n: o.n, total: o.total, frac: o.frac})}
      <div class="qhead">${o.about ? `<p class="about">${esc(o.about)}</p>` : ''}<h2 id="q-h">${o.about ? `<span class="visually-hidden">${esc(o.about)}: </span>` : ''}${fmt(q.text)}</h2></div>
      ${q.example ? `<p class="example"><b>For example</b>${esc(q.example)}</p>` : ''}
      ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
      <div class="answers" role="group" aria-labelledby="q-h">
        ${q.answers.map(a => `<button type="button" class="answer${a.id === 'not_sure' ? ' unsure' : ''}" data-answer="${a.id}">${esc(a.label)}${a.detail ? `<small>${esc(a.detail)}</small>` : ''}</button>`).join('')}
      </div>
      ${backRow()}
    `);
  }

  function showScreenerQuestion(){
    const c = ctx();
    const qs = E.screenerQuestions(c, state.screener);
    const i = qs.findIndex(q => state.screener[q.id] === undefined);
    const q = qs[i];
    ask({
      q,
      left: `<b>Part 1</b> &middot; Red flags`,
      n: i + 1, total: qs.length,
      onAnswer: id => {
        state.screener[q.id] = id;
        state.screener = E.pruneScreener(c, state.screener);
        go();
      },
    });
  }

  function showCardQuestion(cd){
    const def = E.card(cd.id);
    const qs = E.cardQuestions(cd.id, cd.answers);
    const i = qs.findIndex(q => cd.answers[q.id] === undefined);
    const n = state.cards.indexOf(cd);
    /* progress by task, whose number is fixed once the tasks are picked; a
       follow-up question moves the bar a little within the task, never back */
    ask({
      q: qs[i],
      about: def.label,
      left: `<b>Part 2</b> &middot; Task ${n + 1} of ${state.cards.length}`,
      frac: (n + i / qs.length) / state.cards.length,
      onAnswer: id => {
        cd.answers[qs[i].id] = id;
        cd.answers = E.pruneCard(cd.id, cd.answers);
        go();
      },
    });
  }

  /* ---------- findings ---------- */
  function basis(rule){
    const s = (rule.sources || []).map(id => RULE_SOURCES[id]).filter(Boolean);
    if (!s.length) return '';
    return `<p class="basis">Based on: ${s.map(x => x.href ? `<a href="${x.href}">${esc(x.title)}</a>` : esc(x.title)).join('; ')}</p>`;
  }
  function advice(rule){
    if (rule.flag !== 'get_advice') return '';
    return `<p class="advice"><b>Get advice</b>${esc(rule.flag_text || 'Check this with a professional before relying on it.')}</p>`;
  }
  /* compact: the summary repeats what to do, not why (already read in part 1) */
  function screenerFinding(h, compact){
    const stop = h.outcome === 'stop';
    return `<div class="finding ${h.outcome}">
      ${light(h.outcome, stop ? 'Stop now' : 'Find out')}
      <h3>${esc(h.title)}</h3>
      ${compact ? '' : `<p>${stop ? '<b>Why it matters:</b> ' : ''}${esc(h.reason)}</p>`}
      <p class="fix"><b>${stop ? 'Fix now:' : 'How to check (about 5 minutes):'}</b> ${esc(h.fix)}<span class="who">${esc(WHO[h.owner])}</span></p>
      ${advice(h)}
      <p><a href="${h.how.href}">${esc(h.how.label)}</a></p>
      ${compact ? '' : basis(h)}
    </div>`;
  }
  function screenerFindings(r, compact){
    if (!r.hits.length) return `<div class="okbox">${light('go', 'No red flags')}
      <h3>No red flags found in this quick check.</h3>
      <p>This looked at the situations most likely to cause serious harm. It did not examine which AI tools you use, what their suppliers do with your information, or whether AI output is checked before use.</p></div>`;
    return r.hits.map(h => screenerFinding(h, compact)).join('');
  }

  /* ---------- A result ---------- */
  function showFlags(){
    const r = E.evaluateScreener(ctx(), state.screener);
    const stops = r.hits.filter(h => h.outcome === 'stop').length;
    const checks = r.hits.length - stops;
    screen(`
      <p class="step-label"><b>Part 1 &middot; Result</b></p>
      <h2>${stops ? `${plural(stops, 'red flag')} to fix now` : checks ? `No red flags confirmed yet: ${plural(checks, 'thing')} to find out first` : 'No red flags found'}</h2>
      <p class="honest">Quick check, not a full review</p>
      ${screenerFindings(r)}
      <div class="go-row" style="margin-top:24px">
        <button class="btn primary" type="button" data-act="to-tap">Next: everyday tasks (5 to 8 minutes)</button>
        <button class="btn quiet" type="button" data-act="stop-here">Stop here and see the summary</button>
      </div>
      ${backRow()}
    `);
  }

  /* ---------- B: tap what you do ---------- */
  /* industry cards first: they're the most likely to apply */
  function tapOrder(){
    const cards = E.cardsFor(ctx());
    return cards.filter(c => c.applies_to).concat(cards.filter(c => !c.applies_to));
  }
  function showTap(){
    const on = id => state.cards.some(x => x.id === id);
    const btn = c => `<button type="button" class="tapcard${c.applies_to ? ' industry' : ''}" data-card="${c.id}" aria-pressed="${on(c.id)}">
        <span class="t">${esc(c.label)}</span><span class="h">${esc(c.hint)}</span><span class="box" aria-hidden="true"></span></button>`;
    const nudge = CARDS.none_nudge;
    screen(`
      <p class="step-label"><b>Part 2 &middot; Everyday tasks</b></p>
      <h2>In which of these tasks does anyone in your business use AI?</h2>
      <p class="example">Select every task in which anyone uses AI, even occasionally. The note on each card says where AI is often found.</p>
      <div class="tapgrid rows" role="group" aria-label="Everyday tasks">${tapOrder().map(btn).join('')}</div>
      <div class="tapextra rows">
        <button type="button" class="tapcard" data-other aria-pressed="${!!extra.o}"><span class="t">Something else</span><span class="h">Anything not listed</span><span class="box" aria-hidden="true"></span></button>
        <button type="button" class="tapcard" data-none aria-pressed="false"><span class="t">None of these</span><span class="h">We do not use AI for any of these</span></button>
      </div>
      <div class="othertext"${extra.o ? '' : ' hidden'}>
        <label for="other-in">What else? (Optional. It is listed on your result but not checked here. This text never leaves this browser.)</label>
        <input id="other-in" type="text" maxlength="120" autocomplete="off" value="${esc(otherText)}">
      </div>
      <div class="callout nudge" hidden>
        <span class="k">Before you move on</span>
        <p>${esc(nudge.text)}</p>
        <ul>${nudge.places.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        <p><button class="btn" type="button" data-act="look-again">Look again</button> <button class="btn quiet" type="button" data-act="none-confirm">None of these apply</button></p>
      </div>
      <div class="sticky-go">
        <button class="btn primary" type="button" data-act="tap-continue"></button>
        ${depth() > 0 ? '<button class="btn quiet" type="button" data-act="back">&larr; Back</button>' : ''}
      </div>
    `);
    syncTap();
  }
  function syncTap(){
    /* counts only the tasks that get questions, so it matches Task 1 of n; Something else has none */
    const n = state.cards.length;
    const b = $('[data-act="tap-continue"]', main);
    b.textContent = n ? `Continue with ${plural(n, 'task')}` : extra.o ? 'Continue' : 'Select at least one, or None of these';
    b.disabled = !n && !extra.o;
  }
  /* taps update in place, so the grid doesn't jump back to the top */
  function toggleCard(id){
    const order = tapOrder().map(c => c.id);
    const on = !state.cards.some(c => c.id === id);
    if (on) state.cards.push({id, answers: {}});
    else state.cards = state.cards.filter(c => c.id !== id);
    state.cards.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    state.none = false;
    history.replaceState({qc: depth()}, '', hashFor('tap'));
    $(`[data-card="${id}"]`, main).setAttribute('aria-pressed', on);
    syncTap();
  }
  function toggleOther(){
    extra.o = !extra.o;
    state.none = false;
    history.replaceState({qc: depth()}, '', hashFor('tap'));
    $('[data-other]', main).setAttribute('aria-pressed', !!extra.o);
    $('.othertext', main).hidden = !extra.o;
    if (extra.o) $('#other-in').focus();
    syncTap();
  }

  /* ---------- the result ---------- */
  function cardFinding(x){
    const {cd, def, r} = x;
    const answerText = E.cardQuestions(cd.id, cd.answers)
      .map(q => `${esc(q.short)}: <b>${esc(q.answers.find(a => a.id === cd.answers[q.id]).label)}</b>`).join(' &middot; ');
    const reasons = r.light === 'go'
      ? `<p>Nothing in your answers needs a change.</p><p class="small-note">Supplier not checked: the quick check does not ask what the supplier does with your information.</p>`
      : `<ul class="reasons">${r.hits.map(h => `<li>
          ${h.outcome !== r.light ? light(h.outcome) + ' ' : ''}${esc(h.reason)}
          <p class="fix"><b>${h.outcome === 'stop' ? 'Fix:' : 'Next step:'}</b> ${esc(h.fix)}<span class="who">${esc(WHO[h.owner])}</span></p>
          ${advice(h)}
          <p><a href="${h.how.href}">${esc(h.how.label)}</a></p>
        </li>`).join('')}</ul>`;
    return `<div class="finding ${r.light}" id="r-${cd.id}">
      <div class="top">${light(r.light)}<button class="btn quiet change" type="button" data-change="${cd.id}">Change answers</button></div>
      <h3 tabindex="-1">${esc(def.label)}</h3>
      <p class="said">You said: ${answerText}</p>
      ${reasons}
    </div>`;
  }

  function showResult(){
    const c = ctx();
    const A = E.evaluateScreener(c, state.screener);
    const rank = {stop: 0, check: 1, go: 2};
    const cards = state.cards.map(cd => ({cd, def: E.card(cd.id), r: E.evaluateCard(cd.id, cd.answers, c)}));
    const t = E.tally(cards.map(x => x.r));
    const sorted = cards.slice().sort((a, b) => rank[a.r.light] - rank[b.r.light]);
    const stops = A.hits.filter(h => h.outcome === 'stop').length + t.stop;
    const checks = A.hits.filter(h => h.outcome === 'check').length + t.check;
    const ind = PROFILE_OPTIONS.industry.options.find(o => o.id === state.industry);
    const didB = state.cards.length || state.none || extra.o;

    /* says where the headline numbers come from, in the words the findings below use */
    const aStops = A.hits.filter(h => h.outcome === 'stop').length;
    const aChecks = A.hits.length - aStops;
    const tallyA = A.hits.length
      ? [aStops && `${aStops} to fix now`, aChecks && `${aChecks} to find out`].filter(Boolean).join(', ')
      : 'none';
    const tallyB = state.none ? 'none selected'
      : [t.stop && `${t.stop} stop`, t.check && plural(t.check, 'needs a check', 'need a check'), t.go && `${t.go} acceptable`, extra.o && '1 not checked'].filter(Boolean).join(', ');
    const breakdown = `<p class="breakdown">Red flags: ${tallyA}.${didB ? ` Everyday tasks: ${tallyB}.` : ''}</p>`;

    let partB;
    if (!didB) partB = `<p>You stopped after part 1.</p><p><button class="btn" type="button" data-act="to-tap">Do part 2 now (5 to 8 minutes)</button></p>`;
    else if (state.none) partB = `<div class="finding"><h3>No tasks selected</h3>
      <p>That is possible, but AI is often added without anyone choosing it: in email, video calls, browser add-ons and the software the business already pays for. Working through <a href="playbook.html#step-2">step 2 of the playbook</a> is the most reliable way to confirm it.</p></div>`;
    else {
      const n = cards.length + (extra.o ? 1 : 0);
      partB = `
        <p class="counts"><span>${plural(n, 'task')} with AI:</span>
          ${light('go', t.go + ' acceptable')} ${light('check', plural(t.check, 'needs a check', 'need a check'))} ${light('stop', t.stop + ' stop')}${extra.o ? ' <span class="light none">1 not checked</span>' : ''}</p>
        <div class="resultgrid">${sorted.map(x => `<button type="button" class="resultcell ${x.r.light}" data-jump="r-${x.cd.id}">${light(x.r.light)}<span class="t">${esc(x.def.label)}</span></button>`).join('')}</div>
        ${sorted.map(cardFinding).join('')}
        ${extra.o ? `<div class="finding"><span class="light none">Not checked</span><h3>Something else${otherText ? ': ' + esc(otherText) : ''}</h3><p>Not checked here. Add it when you complete the full check of your AI tools.</p></div>` : ''}`;
    }

    screen(`
      <p class="step-label"><b>Your quick check</b><span>${esc(fmtDate(today()))}</span>${ind ? `<span>${esc(ind.label)}</span>` : ''}</p>
      <h2>${stops ? `${plural(stops, 'thing')} to stop now${checks ? `, ${plural(checks, 'needs a check', 'need a check')}` : ''}`
        : !t.check && aChecks ? `No red flags confirmed yet: ${plural(aChecks, 'thing')} to find out first`
        : checks ? `Nothing to stop, ${plural(checks, 'thing needs a check', 'things need a check')}` : 'Nothing to stop or check in the areas covered'}</h2>
      ${breakdown}
      <p class="honest">Quick check, not a full review</p>
      ${ind && PR.adviceBanners([ind.id]).length ? PR.adviceHTML([ind.id], esc)
        : ind && (CARDS.industry_advice || {})[ind.id] ? `<p class="advice"><b>Get advice</b>${esc(CARDS.industry_advice[ind.id])}</p>`
        : ind && !industryHasExtras(ind.id) ? `<p class="small-note ind-general">${esc(CARDS.industry_general)}</p>` : ''}

      ${didB
        ? `<h3 class="subhead">Part 2: everyday tasks</h3>${partB}<h3 class="subhead">Part 1: red flags</h3>${screenerFindings(A, true)}`
        : `<h3 class="subhead">Part 1: red flags</h3>${screenerFindings(A)}<h3 class="subhead">Part 2: everyday tasks</h3>${partB}`}

      <h3 class="subhead">What this check does not cover</h3>
      <ul class="notlooked">
        <li>Which tools and plans you use, by name. One task can involve more than one tool.</li>
        <li>What suppliers do with your information: whether they train on it, whether you can delete it, and data agreements.</li>
        <li>AI that nobody mentioned. Browser add-ons and features in specialist software are easy to miss.</li>
        <li>Whether AI output is checked before use.</li>
        <li>Anything you set up or built yourself, apart from the question about public assistants.</li>
      </ul>

      <h3 class="subhead">Next</h3>
      ${nextSteps(t, A)}

      <h3 class="subhead">Keep this</h3>
      <div class="actions">
        <button class="btn" type="button" data-act="print">Print or save as PDF</button>
        <button class="btn" type="button" data-act="copy">Copy link</button>
        <button class="btn" type="button" data-act="save">Save in this browser</button>
      </div>
      <p class="share-warn">This link contains your answers. Anyone who opens it can read them. <button class="linkish" type="button" data-act="copy-plain">Copy the address without answers</button></p>
      <p class="status" id="status" role="status"></p>
      ${backRow()}
    `);
  }

  /* ---------- next: a short plan in order (site critique U1): fix what is
     urgent, write the policy, then check the most-used tool ---------- */
  function nextSteps(t, A){
    const policyHref = `quick_policy.html#${E.encode(state)}`;
    const aStops = A.hits.filter(h => h.outcome === 'stop').length;
    const fixes = aStops + t.stop, opens = (A.hits.length - aStops) + t.check;
    const things = n => n === 1 ? 'one thing' : n + ' things';
    const steps = [];
    if (fixes || opens) steps.push({time: fixes ? 'a few minutes each' : 'about 5 minutes each', c: 'var(--ink)',
      h: fixes ? `Fix the ${things(fixes)} to stop now`
        : !t.check ? `Find out the ${things(opens)} you were not sure about` : `Look into the ${things(opens)} that ${opens === 1 ? 'needs' : 'need'} a check`,
      p: `Each finding above says what to do and who can do it.${fixes && opens ? ` Then the ${things(opens)} to find out or check.` : ''}`});
    steps.push({time: '8 to 10 minutes', c: 'var(--part3)', btn: '#9A5A2F', h: `Write your AI policy`,
      p: `About twelve questions, some already answered by this check. The result is a one-page policy to share with staff, and a list of what must never go into an AI tool.`,
      act: `<a class="start-btn" href="${policyHref}">Start my AI policy</a>`});
    steps.push({time: '5 to 15 minutes a tool', c: 'var(--part2)', h: `Check the tool you use most`,
      p: `Your AI list shows what this check found, most serious first. Checking a tool there gives it a to-do list and adds it to your record. This saves the result in this browser.`,
      act: `<button class="start-btn" type="button" data-act="save-go">Save and open my AI list</button>`});
    const later = [
      `<a href="quick_pulse.html">Keep it current</a><span>1 minute a month, with a calendar reminder</span>`,
      `<a href="playbook.html#step-2">List all the AI tools in use</a><span>Playbook step 2, which covers what this check cannot</span>`,
      `<a href="policy-supplier-questions.html">Questions to ask a supplier</a><span>Template, for anything marked needs a check</span>`,
    ];
    /* First, Then, After that: not Step, so these are not confused with the
       playbook's steps or the essentials on Your progress */
    return `<p class="plan-intro">In this order:</p>
      <ol class="plan">${steps.map((x, n) => `<li class="start next-card" style="--c:${x.c}${x.btn ? `;--btn:${x.btn}` : ''}">
        <span class="k">${['First', 'Then', 'After that'][n]} &middot; ${x.time}</span><h4>${x.h}</h4><p>${x.p}</p>${x.act || ''}</li>`).join('')}</ol>
      <p class="status" id="next-status" role="status"></p>
      <h4 class="also-head">Later</h4>
      <ul class="also">${later.map(x => `<li>${x}</li>`).join('')}</ul>`;
  }
  function saveAndGo(){
    if (sset('localStorage', SAVE_KEY, JSON.stringify(record()))) return void (location.href = 'tool_check.html');
    $('#next-status').textContent = 'This browser is blocking storage, so nothing was saved. Use Copy link or Print instead.';
  }

  /* ---------- keep: save, copy ---------- */
  function say(msg){ const s = $('#status'); if (s) s.textContent = msg; }
  function record(){
    return Object.assign(E.carryOver(state, today()), {hash: hashFor(), other: extra.o ? otherText : null});
  }
  function save(){
    const ok = sset('localStorage', SAVE_KEY, JSON.stringify(record()));
    say(ok ? 'Saved in this browser only. Clearing your browser data deletes it.' : 'This browser is blocking storage, so nothing was saved. Use Copy link or Print instead.');
  }
  async function copyLink(){
    try {
      await navigator.clipboard.writeText(location.href);
      say('Link copied. Anyone with it sees your answers, but not anything you typed.');
    } catch (e) {
      say('Copy the address from your browser’s address bar. Anyone with it sees your answers, but not anything you typed.');
    }
  }
  async function copyPlain(){
    const plain = location.href.split('#')[0];
    try {
      await navigator.clipboard.writeText(plain);
      say('Address copied, without your answers.');
    } catch (e) {
      say('This browser blocked copying. The address without answers is ' + plain);
    }
  }

  /* ---------- events ---------- */
  main.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.answer && onAnswer) return onAnswer(t.dataset.answer);
    if (t.dataset.zero && zeroAt) return answerZero(t.dataset.zero);
    if (t.dataset.card) return toggleCard(t.dataset.card);
    if (t.hasAttribute('data-other')) return toggleOther();
    if (t.hasAttribute('data-none')){
      const n = $('.nudge', main);
      n.hidden = false;
      n.scrollIntoView({block: 'nearest'});
      $('button', n).focus({preventScroll: true});
      return;
    }
    if (t.dataset.jump){
      const el = document.getElementById(t.dataset.jump);
      el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
      $('h3', el).focus({preventScroll: true});
      return;
    }
    if (t.dataset.change){
      const cd = state.cards.find(c => c.id === t.dataset.change);
      cd.answers = {};
      return go();
    }
    switch (t.dataset.act){
      case 'start': {
        const missing = PR.zeroSteps(prof).find(x => !PR.zeroValue(prof, x).length);
        return missing ? goZero(missing, 'part1') : startPart1();
      }
      case 'zero-change': return goZero('team', 'intro');
      case 'zero-next': return nextZero();
      case 'resume': {
        const saved = loadSaved();
        otherText = saved.other || '';
        history.pushState({qc: depth() + 1}, '', '#' + saved.hash.replace(/^#/, ''));
        readHash();
        return render();
      }
      case 'forget': sdel('localStorage', SAVE_KEY); return render();
      case 'back': return history.back();
      case 'restart':
        state = null; extra = {}; otherText = '';
        sdel('sessionStorage', OTHER_KEY);
        history.pushState({qc: depth() + 1}, '', hashFor());
        return render();
      case 'to-tap': return go('tap');
      case 'stop-here': return go('result');
      case 'look-again': $('.nudge', main).hidden = true; return $('.tapgrid button', main).focus();
      case 'none-confirm':
        state.cards = []; state.none = true; extra.o = false;
        return go();
      case 'tap-continue': return go();
      case 'print': return window.print();
      case 'copy': return copyLink();
      case 'copy-plain': return copyPlain();
      case 'save': return save();
      case 'save-go': return saveAndGo();
    }
  });
  main.addEventListener('input', e => {
    if (e.target.id !== 'other-in') return;
    otherText = e.target.value;
    sset('sessionStorage', OTHER_KEY, otherText);
  });
  window.addEventListener('popstate', () => { readHash(); render(); });

  readHash();
  render();
})();
