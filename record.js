/* The AI use and risk record: the page. record_engine.js assembles the
   record from everything this browser keeps; this script draws it, and makes
   the copies: print (or save as PDF), Word, one file with everything, CSV.
   The owner never edits the document: the business name, re-confirming a
   control and signing are the only things typed here, and each is data. */
(function(){
  const R = RecordEngine, RC = RECORD, A = AnswersEngine, T = ToolEngine, K = RiskEngine, U = UI, PR = ProfileEngine;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = U.esc, fmt = U.fmtDate;
  const KEYS = {profile: 'sb-ai-playbook:profile', answers: 'sb-ai-playbook:answers', done: 'sb-ai-playbook:done',
    ai_list: 'sb-ai-playbook:ai-list', risk: 'sb-ai-playbook:risk', policy: 'sb-ai-playbook:policy',
    quick: 'sb-ai-playbook:quick', pulse: 'sb-ai-playbook:pulse', record: 'sb-ai-playbook:record'};
  const panel = $('#panel'), doc = $('#record-doc');
  $('#record-version').textContent = RC.version;

  const readAll = () => Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, U.store.get(key)]));
  let raw, inp, model, pending = null;
  function load(){
    raw = readAll();
    inp = R.gather(raw, U.today());
    model = R.build(inp, U.today());
  }
  const say = t => { $('#announce').textContent = ''; setTimeout(() => { $('#announce').textContent = t; }, 50); };
  const saveRecord = () => U.store.set(KEYS.record, inp.record);

  /* ---------- small pieces ---------- */
  const d = s => s ? fmt(s) : '';
  /* with no business name, the stand-in reads as ordinary words mid-sentence (this business) */
  const inSentence = b => b === RC.business_fallback ? b.charAt(0).toLowerCase() + b.slice(1) : b;
  const table = (head, rows, cls) => rows.length ? `<table class="rec-table${cls ? ' ' + cls : ''}"><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td data-label="${esc(head[i])}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  const gap = s => `<p class="rec-gap"><strong>Not yet completed.</strong> ${esc(s.empty.replace(/^Not yet completed\.\s*/, ''))} <a class="no-print" href="${s.fix}">Go there</a></p>`;
  const qa = list => list.length ? `<ul class="rec-qa">${list.map(a => `<li><span class="q">${esc(a.text)}</span> ${esc(a.value)}</li>`).join('')}</ul>` : '';
  const LIGHT = {green: 'go', amber: 'check', red: 'stop'};
  const light = (l, text) => `<span class="rec-light ${LIGHT[l] || ''}">${esc(text)}</span>`;

  /* ---------- the sections ---------- */
  const draw = {
    about(s){
      return `<p><strong>Self-assessment.</strong> ${esc(s.statement)}</p>
        <p>${esc(s.scope)} ${esc(s.not_covered)}</p>
        ${s.profile.length ? `<p>Business profile: ${esc(s.profile.join('; '))}.</p>` : `<p class="rec-gap">No business profile saved. <a class="no-print" href="profile.html">Set one up</a></p>`}`;
    },
    summary(s){
      const L = s.lights;
      return `<ul>
        <li>${s.uses} AI use${s.uses === 1 ? '' : 's'} in use: ${L.green} go, ${L.amber} go with conditions, ${L.red} stopped or paused.${s.retired ? ` ${s.retired} retired.` : ''}</li>
        <li>Risks: ${s.zones.act} to act on now, ${s.zones.plan} to plan for, ${s.zones.watch} to watch.${s.stopped ? ` ${s.stopped} use${s.stopped === 1 ? '' : 's'} stopped or paused.` : ''}</li>
        <li>${s.actions} open action${s.actions === 1 ? '' : 's'}.</li>
        <li>${s.controls.in_place} of ${s.controls.total} playbook controls in place.</li>
        <li>Last review or check-in: ${s.last_review ? d(s.last_review) : 'none yet'}.</li>
        ${s.to_check ? `<li>${s.to_check} found but not yet checked.</li>` : ''}
      </ul>`;
    },
    responsibility(s){
      if (s.status === 'empty') return gap(s);
      return table(['Role', 'Who', 'Recorded'], s.rows.map(r => [esc(r.role), esc(r.value), d(r.date)]))
        + (s.policy ? `<p>${esc(s.policy.text)}</p>` : '') + (s.status === 'partial' ? gap(s) : '');
    },
    discovery(s){
      let h = `<p class="rec-limit">${esc(s.limit)}</p>`;
      if (s.status === 'empty') return h + gap(s);
      if (s.sources.length) h += `<ul>${s.sources.map(x => `<li>${x.date ? d(x.date) + ': ' : ''}${esc(x.text)}</li>`).join('')}</ul>`;
      h += qa(s.answers);
      if (s.to_check.length) h += `<p><strong>Found but not yet checked:</strong> ${esc(s.to_check.map(q => q.label).join(', '))}.</p>`;
      return h + (s.status === 'partial' ? gap(s) : '');
    },
    ai_in_use(s){
      if (s.status === 'empty') return gap(s);
      return table(['Tool and use', 'Plan', 'What goes in', 'Status', 'Checked'], s.rows.map(r => [
        `<strong>${esc(r.tool)}</strong><br>${esc(r.use)}`, esc(r.plan), esc(r.information),
        `${light(r.light, r.light_label)}<br>${esc(r.state)}${r.open ? `<br>${r.open} to-do${r.open === 1 ? '' : 's'} open` : ''}`,
        `${d(r.checked)}${r.recheck_by ? `<br>Re-check by ${d(r.recheck_by)}` : ''}`]))
        + (s.retired.length ? `<p><strong>Retired:</strong> ${esc(s.retired.map(r => `${r.tool} (${r.use}), ${d(r.date)}`).join('; '))}.</p>` : '');
    },
    rules(s){
      if (s.status === 'empty') return gap(s);
      let h = '';
      if (s.policy){
        const p = s.policy;
        h += `<p>Our AI policy was adopted on ${d(p.adopted)} and is due for review on ${d(p.review)}.${p.blanks ? ' <strong>Some blanks in it are not filled in yet.</strong>' : ''}</p>`;
        const heads = p.sections.map(x => x.heading).filter(Boolean);
        h += `<p><strong>${esc(p.title)}</strong>${heads.length ? `, in ${heads.length} parts: ${esc(heads.join('; '))}.` : '.'} The full wording is in Appendix C.</p>`;
      }
      if (s.standing.length) h += `<h3>Standing rules from tool checks</h3><ul>${s.standing.map(r => `<li>${esc(r.text)} (${esc(r.tools.join(', '))})</li>`).join('')}</ul>`;
      if (s.answers.length) h += `<h3>From the playbook</h3>` + qa(s.answers);
      return h + (s.status === 'partial' ? gap(s) : '');
    },
    suppliers(s){
      if (s.status === 'empty') return gap(s);
      let h = s.rows.map(g => `<h3>${esc(g.tool)}${g.plan ? `: ${esc(g.plan.toLowerCase())}` : ''}</h3>` +
        table(['Question', 'Answer', 'How we know'], g.answers.map(a => [esc(a.question), a.dont_know ? `<strong>${esc(a.answer)}</strong>` : esc(a.answer),
          a.source ? `${esc(a.source)}${a.date ? `, ${d(a.date)}` : ''}` : 'No source noted']))).join('');
      if (s.public_only.length) h += `<p>Only public information goes into ${esc(s.public_only.join(', '))}, so no supplier questions were needed.</p>`;
      if (s.answers.length) h += `<h3>From the playbook</h3>` + qa(s.answers);
      return h;
    },
    risk(s){
      if (s.status === 'empty') return gap(s);
      const ROWS = ['high', 'moderate', 'low'], COLS = ['low', 'moderate', 'high'], L = RISK.level_labels;
      const grid = `<table class="rec-table rec-grid"><caption>How bad it would be (rows) against how likely it is as used today (columns)</caption>
        <thead><tr><th scope="col">Impact</th>${COLS.map(c => `<th scope="col">${L[c]} likelihood</th>`).join('')}</tr></thead><tbody>
        ${ROWS.map(r => `<tr><th scope="row">${L[r]}</th>${COLS.map(c => { const z = RISK.zones[r][c], n = s.grid[r + ':' + c] || [];
          return `<td class="z-${z}"><span class="zl">${esc(RISK.zone_labels[z])}</span>${n.length ? `<br>${esc(n.join('; '))}` : ''}</td>`; }).join('')}</tr>`).join('')}
        </tbody></table>`;
      const zs = o => `${o.act} to act on now, ${o.plan} to plan for, ${o.watch} to watch`;
      let h = grid + `<p>Now: ${zs(s.now)}. Before any to-dos were done: ${zs(s.before)}.${s.movement && s.movement.summary ? ` Since the snapshot of ${d(s.movement.since)}: ${esc(s.movement.summary)}.` : ''}</p>`;
      h += table(['Risk', 'Impact', 'Likelihood', 'Zone', 'Response'], s.rows.map(r => [
        `<strong>${esc(r.label)}</strong>${r.type ? `<br>${esc(r.type)}` : ''}${r.paused ? '<br>Paused' : ''}`, esc(r.impact),
        r.before === r.now ? esc(r.now) : `${esc(r.before)} before, ${esc(r.now)} now`, esc(r.zone_label),
        `${esc(r.response || 'Keep watching')}${r.owner ? `<br>${esc(r.owner)}` : ''}${r.due ? `<br>By ${d(r.due)}` : ''}`]));
      const notes = [];
      s.rows.forEach(r => {
        if (r.adjusted) notes.push(`${r.label}: position moved by us on ${d(r.adjusted.date)}. Reason: ${r.adjusted.reason}`);
        if (r.accept) notes.push(`${r.label}: we accept this risk. Approved by ${r.accept.by}. Reason: ${r.accept.reason}.${r.accept.review_by ? ` Review by ${d(r.accept.review_by)}.` : ''}`);
      });
      if (notes.length) h += `<ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
      if (s.stopped.length) h += `<h3>Stopped or paused uses</h3><ul>${s.stopped.map(x => `<li><strong>${esc(x.label)}</strong> (${x.paused ? 'paused' : 'not started'}): ${esc(x.reasons.join(' '))}</li>`).join('')}</ul>`;
      return h;
    },
    controls(s){
      const legend = `<p class="rec-legend">${Object.values(RC.levels).map(l => `<span><strong>${esc(l.label)}:</strong> ${esc(l.detail.toLowerCase())}.</span>`).join(' ')}</p>`;
      return legend + s.list.map(c => `<div class="rec-control">
        <h3>Step ${c.step}. ${esc(c.control)} <span class="rec-level ${c.level}">${esc(c.level_label)}</span></h3>
        ${qa(c.answers)}
        ${c.evidence ? `<p>How we know: ${esc(c.evidence)}</p>` : ''}
        ${c.confirmed_on ? `<p>Last re-confirmed ${d(c.confirmed_on)}.</p>` : ''}
        ${c.missing.length ? `<p class="rec-gap">${c.done ? 'Marked done, but not' : 'Not'} yet answered: ${esc(c.missing.join(' '))} <a class="no-print" href="playbook.html#step-${c.step}">Answer in the playbook</a></p>`
          : !c.done ? `<p class="rec-gap">Answered, but not marked done in the playbook. <a class="no-print" href="playbook.html#step-${c.step}">Open step ${c.step}</a></p>` : ''}
        ${c.level !== 'none' && c.level !== 'confirmed' ? `<p class="no-print"><button class="btn" type="button" data-confirm="${c.step}">Re-confirm this is still true</button></p>` : ''}
      </div>`).join('');
    },
    actions(s){
      if (!s.list.length) return `<p>${esc(s.none)}</p>`;
      return table(['Action', 'For', 'Who', 'By', 'Risk'], s.list.map(a => [esc(a.text), esc(a.tool || a.source), esc(a.owner || ''), a.due ? d(a.due) : '', esc(a.risk || '')]));
    },
    incidents(s){
      let h = s.plan.length ? `<h3>What we would do</h3>` + qa(s.plan) : '';
      h += s.list.length ? table(['Date', 'What happened', 'Where'], s.list.map(i => [d(i.date), esc(i.what), esc(i.tool ? `${i.tool} (${i.source})` : i.source)])) : `<p>${esc(s.none)}</p>`;
      return h;
    },
    reviews(s){
      let h = `<p>Last review (playbook step 9): ${s.last ? d(s.last) : 'not recorded'}. Next review: ${s.next ? d(s.next) : 'not set'}.</p>`;
      if (s.changed) h += `<p>Changed since the last review: ${esc(s.changed)}</p>`;
      if (s.checkins.length) h += `<h3>Monthly check-ins</h3><ul>${s.checkins.map(c => `<li>${d(c.date)}: ${esc(c.summary)}</li>`).join('')}</ul>`;
      if (s.snapshots.length) h += `<h3>Risk snapshots</h3><ul>${s.snapshots.map(x => `<li>${d(x.date)}: ${x.items} risk${x.items === 1 ? '' : 's'}${x.movement ? `; ${esc(x.movement)}` : ''}</li>`).join('')}</ul>`;
      h += `<h3>Sign-off</h3><p>${esc(RC.signoff.replace('{business}', inSentence(model.business)).replace('{date}', d(model.today)))}</p>`;
      h += s.signoff ? (s.signoff.current ? `<p><strong>Signed:</strong> ${esc(s.signoff.name)}, ${d(s.signoff.date)}</p>`
        : `<p class="rec-gap">${esc(RC.signoff_stale)} (Last signed by ${esc(s.signoff.name)}, ${d(s.signoff.date)}.)</p>`)
        : `<p class="rec-gap">Not signed yet.</p>`;
      return h;
    },
    framework(s){
      return `<p>The playbook step each control comes from, and the passages that step quotes.</p>` +
        table(['Step', 'Control', 'Evidence', 'Sources'], s.list.map(c => [c.step, esc(c.control), esc(c.level_label), esc(c.sources.join('; '))]));
    },
    industry(s){
      if (!s.notes.length) return `<p>${esc(s.none)}</p>`;
      return s.notes.map(n => `<h3>${esc(n.label)}</h3><p>${esc(n.summary)}</p><ul>${n.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        ${n.red_line ? `<p><strong>Red line:</strong> ${esc(n.red_line)}</p>` : ''}
        <p class="rec-flag">Check with an advisor. ${n.advice ? esc(n.advice) + ' ' : ''}Last reviewed ${d(n.last_reviewed)}.</p>`).join('');
    },
    policy_text(s){
      if (!s.policy) return `<p>${esc(s.none)}</p>`;
      const p = s.policy;
      return `<div class="rec-quote"><h3>${esc(p.title)}</h3>${p.sections.map(x => (x.heading ? `<h3>${esc(x.heading)}</h3>` : '') +
        x.blocks.map(b => b.p ? `<p>${esc(b.p)}</p>` : `<ul>${b.ul.map(li => `<li>${esc(li)}</li>`).join('')}</ul>`).join('')).join('')}</div>`;
    },
  };

  /* ---------- the document ---------- */
  function docHTML(m, n){
    const version = n || m.next_n;
    let h = `<header class="rec-head">
      <p class="rec-kicker">${esc(m.title)}</p>
      <h1>${esc(m.business)}</h1>
      <p class="rec-meta">Valid as of ${d(m.today)} &middot; Re-check by ${d(m.recheck_by)} &middot; Record version ${version}</p>`;
    if (m.draft) h += `<div class="rec-draft"><p><strong>Draft.</strong> This record is not complete yet. Still needed:</p>
      <ul>${m.missing.map(x => `<li>Section ${x.n}, ${esc(x.title)} <a class="no-print" href="${x.fix}">Go there</a></li>`).join('')}</ul></div>`;
    if (m.changes) h += `<div class="rec-changes"><h3>What changed since version ${m.last_copy.n} (${d(m.last_copy.date)})</h3>
      ${m.changes.length ? `<ul>${m.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : '<p>Nothing that the record tracks.</p>'}</div>`;
    h += `</header>`;
    m.sections.forEach(s => {
      if (s.appendix && s.id === 'framework') h += `<div class="page-break" aria-hidden="true"></div>`;
      h += `<section class="rec-sec" id="rec-${s.id}" aria-labelledby="rec-${s.id}-h"><h2 id="rec-${s.id}-h">${s.appendix ? 'Appendix ' : ''}${esc(s.n)}. ${esc(s.title)}</h2>${draw[s.id](s)}</section>`;
    });
    return h;
  }

  /* ---------- the panel: what's missing, and making copies ---------- */
  function panelHTML(m){
    const need = RC.minimum.map(id => m.sections.find(s => s.id === id));
    return `<div class="rec-status ${m.draft ? 'draft' : 'ready'}">
        <h2>${m.draft ? 'Draft: not yet complete' : 'Complete enough to share within the business'}</h2>
        <ul class="rec-need">${need.map(s => `<li class="${s.status === 'complete' ? 'done' : ''}"><span aria-hidden="true">${s.status === 'complete' ? '&#10003;' : '&#9675;'}</span>
          ${esc(s.n)}. ${esc(s.title)}: ${s.status === 'complete' ? 'done' : `<a href="${s.fix}">${s.status === 'partial' ? 'finish it' : 'start it'}</a>`}</li>`).join('')}</ul>
        ${m.stale ? `<p class="rec-gap">The re-check date has passed. Review the answers, then make a new copy.</p>` : ''}
        ${m.problems.length ? `<p class="rec-gap">${esc(m.problems.join(' '))} It is left out of the record.</p>` : ''}
      </div>
      <div class="rec-business">
        <label for="rec-business">Business name, as it should appear on the record</label>
        <input id="rec-business" class="textin" type="text" maxlength="120" value="${esc(inp.record.business)}" placeholder="${esc(inp.policy && inp.policy.a.business.trim() || 'Your business name')}">
      </div>
      <div class="rec-copies">
        <h2>Make a copy</h2>
        <p>${m.last_copy ? `Last copy: version ${m.last_copy.n}, ${d(m.last_copy.date)}.` : 'No copies made yet.'} Printing or downloading Word makes version ${m.next_n}.</p>
        <p class="rec-buttons">
          <button class="btn primary" type="button" data-act="print">Print or save as PDF</button>
          <button class="btn" type="button" data-act="word">Word</button>
          <button class="btn" type="button" data-act="json">Save everything (.json)</button>
          <button class="btn" type="button" data-act="open">Open a saved file</button>
          <input type="file" id="rec-file" accept="application/json,.json" hidden>
        </p>
        <p class="rec-buttons">
          <button class="btn quiet" type="button" data-act="csv-list"${inp.lines.length ? '' : ' disabled'}>AI list (.csv)</button>
          <button class="btn quiet" type="button" data-act="csv-risk"${m.sections.find(s => s.id === 'risk').status === 'empty' ? ' disabled' : ''}>Risk register (.csv)</button>
        </p>
        ${inp.lines.length ? '' : `<p class="why-off">The two spreadsheets turn on once a tool is on <a href="tool_check.html">your AI list</a>.</p>`}
        <p class="small-note">The Word copy can be edited, but edits made there do not update the record. The .json file contains everything this browser keeps for the playbook, so that you can move it to another browser or give it to an IT provider.</p>
        ${pending ? pendingHTML() : ''}
      </div>
      <div class="rec-sign">
        <h2>Sign it</h2>
        <p>${esc(RC.signoff.replace('{business}', inSentence(m.business)).replace('{date}', d(m.today)))}</p>
        ${m.draft ? `<p class="small-note">A draft cannot be signed.</p>` : `<p class="rec-signrow"><label for="rec-signer" class="visually-hidden">Your name</label>
          <input id="rec-signer" class="textin" type="text" maxlength="120" placeholder="Your name">
          <button class="btn" type="button" data-act="sign">Sign</button></p>`}
      </div>`;
  }
  function pendingHTML(){
    return `<div class="callout rec-import" role="alert"><p><strong>Replace what&rsquo;s in this browser?</strong> The file from ${d(pending.date)} holds: ${esc(pending.found.map(k => RC.parts[k]).join(', '))}.
      Opening it replaces those parts here. Anything not in the file is left as it is.</p>
      <p><button class="btn primary" type="button" data-act="import-yes">Replace</button> <button class="btn quiet" type="button" data-act="import-no">Cancel</button></p></div>`;
  }

  function render(n){
    load();
    panel.innerHTML = panelHTML(model);
    doc.innerHTML = docHTML(model, n);
    panel.hidden = doc.hidden = false;
    $('#watermark').hidden = !model.draft;
    $('#running').textContent = `${model.business}: AI use and risk record, version ${n || model.next_n}${model.draft ? ', draft' : ''}. Valid as of ${d(model.today)}; re-check by ${d(model.recheck_by)}. A self-assessment.`;
  }

  /* ---------- actions ---------- */
  let docxLib = null;
  const loadDocx = () => docxLib || (docxLib = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'docx.js'; s.onload = ok; s.onerror = () => { docxLib = null; fail(); };
    document.head.appendChild(s);
  }));
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'business';
  function stamp(n){ R.generate(inp.record, model, U.today()); saveRecord(); return n; }

  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, today = U.today();
    if (act === 'print'){
      const n = model.next_n;
      doc.innerHTML = docHTML(model, n);
      stamp(n);
      window.print();
      return;
    }
    if (act === 'word'){
      const n = model.next_n;
      loadDocx().then(() => {
        const copy = doc.cloneNode(true);
        copy.innerHTML = docHTML(model, n);
        copy.querySelectorAll('.no-print, .rec-kicker, .rec-head h1').forEach(x => x.remove());
        const footer = R.stamp(model, n) + (model.draft ? ' Draft: not complete.' : '');
        U.download(window.templateDocx(copy, `${model.business}: ${RC.title}`, {levels: true, footer}), `ai_use_and_risk_record_${slug(model.business)}_${today}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        stamp(n);
        render();
        say(`Word copy downloaded as version ${n}.`);
      }).catch(() => say('The Word maker could not be loaded. Try printing instead.'));
      return;
    }
    if (act === 'json'){
      U.download(JSON.stringify(R.bundle(readAll(), today), null, 2), `ai_playbook_everything_${today}.json`, 'application/json');
      return say('Saved. Keep the file in a safe place, because it contains names and answers you typed.');
    }
    if (act === 'open') return $('#rec-file').click();
    if (act === 'import-no'){ pending = null; return render(); }
    if (act === 'import-yes'){
      const data = pending.data;
      pending.found.forEach(k => U.store.set(KEYS[k], data[k]));
      pending = null;
      render();
      return say('Opened. The record now shows what was in the file.');
    }
    if (act === 'csv-list'){
      U.download(T.csv(inp.lines, inp.profile, today), `ai_list_${today}.csv`, 'text/csv');
      return say('AI list downloaded. It opens in Excel, Numbers or Google Sheets.');
    }
    if (act === 'csv-risk'){
      const {items, stopped} = K.items(inp.lines, inp.profile, inp.risk);
      U.download(K.csv(items, stopped), `ai_risk_register_${today}.csv`, 'text/csv');
      return say('Risk register downloaded. It opens in Excel, Numbers or Google Sheets.');
    }
    if (act === 'sign'){
      try {
        R.sign(inp.record, $('#rec-signer').value, model, today);
        saveRecord(); render();
        say('Signed.');
      } catch (err){ say(err.message); }
    }
  });
  panel.addEventListener('change', e => {
    if (e.target.id === 'rec-business'){
      inp.record.business = e.target.value.replace(/\s+/g, ' ').trim().slice(0, 120);
      saveRecord(); render(); say('Business name saved.');
    }
    if (e.target.id === 'rec-file' && e.target.files[0]){
      const f = e.target.files[0];
      if (f.size > 5e6) return say('That file is too large to be a saved record.');
      f.text().then(t => {
        const back = R.unbundle(JSON.parse(t), U.today());
        pending = Object.assign(back, {date: JSON.parse(t).generated});
        render();
        $('.rec-import button').focus();
      }).catch(err => say(err && err.message && /record/.test(err.message) ? err.message : 'That file could not be read.'));
    }
  });
  doc.addEventListener('click', e => {
    const b = e.target.closest('[data-confirm]');
    if (!b) return;
    const store = A.clean(U.store.get(KEYS.answers));
    try {
      A.confirm(store, b.dataset.confirm, inp.done, U.today());
      U.store.set(KEYS.answers, store);
      render();
      say(`Step ${b.dataset.confirm} re-confirmed.`);
      const h = $(`#rec-controls`);
      if (h) h.scrollIntoView({block: 'start'});
    } catch (err){ say(err.message); }
  });
  window.addEventListener('afterprint', () => render());
  window.addEventListener('storage', () => render());

  render();
})();
