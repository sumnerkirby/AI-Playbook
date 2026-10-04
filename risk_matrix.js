/* The risk overview: the page. risk_engine.js suggests every position; this
   script draws the grid (inline SVG, no charting library), the register and
   the forms. The grid has a table version for screen readers, and every
   cell names its zone in text. */
(function(){
  const K = RiskEngine, T = ToolEngine, RK = RISK, U = UI, PR = ProfileEngine;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const main = $('#main');
  const esc = U.esc;
  const KEY = 'sb-ai-playbook:risk';
  const L = l => RK.level_labels[l] || '';
  $('#risk-version').textContent = RK.version;

  const P = PR.clean(U.store.get('sb-ai-playbook:profile'));
  function loadLines(){
    const raw = U.store.get('sb-ai-playbook:ai-list');
    try { return raw ? T.restore(raw, P, U.today()).lines : []; } catch (e) { return []; }
  }
  const lines = loadLines();
  let store = K.cleanStore(U.store.get(KEY));
  const save = () => U.store.set(KEY, store);
  const opts = {split: false, before: true};
  const errors = {};

  /* ---------- the grid ---------- */
  const ROWS = ['high', 'moderate', 'low'], COLS = ['low', 'moderate', 'high'];
  const ZFILL = {act: 'var(--act)', plan: 'var(--plan)', watch: 'var(--watch)'};
  const ZINK = {act: 'var(--act-ink)', plan: 'var(--plan-ink)', watch: 'var(--watch-ink)'};
  function gridSVG(items, pre = 'mx'){
    const X0 = 96, Y0 = 14, CW = 140, CH = 108, W = X0 + 3 * CW + 10, H = Y0 + 3 * CH + 58;
    const cellXY = (imp, lik) => [X0 + COLS.indexOf(lik) * CW, Y0 + ROWS.indexOf(imp) * CH];
    const used = {}, over = {};
    /* "now" markers: two rows of four in the upper part of a cell; "before"
       markers: one row along the bottom, so arrows don't cross other
       markers in the same cell. Anything more becomes "+N more". */
    function slot(imp, lik, before){
      const k = imp + lik + (before ? ':b' : ''), n = used[k] = (used[k] || 0) + 1;
      if (n > (before ? 4 : 8)){ over[imp + lik] = (over[imp + lik] || 0) + 1; return null; }
      const [x, y] = cellXY(imp, lik);
      return before ? [x + 22 + (n - 1) * 31, y + 88] : [x + 22 + ((n - 1) % 4) * 31, y + 40 + Math.floor((n - 1) / 4) * 25];
    }
    const counts = {act: 0, plan: 0, watch: 0};
    items.forEach(i => counts[i.zone]++);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${pre}-t ${pre}-d" xmlns="http://www.w3.org/2000/svg">
      <title id="${pre}-t">Risk matrix</title>
      <desc id="${pre}-d">${counts.act} in Act now, ${counts.plan} in Plan, ${counts.watch} in Watch. The same items are listed below in priority order, and in the table version of the grid.</desc>
      <defs><marker id="${pre}-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:#4C5A68"/></marker></defs>`;
    ROWS.forEach(imp => COLS.forEach(lik => {
      const z = RK.zones[imp][lik], [x, y] = cellXY(imp, lik);
      s += `<rect x="${x}" y="${y}" width="${CW - 3}" height="${CH - 3}" rx="3" style="fill:${ZFILL[z]};stroke:#CFD7DF"/>
        <text x="${x + 9}" y="${y + 18}" style="font:600 10px var(--mono);letter-spacing:.1em;fill:${ZINK[z]}">${esc(RK.zone_labels[z].toUpperCase())}</text>`;
    }));
    ROWS.forEach(imp => { const [, y] = cellXY(imp, 'low'); s += `<text x="${X0 - 10}" y="${y + CH / 2}" text-anchor="end" style="font:600 13px var(--display);fill:#111A22">${L(imp)}</text>`; });
    COLS.forEach(lik => { const [x] = cellXY('low', lik); s += `<text x="${x + CW / 2}" y="${Y0 + 3 * CH + 16}" text-anchor="middle" style="font:600 13px var(--display);fill:#111A22">${L(lik)}</text>`; });
    s += `<text x="16" y="${Y0 + 1.5 * CH}" text-anchor="middle" transform="rotate(-90 16 ${Y0 + 1.5 * CH})" style="font:10.5px var(--mono);letter-spacing:.1em;fill:#4C5A68">HOW BAD IF IT GOES WRONG</text>
      <text x="${X0 + 1.5 * CW}" y="${Y0 + 3 * CH + 40}" text-anchor="middle" style="font:10.5px var(--mono);letter-spacing:.1em;fill:#4C5A68">HOW LIKELY, AS IT&#8217;S USED TODAY</text>`;

    /* before markers and arrows first, so the "now" markers sit on top */
    const nowPos = items.map(i => slot(i.impact, i.now));
    if (opts.before) items.forEach((i, n) => {
      if (i.before === i.now || !nowPos[n]) return;
      const b = slot(i.impact, i.before, true);
      if (!b) return;
      const [x1, y1] = b, [x2, y2] = nowPos[n];
      const d = Math.hypot(x2 - x1, y2 - y1) || 1;
      s += `<circle cx="${x1}" cy="${y1}" r="8" style="fill:#fff;stroke:#7B8894;stroke-dasharray:2 2"/>
        <text x="${x1}" y="${y1 + 3.5}" text-anchor="middle" style="font:600 8.5px var(--mono);fill:#4C5A68">${n + 1}</text>
        <line x1="${x1 + (x2 - x1) * 9 / d}" y1="${y1 + (y2 - y1) * 9 / d}" x2="${x2 - (x2 - x1) * 13 / d}" y2="${y2 - (y2 - y1) * 13 / d}" marker-end="url(#${pre}-arr)" style="stroke:#4C5A68;stroke-width:1.4"/>`;
    });
    items.forEach((i, n) => {
      if (!nowPos[n]) return;
      const [x, y] = nowPos[n];
      s += i.paused
        ? `<circle cx="${x}" cy="${y}" r="11" style="fill:#fff;stroke:#111A22;stroke-width:1.8"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="font:600 10.5px var(--mono);fill:#111A22">${n + 1}</text>`
        : `<circle cx="${x}" cy="${y}" r="11" style="fill:#111A22"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="font:600 10.5px var(--mono);fill:#fff">${n + 1}</text>`;
    });
    Object.entries(over).forEach(([k, n]) => {
      const imp = ROWS.find(r => k.startsWith(r)), lik = k.slice(imp.length);
      const [x, y] = cellXY(imp, lik);
      s += `<text x="${x + CW - 10}" y="${y + 18}" text-anchor="end" style="font:600 10px var(--mono);fill:#111A22">+${n} more</text>`;
    });
    return s + '</svg>';
  }
  function gridTable(items){
    return `<table><thead><tr><th scope="col">How bad \\ how likely</th>${COLS.map(c => `<th scope="col">${L(c)} likelihood</th>`).join('')}</tr></thead><tbody>
      ${ROWS.map(r => `<tr><th scope="row">${L(r)} impact</th>${COLS.map(c => {
        const here = items.map((i, n) => [i, n]).filter(([i]) => i.impact === r && i.now === c);
        return `<td><b>${esc(RK.zone_labels[RK.zones[r][c]])}</b>${here.length ? '<br>' + here.map(([i, n]) => `${n + 1}. ${esc(i.label)}${i.paused ? ' (paused)' : ''}`).join('<br>') : ''}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
  }

  /* ---------- one register entry ---------- */
  const zb = z => `<span class="zbadge ${z}">${esc(RK.zone_labels[z])}</span>`;
  const sel = (name, list, cur, labelOf, extra) => `<select name="${name}"${extra || ''}>${list.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(labelOf(v))}</option>`).join('')}</select>`;
  function itemHTML(i, n){
    const r = store.response[i.id] || {};
    const moved = i.before !== i.now;
    const fid = f => `f-${esc(i.id)}-${f}`;  /* ties each label to its field */
    return `<li class="ritem ${i.zone}" id="ri-${esc(i.id)}">
      <div class="top"><span class="num${i.paused ? ' hollow' : ''}" aria-hidden="true">${n + 1}</span><span class="t"><span class="visually-hidden">${n + 1}. </span>${esc(i.label)}</span>
        ${zb(i.zone)}${i.type ? ` <span class="badge">${esc(K.typeLabel(i.type))}</span>` : ''}${i.source === 'custom' ? ' <span class="badge">Business-wide</span>' : ''}</div>
      <p class="pos">Impact <b>${L(i.impact)}</b> &middot; Likelihood ${moved ? `<b>${L(i.before)}</b> before, <b>${L(i.now)}</b> now` : `<b>${L(i.now)}</b>`}${i.paused ? ' &middot; <b>Paused:</b> a red line is crossed' : ''}${i.zone_before !== i.zone ? ` &middot; was ${esc(RK.zone_labels[i.zone_before])}` : ''}</p>
      ${i.ai_list ? `<p class="on-list">On your AI list: <b>${esc(i.ai_list)}</b>.${i.zone === 'act' && !i.red ? ' The list shows whether you can use it. This page shows how much is at stake if it goes wrong.' : ''}</p>` : ''}
      ${i.adjusted ? `<span class="adjusted">Moved by you: ${esc(i.adjusted.reason)} (suggested: impact ${L(i.suggested.impact)}, likelihood ${L(i.suggested.now)})</span>` : ''}
      <ul class="why">${i.why.impact.map(w => `<li>${esc(w)}</li>`).join('')}
        ${i.why.raises.map(w => `<li>Raises the likelihood: ${esc(w)}</li>`).join('')}
        ${i.why.lowers.map(w => `<li>Lowers the likelihood: ${esc(w)}</li>`).join('')}
        ${i.why.control ? `<li>Control: ${esc(i.why.control)}</li>` : ''}</ul>
      ${i.response ? `<p class="small-note" style="margin:6px 0 0">Response: ${esc(RK.responses.find(x => x.id === i.response).label)}${i.owner ? ` &middot; ${esc(i.owner)}` : ''}${i.due ? ` &middot; due ${esc(U.fmtDate(i.due))}` : ''}${i.review_by ? ` &middot; review by ${esc(U.fmtDate(i.review_by))}` : ''}</p>` : ''}
      <details${errors['resp:' + i.id] ? ' open' : ''}><summary>Response, owner and dates</summary>
        <form data-resp="${esc(i.id)}">
          <div><label class="lab" for="${fid('response')}">What you will do</label><select name="response" id="${fid('response')}">${RK.responses.map(x => `<option value="${x.id}"${x.id === (r.response || i.response || 'mitigate') ? ' selected' : ''}${x.id === 'accept' && !i.can_accept ? ' disabled' : ''}>${esc(x.label)}: ${esc(x.detail)}${x.id === 'accept' && !i.can_accept ? ' (not for red lines)' : ''}</option>`).join('')}</select></div>
          <div class="row"><div style="flex:1 1 180px"><label class="lab" for="${fid('owner')}">Owner</label><input type="text" name="owner" id="${fid('owner')}" maxlength="80" value="${esc(r.owner || '')}"></div>
            <div><label class="lab" for="${fid('due')}">Due</label><input type="date" name="due" id="${fid('due')}" value="${esc(r.due || '')}"></div>
            <div><label class="lab" for="${fid('review')}">Review by</label><input type="date" name="review_by" id="${fid('review')}" value="${esc(r.review_by || (r.accept && r.accept.review_by) || '')}"></div></div>
          <div class="row"><div style="flex:1 1 160px"><label class="lab" for="${fid('by')}">If accepting it: who approves</label><input type="text" name="by" id="${fid('by')}" maxlength="80" value="${esc(r.accept ? r.accept.by : '')}"></div>
            <div style="flex:2 1 220px"><label class="lab" for="${fid('reason')}">Reason</label><input type="text" name="reason" id="${fid('reason')}" maxlength="300" value="${esc(r.accept ? r.accept.reason : '')}"></div></div>
          ${errors['resp:' + i.id] ? `<p class="errmsg" role="alert">${esc(errors['resp:' + i.id])}</p>` : ''}
          <div><button class="btn" type="submit">Save</button></div>
        </form></details>
      ${i.source === 'use' ? `<details${errors['adj:' + i.id] ? ' open' : ''}><summary>Move this position</summary>
        <form data-adj="${esc(i.id)}">
          <p class="small-note" style="margin:0">The position is suggested from your answers. If you know something the answers do not show, move it and give the reason. It will be marked as moved by you.</p>
          <div class="row"><div><label class="lab" for="${fid('impact')}">Impact</label>${sel('impact', RK.levels, i.impact, L, ` id="${fid('impact')}"`)}</div><div><label class="lab" for="${fid('likelihood')}">Likelihood now</label>${sel('likelihood', RK.levels, i.now, L, ` id="${fid('likelihood')}"`)}</div></div>
          <div><label class="lab" for="${fid('why')}">Why</label><input type="text" name="reason" id="${fid('why')}" maxlength="300" value="${esc(i.adjusted ? i.adjusted.reason : '')}"></div>
          ${errors['adj:' + i.id] ? `<p class="errmsg" role="alert">${esc(errors['adj:' + i.id])}</p>` : ''}
          <div class="row"><button class="btn" type="submit">Move it</button>${i.adjusted ? `<button class="btn quiet" type="button" data-unadjust="${esc(i.id)}">Back to the suggestion</button>` : ''}</div>
        </form></details>` : `<p style="margin:8px 0 0"><button class="btn quiet" type="button" data-remove="${esc(i.id)}" style="padding:2px 0">Remove this risk</button></p>`}
    </li>`;
  }

  /* ---------- the page ---------- */
  function render(focusSel){
    const today = U.today();
    const {items, stopped} = K.items(lines, P, store, {split: opts.split});
    const c = {act: 0, plan: 0, watch: 0};
    items.forEach(i => c[i.zone]++);
    const snap = store.snapshots[store.snapshots.length - 1];
    const mv = K.movement(snap, items);
    const sugg = K.suggestionsFor(P, store);
    const checked = lines.filter(l => !l.retired_on).length;

    main.innerHTML = `<section class="screen">
      ${!checked ? `<div class="callout" style="max-width:760px;margin-bottom:14px"><span class="k">Check a tool first</span><p>Positions come from your tool checks. <a href="tool_check.html">Check your first tool</a>, and it will appear here. You can add risks that apply to the whole business now.</p></div>` : ''}
      ${items.length ? `<p class="headline"><span>${zb('act')} ${c.act}</span><span>${zb('plan')} ${c.plan}</span><span>${zb('watch')} ${c.watch}</span>${stopped.length ? `<span class="small-note">${stopped.length} stopped or paused, below</span>` : ''}</p>
        ${mv ? `<p class="movement">Since your snapshot on ${esc(U.fmtDate(mv.since))}: ${esc(mv.summary)}.</p>` : ''}
        <div class="matrix-wrap">
          <div class="matrix">
            ${gridSVG(items)}
            <div class="toggles">
              <label><input type="checkbox" data-opt="before"${opts.before ? ' checked' : ''}> Show before and now</label>
              <label><input type="checkbox" data-opt="split"${opts.split ? ' checked' : ''}> Split by type of risk</label>
            </div>
            <p class="legend"><span>&#9679; now</span><span>&#9675; dashed: before the to-dos</span><span>&#9675; solid: paused</span></p>
            <details class="alt"><summary>The grid as a table</summary>${gridTable(items)}</details>
          </div>
          <div>
            <h2 class="subhead" style="margin-top:0">What to deal with first</h2>
            <ol class="first-list" style="margin:0;padding-left:20px;font-size:15px">${items.filter(i => i.zone !== 'watch').slice(0, 6).map(i => `<li style="margin-bottom:5px"><a href="#ri-${esc(i.id)}">${esc(i.label)}</a> ${zb(i.zone)}</li>`).join('') || '<li>Nothing in Act now or Plan.</li>'}</ol>
            <p class="small-note" style="margin-top:10px">Act now comes first, then Plan, then Watch. Within a zone, the earliest date comes first. There is no single score for the business, because one number would hide which risks matter.</p>
          </div>
        </div>` : ''}

      ${items.length ? `<h2 class="subhead">The register</h2><ol class="reg">${items.map(itemHTML).join('')}</ol>` : ''}

      ${stopped.length ? `<h2 class="subhead">Stopped until resolved</h2>
        <p class="example">These cross a red line in the tool check. A red line cannot be accepted as a risk. The fix is on your <a href="tool_check.html">AI list</a>.</p>
        <ul class="reg">${stopped.map(s => `<li class="ritem act"><div class="top"><span class="t">${esc(s.label)}</span><span class="badge">${s.paused ? 'Paused' : 'Not started'}</span></div>
          <ul class="why">${s.reasons.map(r => `<li>${esc(r)}</li>`).join('')}${s.fix.map(f => `<li>What would change it: ${esc(f)}</li>`).join('')}</ul></li>`).join('')}</ul>` : ''}

      <h2 class="subhead">Risks not tied to one tool</h2>
      <form class="addrisk" id="addrisk">
        <p class="example" style="margin:0">Some risks do not belong to any one tool, such as someone using AI against your business. These are the only positions you rate yourself.</p>
        ${sugg.length ? `<div class="suggest">${sugg.map(s => `<button class="chip" type="button" data-suggest="${s.id}">${esc(s.title)}</button>`).join('')}</div>` : ''}
        <div style="margin-top:8px"><label class="lab" for="ar-title" style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)">The risk</label><input type="text" id="ar-title" name="title" maxlength="200"></div>
        <div style="margin-top:8px"><label class="lab" for="ar-type" style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)">Kind</label>${sel('type', RK.types.map(t => t.id), 'used_against', K.typeLabel, ' id="ar-type"')}</div>
        <fieldset><legend>How serious would it be?</legend><div class="levels">${RK.levels.map(l => `<label><input type="radio" name="impact" value="${l}"><b>${L(l)}</b>${esc(RK.describe.impact[l])}</label>`).join('')}</div></fieldset>
        <fieldset><legend>How likely?</legend><div class="levels">${RK.levels.map(l => `<label><input type="radio" name="likelihood" value="${l}"><b>${L(l)}</b>${esc(RK.describe.likelihood[l])}</label>`).join('')}</div></fieldset>
        <div style="margin-top:10px"><label class="lab" for="ar-control" style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)">What you do about it (optional)</label><input type="text" id="ar-control" name="control" maxlength="300"></div>
        ${errors.add ? `<p class="errmsg" role="alert" style="margin-top:8px">${esc(errors.add)}</p>` : ''}
        <div style="margin-top:10px"><button class="btn primary" type="submit">Add this risk</button></div>
      </form>

      <h2 class="subhead">Snapshots</h2>
      <p class="example">Save a snapshot at each quarterly review. The next snapshot shows what moved, which is evidence that the work is being done and not only written down.</p>
      <div class="actions">
        <button class="btn" type="button" data-act="snapshot"${items.length ? '' : ' disabled'}>Save a snapshot</button>
        <button class="btn" type="button" data-act="csv"${items.length || stopped.length ? '' : ' disabled'}>Download the register (CSV)</button>
        <button class="btn" type="button" data-act="print"${items.length ? '' : ' disabled'}>Print the grid and register</button>
      </div>
      ${items.length ? '' : `<p class="why-off">These turn on once a tool is on <a href="tool_check.html">your AI list</a>, or once you add a risk above.</p>`}
      ${store.snapshots.length ? `<ul class="events">${store.snapshots.slice().reverse().map(s => `<li>${esc(U.fmtDate(s.date))}: ${s.items.filter(i => i.zone === 'act').length} Act now, ${s.items.filter(i => i.zone === 'plan').length} Plan, ${s.items.filter(i => i.zone === 'watch').length} Watch</li>`).join('')}</ul>` : ''}
      <p class="status" id="status" role="status"></p>
    </section>
    <section class="printrisk" id="printrisk" aria-hidden="true">
      <h2>AI risk overview, ${esc(U.fmtDate(today))}</h2>
      ${items.length ? gridSVG(items, 'pr') : ''}
      <table><thead><tr><th>#</th><th>Use or risk</th><th>Impact</th><th>Likelihood before</th><th>Now</th><th>Zone</th><th>Response</th><th>Owner</th><th>Due</th><th>Review by</th></tr></thead>
      <tbody>${items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.label)}${i.adjusted ? ' (moved by owner)' : ''}</td><td>${L(i.impact)}</td><td>${L(i.before)}</td><td>${L(i.now)}</td><td>${esc(RK.zone_labels[i.zone])}</td>
        <td>${i.response ? esc(RK.responses.find(x => x.id === i.response).label) : ''}</td><td>${esc(i.owner)}</td><td>${esc(i.due || '')}</td><td>${esc(i.review_by || '')}</td></tr>`).join('')}
      ${stopped.map(s => `<tr><td></td><td>${esc(s.label)}</td><td colspan="8">${s.paused ? 'Paused' : 'Stopped'}: ${esc(s.reasons.join(' '))}</td></tr>`).join('')}</tbody></table>
      <p style="font-size:11px">Positions suggested from tool-check answers (risk rules ${esc(RK.version)}). This shows what was recorded. It is not a record of what anyone else has checked.</p>
    </section>`;
    if (focusSel){ const el = $(focusSel, main); if (el) el.focus(); }
  }
  function say(msg){ const s = $('#status'); if (s) s.textContent = msg; }

  /* ---------- events ---------- */
  main.addEventListener('change', e => {
    const o = e.target.dataset.opt;
    if (o){ opts[o] = e.target.checked; render(`[data-opt="${o}"]`); }
  });
  main.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, fd = new FormData(f), today = U.today();
    const {items} = K.items(lines, P, store, {split: opts.split});
    if (f.dataset.resp){
      const id = f.dataset.resp, it = items.find(i => i.id === id);
      try {
        K.respond(store, it, {response: fd.get('response'), owner: fd.get('owner'), due: fd.get('due'), review_by: fd.get('review_by'), by: fd.get('by'), reason: fd.get('reason')});
        delete errors['resp:' + id]; save(); render(`#ri-${CSS.escape(id)} summary`); $('#announce').textContent = 'Response saved.';
      } catch (err) { errors['resp:' + id] = err.message; render(`[data-resp="${CSS.escape(id)}"] select`); }
      return;
    }
    if (f.dataset.adj){
      const id = f.dataset.adj;
      try {
        K.adjust(store, id, fd.get('impact'), fd.get('likelihood'), fd.get('reason'), today);
        delete errors['adj:' + id]; save(); render(`#ri-${CSS.escape(id)} summary`); $('#announce').textContent = 'Position moved, with your reason.';
      } catch (err) { errors['adj:' + id] = err.message; render(`[data-adj="${CSS.escape(id)}"] input[name=reason]`); }
      return;
    }
    if (f.id === 'addrisk'){
      try {
        K.addCustom(store, {title: fd.get('title'), type: fd.get('type'), impact: fd.get('impact'), likelihood: fd.get('likelihood'), control: fd.get('control')}, today);
        delete errors.add; save(); render(); $('#announce').textContent = 'Risk added to the matrix.';
      } catch (err) { errors.add = err.message; render('#ar-title'); }
    }
  });
  main.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.suggest){
      const s = RK.suggestions.find(x => x.id === b.dataset.suggest);
      $('#ar-title').value = s.title; $('#ar-type').value = s.type; $('#ar-control').value = s.control;
      $('input[name=impact]', main).focus();
      return;
    }
    if (b.dataset.unadjust){ K.clearAdjust(store, b.dataset.unadjust); save(); return render(); }
    if (b.dataset.remove){
      store.custom = store.custom.filter(c => c.id !== b.dataset.remove);
      delete store.response[b.dataset.remove];
      save(); return render();
    }
    const {items, stopped} = K.items(lines, P, store, {split: opts.split});
    switch (b.dataset.act){
      case 'snapshot':
        store.snapshots.push(K.snapshot(items, U.today()));
        store.snapshots = store.snapshots.slice(-20);
        save(); render();
        return say('Snapshot saved. Next time, this page shows what moved since today.');
      case 'csv':
        U.download(K.csv(items, stopped), `ai_risk_register_${U.today()}.csv`, 'text/csv');
        return say('Register downloaded. It opens in Excel, Numbers or Google Sheets.');
      case 'print': {
        const p = $('#printrisk');
        p.classList.add('print-target'); document.body.classList.add('printing');
        return window.print();
      }
    }
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    $$('.print-target').forEach(x => x.classList.remove('print-target'));
  });

  render();
})();
