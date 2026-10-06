/* The full tool check and the AI list: the page. tool_engine.js and the
   data files decide everything; this script asks and draws.

   Views: the list, a question, a result (for a check not yet saved), and a
   line (a saved use, with its to-dos and its life: re-checks, change events,
   waiting on a supplier, retiring). Each view goes into the browser's
   history, so Back undoes a step.
   Where state lives: the AI list is kept in this browser (localStorage),
   with backup, restore and a spreadsheet export. Nothing goes in the
   address. */
(function(){
  const T = ToolEngine, Q = TOOL_QUESTIONS, R = TOOL_RULES, U = UI, PR = ProfileEngine;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const main = $('#main'), root = $('#qc');
  const esc = U.esc;
  const KEY = 'sb-ai-playbook:ai-list';
  $('#rules-version').textContent = R.version;
  $('#rules-reviewed').textContent = U.fmtDate(R.last_reviewed);

  const P = PR.clean(U.store.get('sb-ai-playbook:profile'));
  const hasProfile = PR.complete(P);

  /* ---------- the list ---------- */
  function loadList(){
    const raw = U.store.get(KEY);
    if (!raw) return {version: 1, lines: [], skipped: []};
    try {
      return {version: 1, lines: T.restore(raw, P, U.today()).lines,
        skipped: Array.isArray(raw.skipped) ? raw.skipped.filter(s => typeof s === 'string').slice(0, 500) : []};
    } catch (e) { return {version: 1, lines: [], skipped: []}; }
  }
  let list = loadList();
  const saveList = () => U.store.set(KEY, list);
  const lineById = id => list.lines.find(l => l.id === id);
  const evalLine = l => T.evaluate(Object.assign({}, l.answers, {_evidence: l.evidence}), P, l.done);
  const savedQuick = () => ({quick: U.store.get('sb-ai-playbook:quick'), policy: U.store.get('sb-ai-playbook:policy'), pulse: U.store.get('sb-ai-playbook:pulse')});

  /* ---------- views and history ---------- */
  let view = {name: 'list'};
  let firstRender = true;
  const clone = o => JSON.parse(JSON.stringify(o));
  /* Each check has a key, and the keys of saved checks are kept for this
     tab. Back and Forward step over the questions of a check that is already
     saved, because answering them again would save it a second time. Each
     history entry carries its position, which tells Back from Forward. */
  let pos = 0;
  const SAVED_KEY = 'sb-ai-playbook:tool-saved';
  const savedChecks = () => U.store.get(SAVED_KEY, 'sessionStorage') || {};
  const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const savedLine = v => (v.name === 'ask' || v.name === 'result') && v.draft && v.draft.key ? savedChecks()[v.draft.key] : null;
  const put = v => history.replaceState({tc: clone(v), i: pos}, '');
  function goto(v, push = true){
    view = v;
    if (push){ pos++; history.pushState({tc: clone(view), i: pos}, ''); }
    else put(view);
    render();
  }
  window.addEventListener('popstate', e => {
    if (!e.state || !e.state.tc) return;
    const back = (e.state.i || 0) < pos;
    pos = e.state.i || 0;
    list = loadList();
    if (savedLine(e.state.tc)) return back ? history.back() : history.forward();
    view = e.state.tc;
    render();
  });
  if (history.state && history.state.tc){ view = history.state.tc; pos = history.state.i || 0; }
  /* reloaded on a check that is already saved: show the saved use */
  const id0 = savedLine(view);
  if (id0) view = lineById(id0) ? {name: 'line', lineId: id0} : {name: 'list'};
  put(view);

  function render(focusSel){
    root.classList.toggle('started', view.name !== 'list');
    ({list: renderList, ask: renderAsk, result: renderResult, line: renderLine}[view.name] || renderList)();
    if (focusSel){ const el = $(focusSel, main); if (el){ el.focus(); return; } }
    if (!firstRender){
      window.scrollTo(0, 0);
      const h = $('h2', main);
      if (h){ h.tabIndex = -1; h.focus({preventScroll: true}); }
    }
    firstRender = false;
  }
  function say(msg){ const s = $('#status'); if (s) s.textContent = msg; }
  function announce(msg){ $('#announce').textContent = msg; }

  /* ---------- labels ---------- */
  const qById = id => Q.questions.find(q => q.id === id);
  function answerText(q, v){
    if (q.kind === 'text') return v;
    const labels = (Array.isArray(v) ? v : [v]).map(x => (q.options.find(o => o.id === x) || {}).label).filter(Boolean);
    return labels.join('; ');
  }
  const planLabel = id => answerText(qById('plan'), id);
  const shortLight = st => ({red: st.state === 'paused' ? 'Paused' : 'Stop', amber: 'To-dos', green: 'Go'})[st.light];

  /* ================= the list ================= */
  function renderList(){
    const today = U.today();
    const active = list.lines.filter(l => !l.retired_on);
    const rows = list.lines.map(l => ({l, st: T.state(l, P, today), r: evalLine(l)}));
    const order = x => x.st.state === 'retired' ? 9 : (x.st.due ? 0 : 1) + ({red: 1, amber: 2, green: 3})[x.r.light];
    rows.sort((a, b) => order(a) - order(b));
    const n = {green: 0, amber: 0, red: 0};
    rows.filter(x => x.st.state !== 'retired').forEach(x => { n[x.r.light]++; });
    const due = rows.filter(x => x.st.due).length, waiting = rows.filter(x => x.st.waiting).length;
    const queue = T.queue(savedQuick(), list.lines, list.skipped);

    main.innerHTML = `<section class="screen">
      ${hasProfile ? '' : `<div class="callout" style="max-width:760px;margin-bottom:16px"><span class="k">Answer three questions first</span><p>Some checks depend on your business: your team size, whether you set up your own AI tools, and your industry. <a href="profile.html">Your business profile</a> takes less than a minute.</p></div>`}
      <div class="go-row">
        <button class="btn primary" type="button" data-act="new">Check a new tool</button>
        <button class="btn" type="button" data-act="found">Check one already in use</button>
      </div>

      ${queue.length ? `<h2 class="subhead">To check (${queue.length})</h2>
        <p class="example">Found by your quick check, your policy and your monthly check-ins, with the likely most serious first.</p>
        ${queue.slice(0, 12).map(i => `<div class="q-item">${U.light(i.light, i.light ? ({stop: 'Stop', check: 'Check', go: 'Go', red: 'Stop', amber: 'Check', green: 'Go'})[i.light] : 'To check')}
          <span class="n"><b>${esc(i.label)}</b><small>${esc(i.source)}${i.account === 'personal' ? ' &middot; personal account' : ''}${i.can_act && i.can_act !== 'no' ? ' &middot; can act' : ''}</small></span>
          <button class="btn" type="button" data-queue="${esc(i.key)}">Check it</button>
          <button class="btn quiet" type="button" data-skip="${esc(i.key)}">Not needed</button></div>`).join('')}` : ''}

      <h2 class="subhead">Your AI list</h2>
      ${rows.length ? `<p class="counts-row"><span>${active.length} use${active.length === 1 ? '' : 's'}:</span>
          ${U.light('green', n.green + ' go')} ${U.light('amber', n.amber + ' with to-dos')} ${U.light('red', n.red + ' stopped or paused')}
          ${due ? `<span class="badge due">${due} re-check${due > 1 ? 's' : ''} due</span>` : ''}${waiting ? ` <span class="badge wait">${waiting} waiting on a supplier</span>` : ''}</p>
        <p><a class="btn" href="risk_matrix.html">See your risk overview</a> <span class="small-note">Where your risk is across all of these, and what to deal with first.</span></p>
        <ul class="lines">${rows.map(({l, st, r}) => {
          const open = r.todos.filter(t => !t.done).length;
          return `<li class="line">${st.state === 'retired' ? '<span class="light none">Retired</span>' : U.light(r.light, shortLight(Object.assign({}, st, {light: r.light})))}
            <span class="n">${esc(T.name(l))} <span style="font-weight:400;color:var(--ink2)">&middot; ${esc(T.useLabel(l.answers.use))}</span></span>
            <span class="m">${esc(planLabel(l.answers.plan))} &middot; ${esc(st.label)}${l.checked ? ` &middot; checked ${esc(U.fmtDate(l.checked))}` : ''}</span>
            <span class="badges">${st.due ? '<span class="badge due">Re-check due</span>' : ''}${st.waiting ? `<span class="badge wait">Waiting on supplier until ${esc(U.fmtDate(st.waiting.until))}</span>` : ''}${open && st.state !== 'retired' ? `<span class="badge">${open} to-do${open > 1 ? 's' : ''}</span>` : ''}</span>
            <button class="btn" type="button" data-line="${esc(l.id)}">Open</button></li>`;
        }).join('')}</ul>`
        : '<p class="empty">Nothing yet. Begin with the tool your business uses most, or with any tool that receives customer details.</p>'}

      <h2 class="subhead">Your records</h2>
      <div class="actions">
        <button class="btn" type="button" data-act="csv"${rows.length ? '' : ' disabled'}>Download as a spreadsheet (CSV)</button>
        <button class="btn" type="button" data-act="print"${rows.length ? '' : ' disabled'}>Print the list</button>
        <button class="btn" type="button" data-act="backup"${rows.length ? '' : ' disabled'}>Download a backup</button>
        <button class="btn" type="button" data-act="restore">Restore from a backup</button>
      </div>
      ${rows.length ? '' : '<p class="why-off">The first three turn on once a tool is on your list. To add one, use Check a new tool above, or Check it on anything under To check.</p>'}
      <input type="file" accept=".json,application/json" id="restore-file" class="visually-hidden" tabindex="-1" aria-hidden="true">
      <p class="small-note" style="margin-top:8px">For a team, keep the spreadsheet on your shared drive, and export it again after each change.</p>
      <p class="status" id="status" role="status"></p>
    </section>
    <section class="printlist" id="printlist" aria-hidden="true">
      <h2>AI list, ${esc(U.fmtDate(today))}</h2>
      <table><thead><tr><th>Tool</th><th>Use</th><th>Plan</th><th>Light</th><th>Open to-dos</th><th>Standing rules</th><th>Re-check by</th></tr></thead>
      <tbody>${rows.filter(x => x.st.state !== 'retired').map(({l, r}) => `<tr><td>${esc(T.name(l))}</td><td>${esc(T.useLabel(l.answers.use))}</td><td>${esc(planLabel(l.answers.plan))}</td>
        <td>${esc(r.label)}</td><td>${r.todos.filter(t => !t.done).map(t => esc(t.text)).join('<br>')}</td><td>${r.standing.map(esc).join('<br>')}</td><td>${esc(l.recheck_by ? U.fmtDate(l.recheck_by) : 'After the change')}</td></tr>`).join('')}</tbody></table>
      <p style="font-size:11px">Rules version ${esc(R.version)}. This list shows what was recorded. It is not a record of what anyone else has checked.</p>
    </section>`;
  }

  /* ================= a question ================= */
  function renderAsk(){
    const d = view.draft;
    const cur = currentQ();
    if (!cur){ view = {name: 'result', draft: Object.assign(d, {focus: null})}; put(view); return renderResult(); }
    if (cur.grid) return renderGrid();
    const q = cur.q, a = answersAt(d, cur);
    const vis = T.visible(a, P);
    /* progress by section (fixed at seven), moving a little within a section,
       so an answer that opens more questions never sends the bar back */
    const inStep = vis.filter(x => x.step === q.step);
    const frac = (q.step + Math.max(0, inStep.findIndex(x => x.id === q.id)) / inStep.length) / Q.steps.length;
    const v = a[q.id];
    const ev = (a._evidence || {})[q.id];
    let body = '';
    if (q.id === 'use' && !d.lineId){
      /* a new check can cover several uses: they are checked one after another */
      const sel = pickedUses(d), qd = d.queued || {};
      const waiting = Object.keys(qd).length;
      body = `${waiting > 1 ? `<p class="hint">Tasks on your To check list are marked. Select each one this tool is used for, and it is checked with the others.</p>` : ''}
        <div class="answers multi" role="group" aria-labelledby="q-h">${q.options.map(o => `<button type="button" class="answer" data-usepick="${o.id}" aria-pressed="${sel.includes(o.id)}">${esc(o.label)}${qd[o.id] ? `<small>On your To check list: ${esc(qd[o.id].label)}</small>` : o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}</div>
        <div class="go-row" style="margin-top:16px"><button class="btn primary" type="button" data-act="use-next"${sel.length ? '' : ' disabled'}>Next</button></div>`;
    } else if (q.kind === 'text'){
      body = `<div class="field" style="margin:18px 0 0;max-width:560px"><input class="textin" id="t-in" type="text" maxlength="120" autocomplete="off" placeholder="${esc(q.placeholder || '')}" value="${esc(v || '')}" aria-label="${esc(q.text)}"></div>
        <div class="go-row" style="margin-top:16px"><button class="btn primary" type="button" data-act="text-next">Next</button></div>`;
    } else if (q.kind === 'many'){
      body = `<div class="answers multi" role="group" aria-labelledby="q-h">${q.options.map(o => `<button type="button" class="answer${o.id === 'dont_know' ? ' unsure' : ''}" data-many="${o.id}" aria-pressed="${(v || []).includes(o.id)}">${esc(o.label)}${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}</div>
        <div class="go-row" style="margin-top:16px"><button class="btn primary" type="button" data-act="many-next"${(v || []).length ? '' : ' disabled'}>Next</button></div>`;
    } else {
      /* supplier answers: an optional note on how you know goes first, so
         one select answers the question; where to look sits below */
      const evBox = q.evidence ? `<div class="evidence"><label for="ev-in">How do you know? (optional)</label><input id="ev-in" type="text" maxlength="200" autocomplete="off" placeholder="A link to the terms, or: checked the setting in the admin console" value="${esc(ev ? ev.note : '')}"><p class="small-note">Type the note first. Selecting an answer moves on.</p></div>` : '';
      body = `${evBox}<div class="answers" role="group" aria-labelledby="q-h">${q.options.map(o => `<button type="button" class="answer${o.id === 'dont_know' ? ' unsure' : ''}" data-one="${o.id}" aria-pressed="${v === o.id}">${esc(o.label)}${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}</div>`;
      if (q.evidence) body += `<details class="lookhelp"><summary>Where to look</summary>${lookHelp(a)}<p class="small-note">If you are not sure, select Not sure. It stays a to-do until you find out and change your answer.</p></details>`;
    }
    main.innerHTML = `<section class="screen">
      ${progressBar({left: `<b>Section ${q.step + 1} of ${Q.steps.length}</b> &middot; ${esc(Q.steps[q.step])}${a.mode ? ` &middot; ${a.mode === 'discovered' ? 'Already in use' : 'New tool'}` : ''}`, frac})}
      ${a.tool && q.id !== 'tool' ? `<p class="about">${esc(a.tool)}${q.id === 'use' ? '' : aboutUse(d, cur, a)}</p>` : ''}
      <h2 id="q-h">${esc(q.text)}</h2>${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
      ${body}
      <div class="backrow"><button class="btn quiet" type="button" data-act="back">&larr; Back</button><button class="btn quiet" type="button" data-act="cancel">Cancel</button></div>
    </section>`;
  }
  /* Several uses in one check (draft.uses, see ToolEngine.splitUses): the
     tool, account and supplier questions are asked once, the grid asks what
     goes in, where it goes and what it can do for every use on one screen,
     and any follow-up is asked for the use that needs it. A re-check of a
     saved line keeps the one-use draft: draft.answers only. */
  const pickedUses = d => d.sel || (d.uses ? d.uses.map(u => u.use) : [d.answers.use].filter(Boolean));
  /* the question on screen, as {q, i, at}: i is the use the answer belongs to
     (-1 for shared, undefined for a one-use draft), at is the use shown */
  function currentQ(){
    const d = view.draft;
    if (!d.uses){
      const q = (d.focus && T.visible(d.answers, P).find(x => x.id === d.focus)) || T.nextQuestion(d.answers, P);
      return q && {q};
    }
    if (d.focus === 'grid') return {grid: true};
    if (d.focus === 'use') return {q: qById('use'), i: -1, at: 0};
    if (d.focus){
      const fi = d.fi || 0;
      const order = d.uses.map((_, k) => k).sort((x, y) => (x !== fi) - (y !== fi));
      for (const at of order){
        const q = T.visible(T.useAnswers(d, at), P).find(x => x.id === d.focus);
        if (q) return {q, i: q.shared ? -1 : at, at};
      }
    }
    const n = T.nextMulti(d, P);
    return n && (n.q.grid ? {grid: true} : n);
  }
  const answersAt = (d, cur) => d.uses ? T.useAnswers(d, cur.at) : d.answers;
  function setAnswer(cur, v){
    const d = view.draft;
    if (d.uses && cur.i >= 0) d.uses[cur.i].answers[cur.q.id] = v;
    else d.answers[cur.q.id] = v;
  }
  /* the tag under the question: which use, or that it holds for them all */
  function aboutUse(d, cur, a){
    if (!d.uses) return a.use ? ' &middot; ' + esc(T.useLabel(a.use)) : '';
    if (d.uses.length === 1) return ' &middot; ' + esc(T.useLabel(d.uses[0].use));
    return cur.i < 0 ? ` &middot; all ${d.uses.length} uses` : ` &middot; ${esc(T.useLabel(d.uses[cur.i].use))} (use ${cur.i + 1} of ${d.uses.length})`;
  }

  /* ================= the uses grid ================= */
  function renderGrid(){
    const d = view.draft;
    const qs = T.GRID.map(qById);
    const filled = d.uses.every(u => qs.every(q => (u.answers[q.id] || []).length));
    main.innerHTML = `<section class="screen">
      ${progressBar({left: `<b>Section 2 of ${Q.steps.length}</b> &middot; Each use${d.answers.mode ? ` &middot; ${d.answers.mode === 'discovered' ? 'Already in use' : 'New tool'}` : ''}`, frac: 1 / Q.steps.length})}
      <p class="about">${esc(d.answers.tool || 'This tool')}</p>
      <h2 id="q-h">${d.uses.length > 1 ? `For each of the ${d.uses.length} uses: what goes in, where it goes, and what it can do` : 'What goes in, where it goes, and what it can do'}</h2>
      <p class="hint">Select everything that applies, even if it happens only occasionally.</p>
      ${d.uses.map((u, i) => `<div class="usegrid">
        ${d.uses.length > 1 ? `<h3>${esc(T.useLabel(u.use))}</h3>` : ''}
        ${qs.map(q => `<fieldset class="chips"><legend>${esc(q.text)}${d.uses.length > 1 ? `<span class="visually-hidden"> (${esc(T.useLabel(u.use))})</span>` : ''}</legend>
          <div class="chiprow">${q.options.map(o => `<button type="button" class="chip${o.id === 'dont_know' ? ' unsure' : ''}" data-grid="${q.id}" data-use="${i}" data-opt="${o.id}" aria-pressed="${(u.answers[q.id] || []).includes(o.id)}">${esc(o.label)}${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}</div>
        </fieldset>`).join('')}
      </div>`).join('')}
      <div class="go-row" style="margin-top:16px"><button class="btn primary" type="button" data-act="grid-next"${filled ? '' : ' disabled'}>Next</button>
        ${filled ? '' : `<span class="small-note">Next turns on when each question has an answer${d.uses.length > 1 ? ' for every use' : ''}.</span>`}</div>
      <div class="backrow"><button class="btn quiet" type="button" data-act="back">&larr; Back</button><button class="btn quiet" type="button" data-act="cancel">Cancel</button></div>
    </section>`;
  }

  /* after an answer: a re-check walks on through every question with the
     previous answers filled in; otherwise go to the next unanswered one */
  function answerAndGo(qid){
    const d = view.draft;
    if (d.walk){
      const vis = T.visible(d.answers, P);
      const i = vis.findIndex(x => x.id === qid);
      d.focus = vis[i + 1] ? vis[i + 1].id : null;
      if (!d.focus) d.walk = false;
    } else d.focus = null;
    goto({name: 'ask', draft: d});
  }

  /* Where to look: directions for the named tool, when it is one of the
     tools in the data, then the general places that apply to any tool. */
  function lookHelp(a, topic){
    const list = items => `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const general = topic === 'mfa' ? Q.where_to_look.mfa_general : Q.where_to_look.general;
    const v = T.vendorHelp(a, topic);
    if (!v) return list(general);
    return `${v.sections.map(sec => `<p class="vh"><b>${esc(v.name)}</b> &middot; ${esc(sec.label)}</p>${list(sec.steps)}`).join('')}
      <p class="vh-src">From ${v.sources.map(x => `<a href="${esc(x.href)}" rel="noopener noreferrer">${esc(x.title)}</a>`).join('; ')}. Checked ${esc(U.fmtDate(v.checked))}. Settings change; where the tool shows something different, the vendor's current page is correct.</p>
      <p class="vh"><b>Any tool</b></p>${list(general)}`;
  }

  /* ================= results ================= */
  /* opts.idx: the use's place on the combined results page, which keeps the
     ids apart and tells a to-do or a Change which use it belongs to */
  function resultHTML(r, a, opts){
    const light = r.light;
    const ix = opts.idx === undefined ? '' : `u${opts.idx}-`;
    const du = opts.idx === undefined ? '' : ` data-use="${opts.idx}"`;
    const sub = light === 'red' ? (a.mode === 'discovered' ? 'A red line is crossed. Pause this use now; what is still allowed is below.' : 'A red line is crossed. Do not start this use until it changes.')
      : light === 'amber' ? `${r.todos.filter(t => !t.done).length} to-do${r.todos.filter(t => !t.done).length === 1 ? '' : 's'} open. It turns green when ${r.todos.filter(t => !t.done).length === 1 ? 'it is' : 'they are'} done.` : 'No open to-dos.';
    const allowed = T.allowedText(r);
    const notes = r.allowed_notes;
    const conf = r.confidence;
    return `
      <div class="bigresult ${light}">${U.light(light, r.label)}
        <h2>${esc(a.tool || 'This tool')} <span style="font-weight:500;color:var(--ink2)">&middot; ${esc(T.useLabel(a.use))}</span></h2>
        <p class="sub">${esc(sub)}</p>
        ${light !== 'green' && (allowed || notes.length) ? `<p class="allowed"><b>Allowed right now</b>${esc([allowed].concat(notes).filter(Boolean).join(' '))}</p>` : ''}
      </div>
      ${opts.idx === undefined ? PR.adviceHTML(P.industry, esc) : ''}
      ${r.stops.length ? `<h3 class="subhead">Why it is red</h3>${r.stops.map(s => `<div class="finding stop">${U.light('red', 'Stop')}
        <p>${esc(s.reason)}</p><p class="fix"><b>What would change it:</b> ${esc(s.fix)}<span class="who">${esc(s.owner)}</span></p>
        ${s.flag ? `<p class="advice"><b>Get advice</b>${esc(s.flag_text || '')}</p>` : ''}
        <p><a href="${esc(s.how.href)}">${esc(s.how.label)}</a></p></div>`).join('')}` : ''}
      ${r.todos.length ? `<h3 class="subhead">To do</h3><ul class="todos-list">${r.todos.map(t => `<li class="todo${t.done ? ' done' : ''}">
          ${t.answer ? '<span aria-hidden="true" style="width:20px;flex:0 0 auto;color:var(--check);font-weight:700;text-align:center">?</span>'
            : `<input type="checkbox" id="td-${ix}${esc(t.id)}" data-todo="${esc(t.id)}"${du}${t.done ? ' checked' : ''} aria-describedby="tw-${ix}${esc(t.id)}">`}
          <div class="body">
            <p><label class="task" for="td-${ix}${esc(t.id)}">${t.cleanup ? '<b>Clean-up:</b> ' : ''}${esc(t.text)}</label> <span class="who">${esc(t.owner)}</span></p>
            <p class="why" id="tw-${ix}${esc(t.id)}">${esc(t.reason)}</p>
            ${t.flag ? `<p class="advice"><b>Get advice</b>${esc(t.flag_text || '')}</p>` : ''}
            ${t.where_to_look ? `<details><summary>Where to look</summary>${lookHelp(a, t.where_to_look)}</details>` : ''}
            ${t.answer ? `<p><button class="btn quiet find" type="button" data-focus="${esc(t.answer)}"${du}>I have found out: change my answer</button></p>` : ''}
            ${t.shared && opts.uses > 1 ? `<p class="small-note">Done once for the tool: ticking it here ticks it on ${opts.uses === 2 ? 'both uses' : `all ${opts.uses} uses`}.</p>` : ''}
            ${t.standing && !t.done ? `<p class="small-note">Once done, this becomes a standing rule.</p>` : ''}
            <p><a href="${esc(t.how.href)}">${esc(t.how.label)}</a></p>
          </div></li>`).join('')}</ul>` : ''}
      ${r.standing.length ? `<h3 class="subhead">Standing rules</h3><ul class="standing">${r.standing.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <p class="small-note" style="margin-top:16px">Based on ${conf.answers} answers${conf.dont_know ? `, ${conf.dont_know} of them not sure` : ''}.${conf.dont_know ? ' Resolving those could change this result.' : ''}${conf.unsourced ? ` ${conf.unsourced} supplier answer${conf.unsourced > 1 ? 's have' : ' has'} no source noted.` : ''}
        ${opts.recheck !== undefined ? ` Re-check ${opts.recheck ? 'by ' + esc(U.fmtDate(opts.recheck)) : 'after the change'}.` : ''}</p>
      ${answersHTML(a, du)}`;
  }
  function answersHTML(a, du){
    const vis = T.visible(a, P).filter(q => a[q.id] !== undefined && q.id !== 'mode');
    return `<details style="margin-top:14px;max-width:78ch"><summary>Your answers</summary><ul class="events">${vis.map(q =>
      `<li>${esc(q.text)} <b>${esc(answerText(q, a[q.id]))}</b>${(a._evidence || {})[q.id] ? ` <span class="small-note">(${esc(a._evidence[q.id].note)})</span>` : ''} <button class="btn quiet" type="button" data-focus="${q.id}"${du || ''} style="padding:2px 6px">Change</button></li>`).join('')}</ul></details>`;
  }

  function renderResult(){
    const d = view.draft, a = d.answers;
    if (d.uses) return renderResults();
    const r = T.evaluate(a, P, d.done || []);
    main.innerHTML = `<section class="screen">
      <p class="step-label"><b>Tool check</b><span>Result</span>${d.lineId ? '<span>Re-check</span>' : ''}</p>
      ${resultHTML(r, a, {})}
      <div class="go-row" style="margin-top:20px">
        <button class="btn primary" type="button" data-act="save">${d.lineId ? 'Save the re-check' : 'Save to your AI list'}</button>
        <button class="btn quiet" type="button" data-act="cancel">Do not save</button>
      </div>
      <div class="backrow"><button class="btn quiet" type="button" data-act="back">&larr; Back</button></div>
    </section>`;
  }

  /* A new check: one page with a result for each use, saved together. */
  function renderResults(){
    const d = view.draft, n = d.uses.length;
    const res = d.uses.map((u, i) => { const a = T.useAnswers(d, i); return {a, r: T.evaluate(a, P, u.done || [])}; });
    const one = ({a, r}, i) => resultHTML(r, a, {idx: i, uses: n});
    main.innerHTML = `<section class="screen">
      <p class="step-label"><b>Tool check</b><span>${n > 1 ? `Results for ${n} uses` : 'Result'}</span></p>
      ${n > 1 ? `<h2>${esc(d.answers.tool || 'This tool')}: ${n} uses</h2>
        <ul class="use-sum">${res.map(({r}, i) => `<li>${U.light(r.light, shortLight(r))} <button class="linkish" type="button" data-jump="${i}">${esc(T.useLabel(d.uses[i].use))}</button></li>`).join('')}</ul>
        <p class="small-note">Each use has its own light, because the same tool can be acceptable for one task and not for another. The tool and supplier answers are shared by all ${n}.</p>` : ''}
      ${PR.adviceHTML(P.industry, esc)}
      ${res.map((x, i) => `<div class="use-result" id="use-${i}">${one(x, i)}</div>`).join('')}
      <div class="go-row" style="margin-top:20px">
        <button class="btn primary" type="button" data-act="save">${n > 1 ? `Save all ${n} to your AI list` : 'Save to your AI list'}</button>
        <button class="btn quiet" type="button" data-act="cancel">Do not save</button>
      </div>
      <div class="backrow"><button class="btn quiet" type="button" data-act="back">&larr; Back</button></div>
    </section>`;
  }

  /* ================= a saved line ================= */
  function renderLine(){
    const l = lineById(view.lineId);
    if (!l){ view = {name: 'list'}; return renderList(); }
    const today = U.today();
    const st = T.state(l, P, today);
    const r = evalLine(l);
    const a = Object.assign({}, l.answers, {_evidence: l.evidence});
    const hasSupplierTodo = r.todos.some(t => t.supplier && !t.done);
    main.innerHTML = `<section class="screen">
      <p class="step-label"><b>Your AI list</b><span>${esc(st.label)}</span><span>Checked ${esc(U.fmtDate(l.checked))}</span></p>
      ${st.state === 'retired' ? `<div class="callout whybox"><span class="k">Retired ${esc(U.fmtDate(l.retired_on))}</span><p>Kept here as history. Uncheck a retirement step to restore it.</p></div>` : ''}
      ${st.due && st.state !== 'retired' ? `<div class="callout whybox" style="--c:var(--check)"><span class="k">Time to re-check</span><ul>${st.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        <p><button class="btn primary" type="button" data-act="recheck">Re-check now (your answers are filled in)</button></p></div>` : ''}
      ${st.waiting ? `<div class="callout whybox" style="--c:#2D5F8B"><span class="k">Waiting on the supplier</span><p>Follow up by ${esc(U.fmtDate(st.waiting.until))}${st.waiting.note ? `: ${esc(st.waiting.note)}` : ''}.${today > st.waiting.until ? ' <b>That date has passed.</b>' : ''}</p></div>` : ''}
      ${resultHTML(r, a, {recheck: l.recheck_by, uses: T.otherUses(list.lines, l).length + 1})}

      <div class="go-row" style="margin-top:20px">
        <button class="btn" type="button" data-act="another">+ Another use of this tool</button>
        <button class="btn quiet" type="button" data-act="list">Back to your AI list</button>
      </div>

      <h3 class="subhead">The life of this tool</h3>
      <div class="life">
        <div class="panelbox"><h4>Something changed?</h4>
          <label class="visually-hidden" for="ev-sel">What changed</label>
          <select id="ev-sel">${Q.events.map(e => `<option value="${e.id}">${esc(e.label)}</option>`).join('')}</select>
          <div class="row"><input type="text" id="ev-note" maxlength="200" placeholder="A short note (optional)" aria-label="Note"><button class="btn" type="button" data-act="event">Log it</button></div>
          ${l.events.length ? `<ul class="events">${l.events.slice().reverse().map(e => `<li>${esc(U.fmtDate(e.date))}: ${esc((Q.events.find(x => x.id === e.id) || {}).label)}${e.note ? ` (${esc(e.note)})` : ''}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="panelbox"><h4>Waiting on the supplier?</h4>
          <p class="small-note" style="margin:0">${hasSupplierTodo ? 'You have a to-do that the supplier must answer.' : 'For when an answer must come from the supplier.'}</p>
          <div class="row"><label class="visually-hidden" for="wait-date">Follow up by</label><input type="date" id="wait-date" value="${esc(l.waiting ? l.waiting.until : T.addDays(today, 14))}" min="${today}">
            <input type="text" id="wait-note" maxlength="200" placeholder="What you asked" aria-label="What you asked" value="${esc(l.waiting ? l.waiting.note : '')}"></div>
          <div class="row"><button class="btn" type="button" data-act="wait">${l.waiting ? 'Update' : 'Mark as waiting'}</button>${l.waiting ? '<button class="btn quiet" type="button" data-act="unwait">Answer received</button>' : ''}</div>
        </div>
        <div class="panelbox"><h4>Retire it</h4>
          <ul class="checklist">${Q.retire_checklist.map((s, i) => `<li><label><input type="checkbox" data-retire="${i}"${l.retire[i] ? ' checked' : ''}><span>${esc(s)}</span></label></li>`).join('')}</ul>
        </div>
      </div>
      <div class="actions" style="margin-top:18px"><button class="btn quiet" type="button" data-act="delete">Delete from the list</button></div>
      <p class="status" id="status" role="status"></p>
    </section>`;
  }

  /* select or clear one answer of a question that takes several */
  function toggle(q, cur, id){
    cur = cur || [];
    const excl = q.exclusive || [];
    return cur.includes(id) ? cur.filter(x => x !== id)
      : excl.includes(id) ? [id] : cur.filter(x => !excl.includes(x)).concat(id);
  }

  /* ---------- starting a check ---------- */
  function startCheck(answers, extra){
    const dr = Object.assign({answers: Object.assign({_evidence: {}}, answers), done: [], key: newKey()}, extra || {});
    /* a new check with its use already known (from the to-check list) */
    if (!dr.lineId && dr.answers.use) Object.assign(dr, T.splitUses(dr.answers, [dr.answers.use]));
    goto({name: 'ask', draft: dr});
  }

  /* ================= events ================= */
  main.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;

    if (d.one){
      const c = currentQ(), q = c.q;
      setAnswer(c, d.one);
      /* supplier answers: keep the note typed above the answers */
      if (q.evidence){
        const inp = $('#ev-in');
        const ev = view.draft.answers._evidence || (view.draft.answers._evidence = {});
        if (inp && inp.value.trim()) ev[q.id] = {note: inp.value.trim().slice(0, 200), date: U.today()};
        else delete ev[q.id];
      }
      return answerAndGo(q.id);
    }
    if (d.usepick){
      const q = currentQ();
      const sel = pickedUses(view.draft);
      view.draft.sel = sel.includes(d.usepick) ? sel.filter(x => x !== d.usepick) : sel.concat(d.usepick);
      view.draft.focus = q.id;
      put(view);
      return render(`[data-usepick="${d.usepick}"]`);
    }
    if (d.many){
      const c = currentQ(), q = c.q;
      setAnswer(c, toggle(q, answersAt(view.draft, c)[q.id], d.many));
      view.draft.focus = q.id;   // stay here until Next
      if (view.draft.uses) view.draft.fi = c.at;
      put(view);
      return render(`[data-many="${d.many}"]`);
    }
    if (d.grid){
      const u = view.draft.uses[+d.use];
      u.answers[d.grid] = toggle(qById(d.grid), u.answers[d.grid], d.opt);
      view.draft.focus = 'grid';   // stay here until Next
      put(view);
      return render(`[data-grid="${d.grid}"][data-use="${d.use}"][data-opt="${d.opt}"]`);
    }
    if (d.jump){ const el = $('#use-' + d.jump); if (el){ el.scrollIntoView(); const h = $('h2', el); h.tabIndex = -1; h.focus({preventScroll: true}); } return; }
    if (d.focus){
      if (view.name === 'line'){
        const l = lineById(view.lineId);
        return startCheck(T.reopenAnswers(l), {lineId: l.id, done: l.done.slice(), focus: d.focus});
      }
      const dr = view.draft;
      dr.focus = dr.uses && qById(d.focus).grid ? 'grid' : d.focus;
      if (dr.uses) dr.fi = +(d.use || 0);
      return goto({name: 'ask', draft: dr});
    }
    if (d.queue){
      /* the use picker opens with this task selected, and marks the other
         tasks waiting for the same tool, each with its quick answers */
      const items = T.queue(savedQuick(), list.lines, list.skipped);
      const item = items.find(i => i.key === d.queue);
      if (!item) return;
      const a = T.fromQueue(item);
      delete a.use;
      return startCheck(a, {from: item.use ? null : item.key, queued: T.queueUses(item, items), sel: item.use ? [item.use] : undefined});
    }
    if (d.skip){ list.skipped.push(d.skip); saveList(); return render(); }
    if (d.line) return goto({name: 'line', lineId: d.line});

    switch (d.act){
      case 'new': return startCheck({mode: 'new'});
      case 'found': return startCheck({mode: 'discovered'});
      case 'back': return history.back();
      case 'cancel': case 'list': return goto({name: 'list'});
      case 'text-next': {
        const v = $('#t-in').value.trim();
        if (!v){ $('#t-in').focus(); return; }
        view.draft.answers.tool = v;
        /* so Back returns to this question, with the name filled in */
        const snap = clone(view);
        snap.draft.focus = 'tool';
        put(snap);
        return answerAndGo('tool');
      }
      case 'many-next': return answerAndGo(currentQ().q.id);
      case 'grid-next': return answerAndGo('grid');
      case 'use-next': {
        /* uses picked again keep their answers */
        const dr = view.draft, sel = pickedUses(dr);
        if (!sel.length) return;
        const old = dr.uses || [];
        const qd = dr.queued || {};
        dr.uses = sel.map(u => old.find(x => x.use === u) || {use: u, answers: clone((qd[u] || {}).answers || {}), done: [], from: (qd[u] || {}).from || null});
        delete dr.sel;
        delete dr.answers.use;
        return answerAndGo('use');
      }
      case 'save': {
        const dr = view.draft, today = U.today();
        const already = dr.key && savedChecks()[dr.key];
        if (already) return goto(lineById(already) ? {name: 'line', lineId: already} : {name: 'list'}, false);
        if (dr.uses){
          const lines = dr.uses.map((u, i) => {
            const l = T.makeLine(T.useAnswers(dr, i), P, today, {from: u.from || (i === 0 && dr.from) || null});
            l.done = (u.done || []).slice();
            T.refresh(l, P, today, true);
            list.lines.push(l);
            return l;
          });
          if (!saveList()) announce('This browser is blocking storage, so the list lasts only while this page is open.');
          const many = lines.length > 1;
          if (dr.key) U.store.set(SAVED_KEY, Object.assign(savedChecks(), {[dr.key]: many ? 'list' : lines[0].id}), 'sessionStorage');
          if (!many) return goto({name: 'line', lineId: lines[0].id}, false);
          goto({name: 'list'}, false);
          return say(`Saved ${lines.length} uses of ${T.name(lines[0])} to your AI list.`);
        }
        let line;
        if (dr.lineId){
          line = lineById(dr.lineId);
          line.done = (dr.done || []).slice();
          T.recheck(line, dr.answers, P, today);
        } else {
          line = T.makeLine(dr.answers, P, today, {from: dr.from || null});
          line.done = (dr.done || []).slice();
          T.refresh(line, P, today, true);
          list.lines.push(line);
        }
        if (!saveList()) announce('This browser is blocking storage, so the list lasts only while this page is open.');
        if (dr.key) U.store.set(SAVED_KEY, Object.assign(savedChecks(), {[dr.key]: line.id}), 'sessionStorage');
        return goto({name: 'line', lineId: line.id}, false);
      }
      case 'recheck': {
        const l = lineById(view.lineId);
        return startCheck(T.reopenAnswers(l), {lineId: l.id, done: l.done.slice(), walk: true, focus: 'tool'});
      }
      case 'another': return startCheck(T.anotherUse(lineById(view.lineId)));
      case 'event': {
        const l = lineById(view.lineId);
        T.logEvent(l, $('#ev-sel').value, U.today(), $('#ev-note').value);
        saveList(); render();
        return say('Logged. The check is marked for a re-check, with your previous answers filled in.');
      }
      case 'wait': {
        const l = lineById(view.lineId);
        const until = $('#wait-date').value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return say('Choose a follow-up date.');
        l.waiting = {until, note: $('#wait-note').value.trim().slice(0, 200)};
        saveList(); return render();
      }
      case 'unwait': { const l = lineById(view.lineId); l.waiting = null; saveList(); render(); return say('Now update your answer with what the supplier said: open Your answers and choose Change.'); }
      case 'delete': {
        const l = lineById(view.lineId);
        if (!confirm(`Delete ${T.name(l)} (${T.useLabel(l.answers.use)}) from your AI list? To keep its history, retire it instead.`)) return;
        list.lines = list.lines.filter(x => x.id !== l.id);
        saveList();
        return goto({name: 'list'});
      }
      case 'csv':
        U.download(T.csv(list.lines, P, U.today()), `ai_list_${U.today()}.csv`, 'text/csv');
        return say('Spreadsheet downloaded. It opens in Excel, Numbers or Google Sheets.');
      case 'backup':
        U.download(JSON.stringify(list, null, 2), `ai_list_backup_${U.today()}.json`, 'application/json');
        return say('Backup downloaded. Keep it with your other business records.');
      case 'restore': return $('#restore-file').click();
      case 'print': {
        const pl = $('#printlist');
        pl.classList.add('print-target'); document.body.classList.add('printing');
        return window.print();
      }
    }
  });

  /* ticking a to-do works the light out again straight away */
  main.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.todo){
      const id = el.dataset.todo;
      const ui = el.dataset.use;
      const target = view.name === 'line' ? lineById(view.lineId) : ui !== undefined && view.draft.uses ? view.draft.uses[+ui] : view.draft;
      const tick = t => t.done = el.checked ? (t.done || []).filter(x => x !== id).concat(id) : (t.done || []).filter(x => x !== id);
      tick(target);
      let r, also = 0;
      if (view.name === 'line'){
        const before = target.light;
        T.refresh(target, P, U.today(), false);
        r = evalLine(target);
        if (r.light !== before) target.recheck_by = T.recheckBy(r, U.today());
        /* a shared to-do is done once for the tool: tick it on its other uses */
        if ((r.todos.find(t => t.id === id) || {}).shared) also = T.tickShared(list.lines, target, id, el.checked, P, U.today()).length;
        saveList();
      } else if (ui !== undefined && view.draft.uses){
        const d = view.draft;
        r = T.evaluate(T.useAnswers(d, +ui), P, target.done);
        if ((r.todos.find(t => t.id === id) || {}).shared) d.uses.forEach((u, i) => {
          if (i === +ui) return;
          const t = T.evaluate(T.useAnswers(d, i), P, u.done).todos.find(x => x.id === id);
          if (t && !t.answer && t.done !== el.checked){ tick(u); also++; }
        });
        put(view);
      } else {
        put(view);
        r = T.evaluate(view.draft.answers, P, view.draft.done);
      }
      render(`[data-todo="${CSS.escape(id)}"]${ui !== undefined ? `[data-use="${ui}"]` : ''}`);
      announce(`Now: ${r.label}.${also ? ` Also ${el.checked ? 'ticked' : 'unticked'} on ${also} other use${also > 1 ? 's' : ''} of this tool.` : ''}`);
    }
    if (el.dataset.retire !== undefined){
      const l = lineById(view.lineId);
      T.retire(l, +el.dataset.retire, el.checked, U.today());
      saveList();
      render(`[data-retire="${el.dataset.retire}"]`);
      if (l.retired_on) announce('Retired. It stays on the list as history.');
    }
    if (el.id === 'restore-file' && el.files[0]){
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          const {lines, dropped} = T.restore(obj, P, U.today());
          if (list.lines.length && !confirm(`Replace the ${list.lines.length} uses on this list with the ${lines.length} in the backup?`)) return;
          list = {version: 1, lines, skipped: Array.isArray(obj.skipped) ? obj.skipped.filter(s => typeof s === 'string') : []};
          saveList(); render();
          say(`Restored ${lines.length} use${lines.length === 1 ? '' : 's'}.${dropped ? ` ${dropped} ${dropped === 1 ? 'entry' : 'entries'} could not be read and ${dropped === 1 ? 'was' : 'were'} left out.` : ''} Every light was recalculated under the current rules.`);
        } catch (err) { say('That file could not be read as an AI list backup. Nothing was changed.'); }
      };
      reader.readAsText(el.files[0]);
      el.value = '';
    }
  });
  main.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
    const next = $('[data-act="text-next"]', main);
    if (next || e.target.id === 'ev-in') e.preventDefault();
    if (next) next.click();
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    $$('.print-target').forEach(x => x.classList.remove('print-target'));
  });

  render();
})();
