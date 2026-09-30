/* The business profile page: three questions (plus one optional), then
   what changes for you. profile_engine.js does the work; this draws it.
   The profile is saved in this browser. A link after the # (p=...) shows a
   profile without saving it, until the reader chooses to use it. */
(function(){
  const PR = ProfileEngine, O = PROFILE_OPTIONS;
  const KEY = 'sb-ai-playbook:profile';
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main'), root = $('#qc');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  $('#fx-version').textContent = PROFILE_EFFECTS.version;

  const EXAMPLES = [
    {label: `A financial adviser working alone`, p: 'p=solo.use.finance-advice-state'},
    {label: `A dental practice of eight, with an IT company`, p: 'p=small.use.healthcare.provider'},
    {label: `A building firm of 30 that sets up its own automations`, p: 'p=medium.use+configure.trades.provider'},
  ];

  /* ---------- state ---------- */
  let saved = PR.clean(read(KEY));
  let p, step, fromLink = false;
  function fromHash(){
    const l = PR.decode(location.hash);
    if (l && !same(l, saved)){ p = l; step = 'result'; fromLink = true; return true; }
    return false;
  }
  if (!fromHash()){
    if (PR.complete(saved)){ p = saved; step = 'result'; }
    else { p = PR.blank(); step = 'team'; }
  }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(p)); saved = PR.clean(p); return true; } catch (e) { return false; }
  };
  function steps(){
    const s = ['team', 'use', 'industry'];
    if (p.industry.includes('finance')) s.push('finance_sub');
    if (p.industry.includes('finance') && p.finance_subtype === 'advice') s.push('registration');
    return s.concat('it');
  }

  let firstRender = true;
  function goto(s, push = true){
    step = s;
    if (push) history.pushState({prof: {step, p}}, '');
    render();
  }
  window.addEventListener('popstate', e => {
    if (e.state && e.state.prof){ step = e.state.prof.step; p = PR.clean(e.state.prof.p); fromLink = false; render(); }
  });
  window.addEventListener('hashchange', () => { if (fromHash()) render(); });
  history.replaceState({prof: {step, p}}, '');

  function render(){
    root.classList.toggle('started', step !== 'team' || PR.complete(p));
    if (step === 'result') renderResult(); else renderStep();
    if (!firstRender){
      window.scrollTo(0, 0);
      const h = $('h2', main);
      if (h){ h.tabIndex = -1; h.focus({preventScroll: true}); }
    }
    firstRender = false;
  }

  /* ---------- questions ---------- */
  const answer = (key, o, pressed, detail) => `<button type="button" class="answer" data-${key}="${o.id}" aria-pressed="${pressed}">${esc(o.label)}${detail ? `<small>${esc(detail)}</small>` : ''}</button>`;
  function renderStep(){
    const list = steps(), n = list.indexOf(step);
    const fin = O.industry.options.find(o => o.id === 'finance');
    let h2 = '', why = '', body = '', next = '';
    if (step === 'team'){
      h2 = O.team_size.label; why = O.team_size.why;
      body = `<div class="answers">${O.team_size.options.map(o => answer('team', o, p.team_size === o.id)).join('')}</div>`;
    } else if (step === 'use'){
      h2 = O.ai_use.label; why = `Tick all that apply. ${O.ai_use.why}`;
      body = `<div class="answers multi">${O.ai_use.options.map(o => answer('use', o, p.ai_use.includes(o.id), o.examples)).join('')}</div>`;
      next = `<button class="btn primary" type="button" data-act="next"${p.ai_use.length ? '' : ' disabled'}>Next</button>`;
    } else if (step === 'industry'){
      h2 = O.industry.label; why = O.industry.why;
      body = `<div class="answers">${O.industry.options.map(o => answer('ind', o, p.industry[0] === o.id, o.examples)).join('')}</div>
        ${p.industry[0] ? `<fieldset class="chips" style="margin-top:22px"><legend>Also in another industry? <span class="small-note">Optional</span></legend>
          <p class="why">For example, an accountant who also runs payroll. Both sets of notes apply.</p>
          <div class="chiprow">${O.industry.options.filter(o => o.id !== p.industry[0] && o.id !== 'other').map(o =>
            `<button type="button" class="chip" data-ind2="${o.id}" aria-pressed="${p.industry[1] === o.id}">${esc(o.label)}</button>`).join('')}</div></fieldset>` : ''}`;
      next = `<button class="btn primary" type="button" data-act="next"${p.industry.length ? '' : ' disabled'}>Next</button>`;
    } else if (step === 'finance_sub'){
      h2 = `What kind of finance or insurance?`; why = `The rules differ for advice, insurance and lending.`;
      body = `<div class="answers">${fin.subtypes.map(o => answer('sub', o, p.finance_subtype === o.id)).join('')}</div>`;
    } else if (step === 'registration'){
      h2 = fin.registration.label; why = `It decides which privacy and record-keeping rules apply.`;
      body = `<div class="answers">${fin.registration.options.map(o => answer('reg', o, p.registration === o.id)).join('')}</div>`;
    } else if (step === 'it'){
      h2 = O.it_support.label; why = O.it_support.why;
      body = `<div class="answers">${O.it_support.options.map(o => answer('it', o, p.it_support === o.id)).join('')}</div>`;
      next = `<button class="btn quiet" type="button" data-act="finish">Skip this one</button>`;
    }
    main.innerHTML = `<section class="screen">
      ${progressBar({left: `<b>Your business</b>${step === 'it' ? ' &middot; optional' : ''}`, n: n + 1, total: list.length})}
      <h2>${esc(h2)}</h2>${why ? `<p class="example">${esc(why)}</p>` : ''}
      ${body}
      <div class="nav-row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:22px">
        ${n > 0 ? '<button class="btn quiet" type="button" data-act="back">&larr; Back</button>' : ''}${next}
      </div></section>`;
  }
  function advance(){
    const list = steps(), i = list.indexOf(step);
    if (i === list.length - 1) return finish();
    goto(list[i + 1]);
  }
  function finish(){
    const ok = save();
    fromLink = false;
    history.replaceState(history.state, '', '#' + PR.encode(p));
    goto('result');
    if (!ok) say('This browser is blocking storage, so the profile only lasts while this page is open.');
  }

  /* ---------- result ---------- */
  function say(msg){ const s = $('#status'); if (s) s.textContent = msg; }
  /* a section that starts closed, so the page opens short */
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const fold = (title, count, inner) => `<details class="fold"><summary>${esc(title)}${count ? ` <span>${esc(count)}</span>` : ''}</summary><div class="in">${inner}</div></details>`;
  function renderResult(){
    const f = PR.facts(p, PR.actsFromSaved(read('sb-ai-playbook:quick'), read('sb-ai-playbook:pulse')));
    const changes = PR.allEffects(f).map(PR.describe);
    const ov = PR.overlays(p);
    const link = location.href.split('#')[0] + '#' + PR.encode(p);
    main.innerHTML = `<section class="screen">
      ${fromLink ? `<div class="callout" style="--c:var(--part2)"><span class="k">From a link</span><p>This profile came from a link, and isn&rsquo;t saved. Use it to tailor the site in this browser?</p>
        <p><button class="btn primary" type="button" data-act="use-link">Use this profile</button> <button class="btn quiet" type="button" data-act="no-link">No thanks</button></p></div>`
        : '<p class="honest">Saved in this browser</p>'}
      <div class="head-row"><h2>Your business</h2><button class="linkish" type="button" data-act="change">Change answers</button></div>
      <div class="words-big">${PR.summary(p).map(w => `<b>${esc(w)}</b>`).join('')}</div>

      <h3 class="subhead">Start here</h3>
      <div class="cards">
        <a class="card" href="quick_check.html" style="--c:var(--part3)"><span class="k">5 minutes</span><span class="t">Quick AI check</span><span class="d">Red flags, and what you use AI for. Starts with your industry.</span></a>
        <a class="card" href="playbook.html" style="--c:var(--part1)"><span class="k">The playbook</span><span class="t">Nine steps, with notes for you</span><span class="d">Steps with a note for your business are marked.</span></a>
        <a class="card" href="tool_check.html" style="--c:var(--part2)"><span class="k">5 to 15 minutes a tool</span><span class="t">Your AI list</span><span class="d">Check each use of each tool, with the checks for your size and industry.</span></a>
        <a class="card" href="quick_policy.html" style="--c:var(--part2)"><span class="k">8 to 10 minutes</span><span class="t">${p.team_size === 'solo' ? 'Your AI rules and settings' : 'Your AI policy'}</span><span class="d">Built from your answers, in the form that fits your size.</span></a>
      </div>

      <h3 class="subhead">More about your profile</h3>
      ${fold('What changes for you', changes.length ? plural(changes.length, 'change') : '', `
        ${changes.length ? `<ul class="changes">${changes.map(c => `<li><span class="where">${esc(c.where)}</span><span class="what">${esc(c.what)}${c.reason ? `: ${esc(c.reason)}` : ''}</span>${c.href ? `<a href="${esc(c.href)}">See it</a>` : ''}</li>`).join('')}</ul>`
          : '<p>No changes: the site as it is fits a business like yours.</p>'}
        <p class="small-note" style="margin-top:8px">Everything else stays as it is, and nothing is removed: anything set aside has a Show anyway button.</p>`)}
      ${ov.map(o => fold(`${o.label}: notes to check with an advisor`, plural(o.points.length, 'point'), `<div class="finding overlay">
        <p>${esc(o.summary)}</p><ul>${o.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p><b>Red line in the checks:</b> ${esc(o.red_line)}</p>
        <p class="advice"><b>Get advice</b>${esc(o.advice)}</p>
        <p class="small-note">Last reviewed ${esc(PR.fmtDate(o.last_reviewed))}. Things to check with an advisor, not legal advice. Not yet verified for publication.</p></div>`)).join('')}
      ${fold('Share this profile, or see an example', '', `
        <div class="share"><code id="share-link">${esc(link)}</code><button class="btn" type="button" data-act="copy">Copy link</button></div>
        <p class="small-note" style="margin-top:8px">The link holds these answers, which describe your business, not you. It doesn&rsquo;t save anything for whoever opens it unless they choose to.</p>
        <h4 class="fold-sub">Examples</h4>
        <ul class="changes">${EXAMPLES.map(x => `<li><span class="what">${esc(x.label)}</span><a href="#${x.p}">See this profile</a></li>`).join('')}</ul>`)}

      ${PR.complete(saved) ? '<div class="actions" style="margin-top:14px"><button class="btn quiet" type="button" data-act="clear">Clear my profile</button></div>' : ''}
      <p class="status" id="status" role="status"></p>
    </section>`;
  }

  /* ---------- events ---------- */
  main.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.team){ p.team_size = d.team; return advance(); }
    if (d.use){
      const u = d.use;
      if (p.ai_use.includes(u)) p.ai_use = p.ai_use.filter(x => x !== u);
      else p.ai_use = u === 'none' ? ['none'] : p.ai_use.filter(x => x !== 'none').concat(u);
      history.replaceState({prof: {step, p}}, '');
      return renderStep();
    }
    if (d.ind){
      p.industry = [d.ind].concat(p.industry.slice(1).filter(x => x !== d.ind));
      if (!p.industry.includes('finance')){ p.finance_subtype = null; p.registration = null; }
      history.replaceState({prof: {step, p}}, '');
      renderStep();
      return $(`[data-ind="${d.ind}"]`, main).focus();
    }
    if (d.ind2){
      p.industry = p.industry[1] === d.ind2 ? [p.industry[0]] : [p.industry[0], d.ind2];
      if (!p.industry.includes('finance')){ p.finance_subtype = null; p.registration = null; }
      history.replaceState({prof: {step, p}}, '');
      renderStep();
      return $(`[data-ind2="${d.ind2}"]`, main).focus();
    }
    if (d.sub){ p.finance_subtype = d.sub; if (d.sub !== 'advice') p.registration = null; return advance(); }
    if (d.reg){ p.registration = d.reg; return advance(); }
    if (d.it){ p.it_support = d.it; return finish(); }
    switch (d.act){
      case 'next': return advance();
      case 'back': return history.back();
      case 'finish': p.it_support = null; return finish();
      case 'change': fromLink = false; return goto('team');
      case 'use-link': fromLink = false; save(); render(); return say('Saved. The site now shows what applies to this business.');
      case 'no-link':
        fromLink = false;
        p = PR.complete(saved) ? saved : PR.blank();
        history.replaceState({prof: {step: PR.complete(saved) ? 'result' : 'team', p}}, '', PR.complete(saved) ? '#' + PR.encode(saved) : location.pathname);
        step = PR.complete(saved) ? 'result' : 'team';
        return render();
      case 'clear':
        try { localStorage.removeItem(KEY); } catch (err) {}
        saved = PR.blank(); p = PR.blank();
        history.replaceState({prof: {step: 'team', p}}, '', location.pathname);
        step = 'team';
        render();
        return say('Profile cleared. The site shows everything again.');
      case 'copy':
        try { await navigator.clipboard.writeText($('#share-link').textContent); say('Link copied.'); }
        catch (err) { say('Copy the link above by hand; this browser blocked copying.'); }
        return;
    }
  });

  render();
})();
