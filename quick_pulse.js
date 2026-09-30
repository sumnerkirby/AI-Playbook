/* F. Monthly pulse: the page. pulse_engine.js decides what's due and what
   answers mean; this script asks and keeps the log.

   Where state lives: a year of check-ins has to outlast the tab, so the log
   is kept in this browser (localStorage), with backup, restore and CSV.
   Nothing typed here goes in the address. The check-in in progress rides in
   the browser's history entries, so the back button undoes a step. */
(function(){
  const PU = PulseEngine, Q = PULSE.questions;
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main'), root = $('#qc');
  const LOG_KEY = 'sb-ai-playbook:pulse';
  const CAL_KEY = 'sb-ai-playbook:pulse-calendar';

  const sget = (area, k) => { try { return window[area].getItem(k); } catch (e) { return null; } };
  const sset = (area, k, v) => { try { window[area].setItem(k, v); return true; } catch (e) { return false; } };
  const sdel = (area, k) => { try { window[area].removeItem(k); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const today = () => new Date().toLocaleDateString('en-CA');
  const clone = o => JSON.parse(JSON.stringify(o));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

  $('#pulse-version').textContent = PULSE.version;
  $('#rules-version').textContent = RULES.version;

  const ICON = {
    go: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="M5.6 10.4l2.9 2.9 5.9-6.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.2l9.2 17H.8z" fill="currentColor"/><path d="M10 7.2v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="15.1" r="1.3" fill="#fff"/></svg>',
    stop: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.3 1h7.4L19 6.3v7.4L13.7 19H6.3L1 13.7V6.3z" fill="currentColor"/><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };
  const LABEL = {go: 'Go', check: 'Check', stop: 'Stop'};
  const light = (l, text) => l ? `<span class="light ${l}">${ICON[l]}${esc(text || LABEL[l])}</span>` : `<span class="light none">${esc(text || 'To check')}</span>`;

  /* ---------- the log ---------- */
  function loadLog(){
    try {
      const raw = JSON.parse(sget('localStorage', LOG_KEY) || 'null');
      if (raw) return Object.assign(PU.emptyLog(), raw);
    } catch (e) {}
    return PU.emptyLog();
  }
  let log = loadLog();
  const saveLog = () => sset('localStorage', LOG_KEY, JSON.stringify(log));
  /* industry: from the log, else from a saved quick check or policy */
  function industry(){
    if (log.industry) return log.industry;
    try { const q = JSON.parse(sget('localStorage', 'sb-ai-playbook:quick') || 'null'); if (q && q.profile && q.profile.industry) return q.profile.industry; } catch (e) {}
    try { const p = JSON.parse(sget('localStorage', 'sb-ai-playbook:policy') || 'null'); if (p && p.a && p.a.industry) return p.a.industry; } catch (e) {}
    try { return ProfileEngine.forTools(ProfileEngine.clean(JSON.parse(sget('localStorage', 'sb-ai-playbook:profile') || 'null'))).industry; } catch (e) {}
    return null;
  }
  const ctx = () => ({industry: industry()});
  const hasBaseline = () => !!(sget('localStorage', 'sb-ai-playbook:quick') || sget('localStorage', 'sb-ai-playbook:policy'));

  /* ---------- the check-in in progress ---------- */
  let flow = {stage: 'home'};
  let firstRender = true;
  function goto(stage, push = true){
    flow.stage = stage;
    if (push) history.pushState({pulse: clone(flow)}, '');
    else history.replaceState({pulse: clone(flow)}, '');
    render();
  }
  window.addEventListener('popstate', e => {
    if (e.state && e.state.pulse){ flow = e.state.pulse; log = loadLog(); render(); }
  });
  if (history.state && history.state.pulse) flow = history.state.pulse;
  else history.replaceState({pulse: clone(flow)}, '');

  function render(){
    root.classList.toggle('started', flow.stage !== 'home');
    (STAGES[flow.stage] || STAGES.home)();
    if (!firstRender){
      window.scrollTo(0, 0);
      const h = $('h2', main);
      if (h){ h.tabIndex = -1; h.focus({preventScroll: true}); }
    }
    firstRender = false;
  }

  /* which of the three (or four) questions we're on */
  function progress(n){
    const total = flow.sweep_due ? 4 : 3;
    return progressBar({left: '<b>Monthly check-in</b>', n, total});
  }
  const back = () => `<div class="backrow"><button class="btn quiet" type="button" data-act="back">&larr; Back</button><button class="btn quiet" type="button" data-act="home">Cancel</button></div>`;
  let onAnswer = null;
  function ask(n, text, hint, answers, handler, extra = ''){
    onAnswer = handler;
    main.innerHTML = `<section class="screen">${progress(n)}
      <h2>${esc(text)}</h2>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}${extra}
      <div class="answers" role="group" aria-label="Answers">${answers.map(a =>
        `<button type="button" class="answer${a.id === 'not_sure' || a.id === 'not_looked' ? ' unsure' : ''}" data-answer="${a.id}">${esc(a.label)}</button>`).join('')}</div>
      ${back()}</section>`;
  }
  function textStep(n, text, label, placeholder, key, next, extra = ''){
    main.innerHTML = `<section class="screen">${progress(n)}
      <h2>${esc(text)}</h2>${extra}
      <div class="field" style="margin:18px 0 0;max-width:560px">
        <label for="t-in" style="display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:6px">${esc(label)}</label>
        <input id="t-in" type="text" maxlength="200" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(flow[key] || '')}"
          style="width:100%;font:inherit;font-size:17px;padding:12px 14px;border:1px solid var(--rule);border-radius:3px;background:var(--card)">
      </div>
      <div class="go-row" style="margin-top:16px"><button class="btn primary" type="button" data-act="text-next" data-key="${key}" data-next="${next}">Next</button></div>
      ${back()}</section>`;
  }

  /* ---------- screens ---------- */
  const STAGES = {
    home: renderHome,
    q_new: () => ask(1, Q.new_tool.text, Q.new_tool.hint, PULSE.yes_no, a => {
      if (a === 'yes'){ flow.pending = {name: '', card: null, answers: {}}; flow.tool_name = ''; goto('tool_name'); }
      else goto('q_incident');
    }),
    tool_name: () => textStep(1, Q.new_tool.text, Q.new_tool.name_label, Q.new_tool.name_placeholder, 'tool_name', 'tool_card'),
    tool_card: () => {
      const cards = QuickEngine.cardsFor(ctx());
      main.innerHTML = `<section class="screen">${progress(1)}
        <p class="about">${esc(flow.pending.name)}</p>
        <h2>${esc(Q.new_tool.card_text)}</h2>
        <div class="tapgrid cardpick" role="group">${cards.map(c => `<button type="button" class="tapcard" data-card="${c.id}" aria-pressed="false"><span class="t">${esc(c.label)}</span></button>`).join('')}</div>
        ${back()}</section>`;
    },
    tool_q: () => {
      const p = flow.pending;
      const q = QuickEngine.cardQuestions(p.card, p.answers).find(x => p.answers[x.id] === undefined);
      ask(1, q.text, q.hint, q.answers, a => {
        p.answers[q.id] = a;
        p.answers = QuickEngine.pruneCard(p.card, p.answers);
        if (QuickEngine.cardComplete(p.card, p.answers)){
          Object.assign(p, PU.toolLight(p.card, p.answers, ctx()));
          flow.draft.new_tools.push(clone(p));
          goto('tool_result');
        } else goto('tool_q');
      }, `<p class="about">${esc(p.name)}</p>`);
    },
    tool_result: () => {
      const t = flow.draft.new_tools[flow.draft.new_tools.length - 1];
      main.innerHTML = `<section class="screen">${progress(1)}
        <h2>${esc(t.name)}</h2>
        ${toolFinding(t)}
        <div class="go-row" style="margin-top:20px">
          <button class="btn primary" type="button" data-act="goto" data-to="q_incident">Next question</button>
          <button class="btn" type="button" data-act="another">Add another new tool</button>
        </div>${back()}</section>`;
    },
    q_incident: () => ask(2, Q.incident.text, Q.incident.hint, PULSE.yes_no, a => {
      if (a === 'yes'){ flow.incident_text = ''; goto('incident_text'); } else goto('q_conn');
    }),
    incident_text: () => textStep(2, Q.incident.text, Q.incident.text_label, Q.incident.text_placeholder, 'incident_text', 'incident_card'),
    incident_card: () => {
      const c = PULSE.incident_card;
      main.innerHTML = `<section class="screen">${progress(2)}
        <h2>${esc(c.title)}</h2>
        <div class="callout" style="--c:var(--check)"><span class="k">Recorded</span><p>${esc(flow.draft.incidents[flow.draft.incidents.length - 1].text)}</p></div>
        <ol class="steps">${c.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <p><a href="${c.how.href}">${esc(c.how.label)}</a> &middot; <a href="quick_policy.html">Your AI policy</a> says who to tell.</p>
        <div class="go-row" style="margin-top:20px"><button class="btn primary" type="button" data-act="goto" data-to="q_conn">Next question</button></div>
        ${back()}</section>`;
    },
    q_conn: () => ask(3, Q.connection.text, Q.connection.hint, PULSE.yes_no, a => {
      if (a === 'yes'){ flow.conn_name = ''; goto('conn_name'); } else goto(afterConn());
    }),
    conn_name: () => textStep(3, Q.connection.text, Q.connection.name_label, Q.connection.name_placeholder, 'conn_name', 'conn_approval'),
    conn_approval: () => ask(3, Q.connection.approval_text, '', Q.connection.approval, a => {
      flow.draft.connections.push({name: flow.conn_name.trim(), approval: a, light: PU.connectionRule(a).light});
      goto(afterConn());
    }, `<p class="about">${esc(flow.conn_name)}</p>`),
    q_sweep: () => ask(4, Q.sweep.text, Q.sweep.hint, Q.sweep.answers, a => {
      flow.draft.sweep = {answer: a, found: []};
      if (a === 'yes'){ flow.sweep_text = ''; goto('sweep_found'); } else goto('done');
    }, `<p class="example" style="margin-top:6px"><b>${esc(Q.sweep.names_label)}</b></p><ul class="names">${PULSE.statement_names.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`),
    sweep_found: () => textStep(4, Q.sweep.text, Q.sweep.found_label, 'For example: Otter.ai, Fireflies', 'sweep_text', 'done'),
    done: renderDone,
  };
  const afterConn = () => flow.sweep_due ? 'q_sweep' : 'done';

  /* ---------- findings ---------- */
  const WHO = {you: 'You', it_provider: 'You or your IT provider', supplier: 'Ask your supplier', advisor: 'Ask your advisor or compliance consultant'};
  function toolFinding(t){
    const card = QuickEngine.card(t.card);
    const hits = t.reasons.map(id => RULES.rules.find(r => r.id === id)).filter(Boolean);
    return `<div class="finding ${t.light}">${light(t.light)}
      <h3>${esc(t.name)}</h3>
      <p class="said">For: <b>${esc(card ? card.label : t.card)}</b></p>
      ${hits.length ? `<ul class="reasons">${hits.map(h => `<li>${esc(h.reason)}
        <p class="fix"><b>${h.outcome === 'stop' ? 'Fix:' : 'Next:'}</b> ${esc(h.fix)}<span class="who">${esc(WHO[h.owner])}</span></p>
        <p><a href="${h.how.href}">${esc(h.how.label)}</a></p></li>`).join('')}</ul>`
        : '<p>Nothing in your answers needs a change.</p><p class="small-note">Supplier not checked: the check-in does not ask what the supplier does with your information.</p>'}
    </div>`;
  }
  function connFinding(x){
    const r = PU.connectionRule(x.approval);
    return `<div class="finding ${x.light}">${light(x.light)}
      <h3>${esc(x.name)}</h3>
      <p>${esc(r.reason)}</p>
      <p class="fix"><b>${x.light === 'stop' ? 'Fix:' : 'Next:'}</b> ${esc(r.fix)}<span class="who">${esc(WHO.it_provider)}</span></p>
      <p><a href="${PULSE.connection_how.href}">${esc(PULSE.connection_how.label)}</a></p></div>`;
  }

  /* ---------- finishing a check-in ---------- */
  function renderDone(){
    const d = flow.draft;
    if (d.sweep && d.sweep.answer === 'yes') d.sweep.found = (flow.sweep_text || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
    /* save once; going back and finishing again replaces it */
    const {_id, ...record} = d;
    log.checkins = log.checkins.filter(c => c._id !== _id);
    log.checkins.push(Object.assign({_id}, record));
    log.checkins = PU.sorted(log);
    if (!log.industry) log.industry = industry();
    const saved = saveLog();
    const st = PU.status(log, today());
    const nothing = !d.new_tools.length && !d.incidents.length && !d.connections.length && !(d.sweep && d.sweep.found.length);
    main.innerHTML = `<section class="screen">
      <p class="step-label"><b>Monthly check-in</b><span>${esc(PU.fmtDate(d.date))}</span></p>
      <h2>${nothing ? 'All clear this month' : 'Check-in recorded'}</h2>
      <p class="honest">${saved ? 'Saved in this browser' : 'Not saved: this browser is blocking storage'}</p>
      <p>${esc(PU.summary(d).charAt(0).toUpperCase() + PU.summary(d).slice(1))}.</p>
      ${d.new_tools.map(toolFinding).join('')}
      ${d.connections.map(connFinding).join('')}
      ${d.incidents.length ? `<div class="finding check"><span class="light none">Logged</span><h3>Things that went wrong</h3><ul>${d.incidents.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul><p><a href="${PULSE.incident_card.how.href}">${esc(PULSE.incident_card.how.label)}</a></p></div>` : ''}
      ${d.sweep && d.sweep.found.length ? `<div class="finding"><span class="light none">To check</span><h3>Found on the statement</h3><p>${d.sweep.found.map(esc).join(', ')}</p><p>Check each one: what it is used for, and on which account. <a href="quick_check.html">The quick check</a> does this in a few minutes.</p></div>` : ''}
      ${d.sweep && d.sweep.answer === 'not_looked' ? '<p class="small-note">The statement question will come up again next month.</p>' : ''}
      <p style="margin-top:18px">Next check-in: <b>${esc(PU.fmtDate(st.next))}</b>.</p>
      <div class="go-row" style="margin-top:14px">
        ${sget('localStorage', CAL_KEY) ? '' : '<button class="btn primary" type="button" data-act="calendar">Add a monthly reminder to your calendar</button>'}
        <button class="btn" type="button" data-act="home">See all check-ins</button>
      </div>
      <p class="status" id="status" role="status"></p>
    </section>`;
  }

  /* ---------- home ---------- */
  function statusText(st){
    const last = st.last ? PU.fmtDate(st.last) : '';
    if (st.state === 'none') return ['No check-ins yet', 'The first one takes about a minute.'];
    const ago = st.days === 0 ? 'today' : st.days === 1 ? 'yesterday' : `${st.days} days ago`;
    if (st.state === 'done') return [`Last check-in: ${ago}`, `${last}. Next one due ${PU.fmtDate(st.next)}.`];
    return [st.state === 'overdue' ? `It has been ${st.days} days` : 'Your monthly check-in is due', `Last check-in: ${last}.`];
  }
  function renderHome(){
    log = loadLog();
    const t = today(), st = PU.status(log, t);
    const [big, small] = statusText(st);
    const list = PU.aiList(log), inc = PU.incidents(log), checkins = PU.sorted(log).reverse();
    main.innerHTML = `<section class="screen">
      <div class="pulse-status ${st.state}">
        <p class="big" style="margin:0">${esc(big)}<small>${esc(small)}</small></p>
        <button class="btn primary" type="button" data-act="start">${st.state === 'done' ? 'Record something now' : 'Start this month’s check-in'}</button>
      </div>
      ${!checkins.length && !hasBaseline() ? `<div class="callout" style="margin-top:14px;max-width:760px"><span class="k">Works best after the quick check</span><p>On its own, the monthly check-in finds only what is new. <a href="quick_check.html">The quick check</a> (5 minutes) finds what you already use.</p></div>` : ''}
      ${PU.backupDue(log, t) ? `<div class="callout" style="margin-top:14px;max-width:760px;--c:var(--check)"><span class="k">Time for a backup</span><p>Your check-ins are stored only in this browser. Download a copy and keep it with your other business records.</p><p><button class="btn" type="button" data-act="backup">Download a backup</button></p></div>` : ''}

      <h3 class="subhead">Reminders</h3>
      <div class="actions">
        <button class="btn" type="button" data-act="calendar">Add a monthly reminder to your calendar</button>
        <button class="btn" type="button" data-act="print-card">Print a card for the year</button>
      </div>
      <p class="small-note" style="margin-top:8px">The calendar file works with Apple Calendar, Outlook and Google Calendar (import it). On a phone, you can also add this page to your home screen.</p>

      <div class="pulse-cols">
        <div><h3 class="subhead">AI found by check-ins</h3>
          ${list.length ? `<ul class="log">${list.map(x => `<li><span class="d">${esc(x.date)}</span><span class="n"><b>${esc(x.name)}</b> ${x.source === 'connection' ? '&middot; connected' : x.source === 'statement' ? '&middot; on the statement' : ''}</span>${light(x.light)}</li>`).join('')}</ul>` : '<p class="empty">Nothing new yet.</p>'}</div>
        <div><h3 class="subhead">Things that went wrong</h3>
          ${inc.length ? `<ul class="log">${inc.map(i => `<li><span class="d">${esc(i.date)}</span><span class="n">${esc(i.text)}</span></li>`).join('')}</ul>` : `<p class="empty">${checkins.length ? 'None recorded. A month with no problems is also worth recording.' : 'Nothing yet.'}</p>`}</div>
      </div>

      <h3 class="subhead">Check-ins</h3>
      ${checkins.length ? `<ul class="log">${checkins.map(c => `<li><span class="d">${esc(c.date)}</span><span class="n">${esc(PU.summary(c))}</span>${light(PU.worst(c))}</li>`).join('')}</ul>` : '<p class="empty">None yet.</p>'}

      <h3 class="subhead">Your records</h3>
      <div class="actions">
        <button class="btn" type="button" data-act="backup">Download a backup</button>
        <button class="btn" type="button" data-act="restore">Restore from a backup</button>
        <button class="btn" type="button" data-act="csv">Download as a spreadsheet (CSV)</button>
        <button class="btn" type="button" data-act="carry">Download for the full check</button>
        ${checkins.length ? '<button class="btn quiet" type="button" data-act="wipe">Delete all check-ins</button>' : ''}
      </div>
      <input type="file" accept=".json,application/json" class="restore-input" id="restore-file" tabindex="-1" aria-hidden="true">
      <p class="status" id="status" role="status"></p>
    </section>
    ${printCard(t)}`;
  }
  function printCard(t){
    const c = PULSE.print_card;
    return `<section class="printcard" id="printcard" aria-hidden="true">
      <h2>${esc(c.title)}</h2>
      <ol>${c.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol>
      <p>${esc(c.sweep_note)} ${esc(c.after)}</p>
      <table><thead><tr><th>Month</th><th>New tool?</th><th>Went wrong?</th><th>Connected?</th><th>Statement</th><th>Notes</th></tr></thead>
      <tbody>${PU.monthsFrom(t, 12).map((m, i) => `<tr><td>${esc(m)}</td><td class="box">&#9744;</td><td class="box">&#9744;</td><td class="box">&#9744;</td><td class="box">${i % 3 === 0 ? '&#9744;' : ''}</td><td></td></tr>`).join('')}</tbody></table>
      <p style="font-size:12px">${esc(location.href.split(/[?#]/)[0])}</p>
    </section>`;
  }

  /* ---------- files ---------- */
  function say(msg){ const s = $('#status'); if (s) s.textContent = msg; }
  function download(text, name, type){
    const url = URL.createObjectURL(new Blob([text], {type}));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const stripIds = l => Object.assign({}, l, {checkins: l.checkins.map(({_id, ...c}) => c)});

  /* ---------- events ---------- */
  main.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.answer && onAnswer) return onAnswer(b.dataset.answer);
    if (b.dataset.card){ flow.pending.card = b.dataset.card; flow.pending.answers = {}; return goto('tool_q'); }
    switch (b.dataset.act){
      case 'start':
        flow = {stage: 'q_new', draft: Object.assign({_id: String(Date.now())}, PU.newCheckin(today())), sweep_due: PU.sweepDue(log, today())};
        return goto('q_new');
      case 'back': return history.back();
      case 'home': flow = {stage: 'home'}; return goto('home');
      case 'goto': return goto(b.dataset.to);
      case 'another': flow.pending = {name: '', card: null, answers: {}}; flow.tool_name = ''; return goto('tool_name');
      case 'text-next': {
        const v = $('#t-in').value.trim();
        const key = b.dataset.key;
        if (!v && key !== 'sweep_text'){ $('#t-in').focus(); $('#t-in').placeholder = 'A few words are enough'; return; }
        flow[key] = v;
        /* keep what was typed on this step, so Back shows it again */
        history.replaceState({pulse: clone(flow)}, '');
        if (key === 'tool_name') flow.pending.name = v;
        if (key === 'incident_text') flow.draft.incidents.push({text: v});
        return goto(b.dataset.next);
      }
      case 'calendar': {
        const st = PU.status(log, today());
        const start = PU.reminderStart(st.state === 'none' ? PU.addMonths(today(), 1) : st.next);
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
        download(PU.ics({start, stamp, url: location.href.split(/[?#]/)[0]}), 'ai_check_in.ics', 'text/calendar');
        sset('localStorage', CAL_KEY, today());
        return say(`Calendar file downloaded: a reminder on ${PU.fmtDate(start).replace(/, \d+$/, '')} and every month after. Open it to add it to your calendar.`);
      }
      case 'print-card': {
        const card = $('#printcard');
        card.classList.add('print-target'); document.body.classList.add('printing');
        return window.print();
      }
      case 'backup':
        download(JSON.stringify(stripIds(log), null, 2), `ai_check_ins_backup_${today()}.json`, 'application/json');
        log.last_backup = today(); saveLog();
        renderHome();
        return say('Backup downloaded. Keep it with your other business records.');
      case 'restore': return $('#restore-file').click();
      case 'csv':
        download(PU.csv(log), `ai_check_ins_${today()}.csv`, 'text/csv');
        return say('Spreadsheet downloaded. It opens in Excel, Numbers or Google Sheets.');
      case 'carry':
        download(JSON.stringify(PU.carryOver(log, today()), null, 2), `ai_check_ins_for_full_check_${today()}.json`, 'application/json');
        return say('Downloaded. The full check will be able to read this file.');
      case 'wipe':
        if (!confirm(`Delete all ${log.checkins.length} check-ins from this browser? This cannot be undone unless you have a backup.`)) return;
        sdel('localStorage', LOG_KEY);
        renderHome();
        return say('All check-ins deleted from this browser.');
    }
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    document.querySelectorAll('.print-target').forEach(x => x.classList.remove('print-target'));
  });
  /* restore: the file is read here, in the browser, and checked line by line */
  main.addEventListener('change', e => {
    if (e.target.id !== 'restore-file' || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const {log: next, dropped} = PU.restore(JSON.parse(reader.result), ctx());
        if (log.checkins.length && !confirm(`Replace the ${log.checkins.length} check-ins in this browser with the ${next.checkins.length} in the backup?`)) return;
        next.checkins.forEach((c, i) => { c._id = 'restored-' + i; });
        log = next;
        if (!saveLog()) return say('This browser is blocking storage, so the backup could not be restored here.');
        renderHome();
        say(`Restored ${plural(next.checkins.length, 'check-in')}.${dropped ? ` ${plural(dropped, 'entry', 'entries')} in the file couldn’t be read and ${dropped === 1 ? 'was' : 'were'} left out.` : ''}`);
      } catch (err) {
        say('That file could not be read as a check-in backup. Nothing was changed.');
      }
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = '';
  });
  main.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 't-in'){ e.preventDefault(); $('[data-act="text-next"]', main).click(); }
  });

  render();
})();
