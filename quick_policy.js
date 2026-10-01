/* D. Answers become the policy: the page. policy_engine.js writes the
   policy; this script asks the questions and shows the policy growing
   beside them.

   Where state lives: typed answers (business name, people's names) never go
   in the address. They stay in this tab (sessionStorage) so a reload
   resumes, and in this browser only if the owner presses Save. The quick
   check's answers arrive in the address after the #, as the quick check
   writes them, and pre-fill what they can. */
(function(){
  const PE = PolicyEngine, P = POLICY;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const main = $('#main'), root = $('#qc');
  const DRAFT_KEY = 'sb-ai-playbook:policy-draft';
  const SAVE_KEY = 'sb-ai-playbook:policy';

  const sget = (area, k) => { try { return window[area].getItem(k); } catch (e) { return null; } };
  const sset = (area, k, v) => { try { window[area].setItem(k, v); return true; } catch (e) { return false; } };
  const sdel = (area, k) => { try { window[area].removeItem(k); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const today = () => new Date().toLocaleDateString('en-CA');
  const wide = () => matchMedia('(min-width: 861px)').matches;
  const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const WHO = P.owner_labels;

  $('#policy-version').textContent = P.version;
  $('#policy-reviewed').textContent = PE.fmtDate(P.last_reviewed);

  /* ---------- state ---------- */
  const quick = QuickEngine.decode(location.hash);
  const hints = PE.quickHints(quick);
  let a, step;
  function fresh(){
    const a = PE.fromQuick(quick, PE.initial(today()));
    /* the business profile fills what the quick check didn't */
    let pt = {};
    try { pt = ProfileEngine.forTools(ProfileEngine.clean(JSON.parse(sget('localStorage', 'sb-ai-playbook:profile') || 'null'))); } catch (e) {}
    a.from_profile = [];
    if (pt.policy_team && !a.team){ a.team = pt.policy_team; a.from_profile.push('team'); }
    if (pt.industry && !a.industry){ PE.setIndustry(a, pt.industry); a.from_profile.push('industry'); }
    return a;
  }
  try {
    const d = JSON.parse(sget('sessionStorage', DRAFT_KEY) || 'null');
    if (d && d.a){ a = d.a; step = d.step; }
  } catch (e) {}
  if (!a){ a = fresh(); step = 0; }
  /* after a reload, the back button reloads the page with an older step */
  if (history.state && 'pol' in history.state) step = history.state.pol;
  const persist = () => sset('sessionStorage', DRAFT_KEY, JSON.stringify({a, step}));
  const qs = () => PE.visibleQuestions(a);
  function touched(key){ a.prefilled = a.prefilled.filter(k => k !== key); }

  /* ---------- moving between screens ---------- */
  let firstRender = true;
  function goto(s, push = true){
    step = s;
    persist();
    if (push) history.pushState({pol: step}, '');
    render();
  }
  window.addEventListener('popstate', e => {
    if (e.state && 'pol' in e.state){ step = e.state.pol; persist(); render(); }
  });
  history.replaceState({pol: step}, '');

  function render(){
    if (step !== 'done' && !(step >= 0 && step < qs().length)) step = Math.min(Math.max(0, step | 0), qs().length - 1);
    root.classList.toggle('started', step !== 0);
    if (step === 'done') renderDone();
    else {
      main.innerHTML = `<div class="pol-layout">
        <div class="pol-ask" id="ask"></div>
        <aside class="pol-preview" aria-label="Your policy so far">
          <div class="template">
            <div class="template-head"><span class="live"><i aria-hidden="true"></i>Your ${a.team === 'solo' ? 'rules' : 'policy'} so far</span><span>Updates as you answer</span></div>
            <div class="template-body" id="preview"></div>
          </div>
        </aside></div>`;
      renderAsk();
      updatePreview(false);
    }
    if (!firstRender){
      window.scrollTo(0, 0);
      const h = $('h2', main);
      if (h){ h.tabIndex = -1; h.focus({preventScroll: true}); }
    }
    firstRender = false;
  }

  /* ---------- the live preview ---------- */
  function updatePreview(flash = true){
    const pv = $('#preview');
    if (!pv) return;
    pv.innerHTML = PE.toHTML(PE.build(a));
    const sec = qs()[step].section;
    const els = $$(`[data-sec="${sec}"]`, pv);
    if (sec === 'title') els.unshift(pv.firstElementChild);
    els.forEach(el => {
      el.classList.add('editing');
      if (flash){ el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 450); }
    });
    /* keep the section in view inside the preview, without moving the page */
    if (wide() && els[0]) pv.scrollTo({top: Math.max(0, els[0].offsetTop - 30), behavior: flash ? smooth() : 'auto'});
  }

  /* ---------- building blocks for questions ---------- */
  const pressed = (key, val) => a[key] === val;
  const choice = (key, opts, row) => `<div class="answers${row ? ' row' : ''}" role="group">${opts.map(o =>
    `<button type="button" class="answer${o.id === 'not_sure' ? ' unsure' : ''}" data-set="${key}" data-val="${o.id}" aria-pressed="${pressed(key, o.id)}">${esc(o.label)}${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}</div>`;
  const ticks = (list, opts, ownKey, ownLabel) => `<ul class="ticks">${opts.map(o =>
    `<li><label class="tick${o.industry ? ' industry' : ''}"><input type="checkbox" data-list="${list}" value="${o.id}"${a[list].includes(o.id) ? ' checked' : ''}><span>${esc(o.label)}${o.industry ? '<span class="tag-ind">Suggested for your industry</span>' : ''}</span></label></li>`).join('')}
    ${ownKey ? a[ownKey].map((s, i) => `<li><span class="tick own"><span>${esc(s)}</span><button type="button" class="x" data-remove="${ownKey}" data-i="${i}" aria-label="Remove ${esc(s)}">&times;</button></span></li>`).join('') : ''}</ul>
    ${ownKey ? addField(ownKey, ownLabel) : ''}`;
  const addField = (key, label) => `<div class="field"><label for="add-${key}">${esc(label)}</label>
    <div class="inline-add"><input type="text" id="add-${key}" data-add-input="${key}" autocomplete="off" maxlength="140"><button type="button" class="btn" data-add="${key}">Add</button></div></div>`;
  const textField = (key, label, extra = '') => `<div class="field"><label for="f-${key}">${esc(label)}</label>
    <input type="text" id="f-${key}" data-text="${key}" value="${esc(a[key])}" maxlength="120" ${extra}></div>`;

  const BODY = {
    setup: () => `
      ${choice('team', P.team)}
      <fieldset class="chips" style="margin-top:22px">
        <legend>${esc(PROFILE_OPTIONS.industry.label)} <span class="small-note">Optional</span></legend>
        <p class="why">Adds suggestions for your industry to the never-put-in list.</p>
        <div class="chiprow">${PROFILE_OPTIONS.industry.options.map(o => `<button type="button" class="chip" data-ind="${o.id}" aria-pressed="${a.industry === o.id}">${esc(o.label)}</button>`).join('')}</div>
      </fieldset>`,
    business: () => textField('business', 'Business name', 'autocomplete="organization"'),
    decider: () => `
      <div class="chiprow" style="margin-top:18px">${['the owner', 'the office manager'].map(v => `<button type="button" class="chip" data-quicktext="decider" data-val="${v}" aria-pressed="${a.decider === v}">${esc(v.charAt(0).toUpperCase() + v.slice(1))}</button>`).join('')}</div>
      ${textField('decider', 'Or type a name or role', 'autocomplete="name"')}`,
    tools: () => {
      const names = a.tools.map(t => t.name.toLowerCase());
      const notYet = a.tools.some(t => t.account !== 'business');
      return `
        ${hints.activities.length || hints.personal ? `<div class="callout reminder"><span class="k">From your quick check</span>
          ${hints.activities.length ? `<p>You said AI helps with:</p><ul>${hints.activities.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p>Which tools do those tasks?</p>` : ''}
          ${hints.personal ? `<p><b>Some work happens on personal or free accounts.</b> Add those tools too, and mark them Not yet.</p>` : ''}</div>` : ''}
        <div class="chiprow tools">${P.common_tools.map(t => `<button type="button" class="chip" data-tool="${esc(t)}" aria-pressed="${names.includes(t.toLowerCase())}">${esc(t)}</button>`).join('')}</div>
        ${a.tools.length ? `<ul class="approved-tools">${a.tools.map((t, i) => `<li class="approved-tool"><span class="name">${esc(t.name)}</span>
          <span class="seg" role="group" aria-label="Account for ${esc(t.name)}">${P.account_options.map(o => `<button type="button" class="${o.id === 'not_yet' ? 'notyet' : ''}" data-acct="${i}" data-val="${o.id}" aria-pressed="${t.account === o.id}">${esc(o.label)}</button>`).join('')}</span>
          <button type="button" class="x" data-rmtool="${i}" aria-label="Remove ${esc(t.name)}">&times;</button></li>`).join('')}</ul>` : ''}
        ${addField('tool', 'Add another tool, or AI built into software you use')}
        <p class="hint" style="margin-top:12px">${esc(P.account_hint)} A tool not marked as a business account is treated as not yet.</p>
        ${notYet ? `<div class="field"><label for="f-not_yet_by">Move them to business accounts by</label><input type="date" id="f-not_yet_by" data-text="not_yet_by" value="${esc(a.not_yet_by)}" min="${today()}"></div>` : ''}`;
    },
    never: () => ticks('never', PE.neverOptions(a.industry), 'never_other', 'Add something specific to your business'),
    people_info: () => choice('people_info', P.people_info_options),
    checks: () => ticks('checks', P.check_options, 'checks_other', 'Add another kind of work'),
    decisions: () => `${choice('decisions', P.yes_no, true)}
      ${a.decisions === 'yes' ? `<p class="example" style="margin-top:18px">Which decisions?</p>${ticks('decision_kinds', P.decision_kinds)}` : ''}`,
    acts: () => choice('acts', P.yes_no_not_sure),
    telling: () => `<div class="answers" role="group">${P.telling_options.map(o =>
      `<button type="button" class="answer" data-tell="${o.id}" aria-pressed="${a.telling.includes(o.id)}">${esc(o.label)}</button>`).join('')}</div>
      <p class="hint" style="margin-top:10px">Check all that apply.</p>`,
    incident: () => `${textField('incident_who', 'Who to tell', `placeholder="${esc(a.decider || 'Name or role')}" autocomplete="name"`)}
      <p class="example" style="margin-top:18px">How fast?</p>${choice('incident_speed', P.speed_options, true)}`,
    recording: () => choice('recording', P.yes_no_not_sure),
    review: () => `<div class="field"><label for="f-review">Next review</label><input type="date" id="f-review" data-text="review" value="${esc(a.review)}" min="${today()}"></div>
      <div class="chiprow" style="margin-top:10px">${[3, 6].map(n => `<button type="button" class="chip" data-months="${n}">${n} months from now</button>`).join('')}</div>`,
  };

  /* ---------- a question ---------- */
  function loadSaved(){
    try { const s = JSON.parse(sget('localStorage', SAVE_KEY) || 'null'); return s && s.a ? s : null; } catch (e) { return null; }
  }
  function renderAsk(focusSel){
    const list = qs(), q = list[step];
    const pre = q.id === 'setup' ? a.prefilled.includes('industry') : a.prefilled.includes(q.id);
    const fromProfile = q.id === 'setup' && (a.from_profile || []).length;
    const saved = step === 0 && loadSaved();
    $('#ask').innerHTML = `<section class="screen">
      ${step === 0 && quick && a.prefilled.length ? `<div class="callout resume"><span class="k">Carried over from your quick check</span><p>${a.prefilled.length} answer${a.prefilled.length > 1 ? 's are' : ' is'} already filled in. You can change any of them.</p></div>` : ''}
      ${saved ? `<div class="callout resume"><span class="k">Saved in this browser</span><p>You saved a policy on ${esc(PE.fmtDate(saved.saved_on))}.</p><p><button class="btn" type="button" data-act="open-saved">Open it</button> <button class="btn quiet" type="button" data-act="forget">Delete it</button></p></div>` : ''}
      ${progressBar({left: '<b>Your AI policy</b>', n: step + 1, total: list.length})}
      ${pre ? '<p class="from-quick">Filled in from your quick check</p>' : fromProfile ? '<p class="from-quick">Filled in from your business profile</p>' : ''}
      <h2>${esc((a.team === 'solo' && q.solo_text) || q.text)}</h2>
      ${q.why ? `<p class="example">${esc(q.why)}</p>` : ''}
      ${BODY[q.id]()}
      <div class="nav-row">
        ${step > 0 ? '<button class="btn quiet" type="button" data-act="back">&larr; Back</button>' : ''}
        <span class="spacer"></span>
        <button class="btn primary" type="button" data-act="next">${step === list.length - 1 ? `See your ${a.team === 'solo' ? 'rules' : 'policy'}` : 'Next'}</button>
      </div>
      <p class="small-note" style="margin-top:12px">Anything you skip stays highlighted in the ${a.team === 'solo' ? 'rules' : 'policy'} so you can fill it in later.</p>
    </section>`;
    if (focusSel){ const el = $(focusSel, main); if (el) el.focus(); }
  }
  /* after a change that redraws the question, put focus back where it was */
  function redraw(focusSel){ persist(); renderAsk(focusSel); updatePreview(); }

  /* ---------- finished ---------- */
  function slug(s){ return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'our'; }
  function renderDone(){
    const doc = PE.build(a);
    const html = PE.toHTML(doc);
    const blanks = (html.match(/class="fill"/g) || []).length;
    const noun = a.team === 'solo' ? 'rules' : 'policy';
    main.innerHTML = `<section class="screen">
      <p class="step-label"><b>Your AI policy</b><span>Ready</span></p>
      <h2>Your ${a.team === 'solo' ? 'AI rules and settings are' : 'AI policy is'} ready</h2>
      ${blanks ? `<div class="callout blanks-note"><p><b>${blanks} blank${blanks > 1 ? 's' : ''} still to fill,</b> highlighted in yellow. <button class="btn quiet" type="button" data-act="fill-blanks">Fill them in now</button> or after you download it.</p></div>` : ''}
      <div class="done-grid">
        <div class="template" id="t-policy">
          <div class="template-head"><span>Your ${noun} &middot; one page</span><span class="acts">
            <button class="btn" type="button" data-act="print" data-target="t-policy">Print or PDF</button>
            <button class="btn" type="button" data-act="word">Word</button>
            <button class="btn" type="button" data-act="copy">Copy</button></span></div>
          <div class="template-body" id="policy-body">${html}</div>
        </div>
        <div class="done-side">
          <div class="template never-sheet" id="t-never">
            <div class="template-head"><span>Never-put-in list &middot; pin it up</span><span class="acts">
              <button class="btn" type="button" data-act="print" data-target="t-never">Print</button>
              <button class="btn" type="button" data-act="copy-never">Copy</button></span></div>
            <div class="template-body">${PE.neverHTML(doc)}</div>
          </div>
          <div>
            <h3 class="subhead">Still to do</h3>
            ${doc.todos.length ? `<ul class="todos">${doc.todos.map(t => `<li>${esc(t.text)} <span class="who" style="--l:var(--check-line)">${esc(WHO[t.owner])}</span></li>`).join('')}</ul>` : '<p>Nothing left from your answers.</p>'}
          </div>
          <div>
            <h3 class="subhead">Keep this</h3>
            <div class="actions">
              <button class="btn" type="button" data-act="save">Save in this browser</button>
              <button class="btn" type="button" data-act="edit">Change answers</button>
              <button class="btn quiet" type="button" data-act="restart">Start again</button>
            </div>
            <p class="status" id="status" role="status"></p>
          </div>
          <div>
            <h3 class="subhead">Next</h3>
            <div class="cards" style="grid-template-columns:1fr">
              ${a.team === 'solo' ? '' : '<a class="card" href="guide-ai-policy.html#rollout" style="--c:var(--part1)"><span class="k">Guide</span><span class="t">Introducing it to the team</span><span class="d">Go through it together, and keep a note of who has read it.</span></a>'}
              <a class="card" href="quick_pulse.html" style="--c:var(--part3)"><span class="k">1 minute a month</span><span class="t">Monthly AI check-in</span><span class="d">Three questions a month keep this ${noun} and your AI list current.</span></a>
              <a class="card" href="playbook.html#step-3" style="--c:var(--part1)"><span class="k">Playbook step 3</span><span class="t">Write an AI policy</span><span class="d">What ${a.team === 'solo' ? 'these rules cover' : 'this policy covers'}, and when to update it.</span></a>
              ${quick ? '' : '<a class="card" href="quick_check.html" style="--c:var(--part3)"><span class="k">10 minutes</span><span class="t">Run the quick check</span><span class="d">Red flags, and what you use AI for. Its answers fill in parts of this.</span></a>'}
            </div>
          </div>
        </div>
      </div>
      <div class="nav-row"><button class="btn quiet" type="button" data-act="back">&larr; Back to the last question</button></div>
    </section>`;
    root.classList.add('started');
  }

  function say(msg){ const s = $('#status'); if (s) s.textContent = msg; }
  let docxLib;
  const loadDocx = () => docxLib || (docxLib = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'docx.js'; s.onload = ok;
    s.onerror = () => { docxLib = null; fail(); };
    document.head.appendChild(s);
  }));
  function downloadBlob(blob, name){
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function copyText(t, done){
    try { await navigator.clipboard.writeText(t); say(done); }
    catch (e) { say('This browser blocked copying. Use Word or Print instead.'); }
  }
  /* the first question with a blank in the section it writes */
  function firstBlank(){
    const tmp = document.createElement('div');
    tmp.innerHTML = PE.toHTML(PE.build(a));
    const list = qs();
    const i = list.findIndex(q => q.section === 'title'
      ? (q.id === 'business' && $('.fill', tmp.firstElementChild)) || (q.id === 'decider' && $('[data-sec="title"] .fill', tmp))
      : $(`[data-sec="${q.section}"] .fill`, tmp));
    return i < 0 ? 0 : i;
  }

  /* ---------- events ---------- */
  main.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.set){
      a[d.set] = d.val; touched(d.set);
      if (d.set === 'decisions' && d.val === 'no') a.decision_kinds = [];
      return redraw(`[data-set="${d.set}"][data-val="${d.val}"]`);
    }
    if (d.ind){
      PE.setIndustry(a, a.industry === d.ind ? null : d.ind); touched('industry');
      return redraw(`[data-ind="${d.ind}"]`);
    }
    if (d.quicktext){
      a[d.quicktext] = d.val;
      return redraw(`[data-quicktext="${d.quicktext}"][data-val="${d.val}"]`);
    }
    if (d.tool){
      const i = a.tools.findIndex(x => x.name.toLowerCase() === d.tool.toLowerCase());
      if (i >= 0) a.tools.splice(i, 1); else a.tools.push({name: d.tool, account: null});
      return redraw(`[data-tool="${CSS.escape(d.tool)}"]`);
    }
    if (d.acct !== undefined){
      a.tools[+d.acct].account = d.val;
      return redraw(`[data-acct="${d.acct}"][data-val="${d.val}"]`);
    }
    if (d.rmtool !== undefined){ a.tools.splice(+d.rmtool, 1); return redraw('#add-tool'); }
    if (d.tell){
      const x = d.tell, exclusive = ['not_yet', 'no_ai'];
      if (a.telling.includes(x)) a.telling = a.telling.filter(v => v !== x);
      else a.telling = exclusive.includes(x) ? [x] : a.telling.filter(v => !exclusive.includes(v)).concat(x);
      touched('telling');
      return redraw(`[data-tell="${x}"]`);
    }
    if (d.add){
      const input = $(`[data-add-input="${d.add}"]`, main);
      const v = input.value.trim();
      if (v){
        if (d.add === 'tool'){ if (!a.tools.some(x => x.name.toLowerCase() === v.toLowerCase())) a.tools.push({name: v, account: null}); }
        else if (!a[d.add].includes(v)){ a[d.add].push(v); if (d.add === 'never_other') a.never_touched = true; }
      }
      return redraw(`#add-${d.add}`);
    }
    if (d.remove){ a[d.remove].splice(+d.i, 1); return redraw(`#add-${d.remove}`); }
    if (d.months){ a.review = PE.addMonths(today(), +d.months); return redraw(`[data-months="${d.months}"]`); }

    switch (d.act){
      case 'next': return goto(step === qs().length - 1 ? 'done' : step + 1);
      case 'back': return history.back();
      case 'edit': return goto(1);
      case 'fill-blanks': return goto(firstBlank());
      case 'restart':
        a = fresh(); sdel('sessionStorage', DRAFT_KEY);
        return goto(0);
      case 'open-saved': { const s = loadSaved(); a = s.a; return goto('done'); }
      case 'forget': sdel('localStorage', SAVE_KEY); return redraw();
      case 'print': {
        const target = document.getElementById(d.target);
        target.classList.add('print-target'); document.body.classList.add('printing');
        window.print();
        return;
      }
      case 'word': {
        const doc = PE.build(a);
        try {
          await loadDocx();
          downloadBlob(window.templateDocx($('#policy-body'), PE.text(doc.title)),
            `${slug(a.business)}_ai_${a.team === 'solo' ? 'rules' : 'policy'}.docx`);
          say('Downloaded as a Word document. The yellow parts are the blanks still to fill.');
        } catch (err) { say('The Word download did not work in this browser. Use Print or PDF instead.'); }
        return;
      }
      case 'copy': return copyText(PE.plain(PE.build(a)), 'Copied as plain text, ready to paste into an email or document.');
      case 'copy-never': {
        const n = PE.build(a).never_sheet;
        return copyText([PE.text(n.title)].concat(n.items.map(i => '- ' + i), PE.text(n.after)).join('\n'), 'Never-put-in list copied, ready to paste into your team chat.');
      }
      case 'save': {
        const ok = sset('localStorage', SAVE_KEY, JSON.stringify({a, saved_on: today(), policy_version: P.version}));
        return say(ok ? 'Saved in this browser only. Clearing your browser data deletes it.' : 'This browser is blocking storage, so nothing was saved. Use Word or Copy instead.');
      }
    }
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    $$('.print-target').forEach(x => x.classList.remove('print-target'));
  });

  main.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.list){
      const list = a[el.dataset.list];
      if (el.checked && !list.includes(el.value)) list.push(el.value);
      if (!el.checked) a[el.dataset.list] = list.filter(v => v !== el.value);
      if (el.dataset.list === 'never') a.never_touched = true;
      persist(); updatePreview();
    }
  });
  main.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.text){
      a[el.dataset.text] = el.value;
      persist(); updatePreview();
    }
  });
  main.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const add = e.target.dataset.addInput;
    if (add) $(`[data-add="${add}"]`, main).click();
    else if (e.target.dataset.text) $('[data-act="next"]', main).click();
  });

  render();
})();
