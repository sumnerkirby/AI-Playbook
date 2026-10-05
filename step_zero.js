/* Step 0 of the playbook: the business profile questions, answered on the
   page before step 1. The answers are the same profile the rest of the site
   reads (profile_engine.js), kept in this browser; ProfileBar.refresh()
   redraws the notes they add to the steps. Step 0 has no data-step, so
   site.js leaves it out of the count, the atlas and Mark done.
   Loaded on playbook.html after profile_bar.js and ui_common.js. */

(function(){
  const PR = ProfileEngine, esc = UI.esc;
  const KEY = 'sb-ai-playbook:profile';
  const $ = (s, r) => (r || document).querySelector(s);
  const el = $('#step-0'), box = $('#zero'), adv = $('#zero-advice');
  if (!el || !box) return;
  const ASK = $('.title small', el).textContent;
  let p = PR.clean(UI.store.get(KEY));
  let saves = true;

  function setOpen(open){
    el.classList.toggle('open', open);
    $('.item-btn', el).setAttribute('aria-expanded', open);
    $('.panel', el).hidden = !open;
  }
  /* closed, the step shows the answers in place of the question */
  function head(){
    const done = PR.zeroComplete(p);
    $('.donepill', el).hidden = !done;
    $('.title small', el).textContent = done ? PR.summary(p).join(' · ') : ASK;
    /* regulated industries get the Get advice banner under the summary, open or closed */
    if (adv) adv.innerHTML = PR.adviceHTML(p.industry, esc);
  }
  function draw(focusSel){
    const done = PR.zeroComplete(p);
    box.innerHTML = `<p class="zero-intro">Answer these before step 1. The quick check and the AI policy start from the same answers, so they are asked only once.</p>` +
      PR.zeroSteps(p).map(id => {
        const q = PR.zeroQuestion(id), chosen = PR.zeroValue(p, id);
        return `<fieldset class="zero-q"><legend>${esc(q.label)}</legend><p class="why">${esc(q.why)}</p>
          <div class="zero-opts${q.multi ? ' multi' : ''}">${q.options.map(o =>
            `<button type="button" class="zero-opt" data-q="${id}" data-v="${o.id}" aria-pressed="${chosen.includes(o.id)}">${esc(o.label)}${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}</div></fieldset>`;
      }).join('') +
      `<p class="zero-note" role="status">${!saves ? 'This browser is not saving, so these answers will be lost when you close the page.'
        : done ? `Saved in this browser. The steps below now include the notes for your business. <a href="#step-1">Go to step 1</a> &middot; <a href="profile.html">See every change these answers make</a>`
        : 'Kept in this browser only.'}</p>`;
    head();
    if (focusSel){ const b = $(focusSel, box); if (b) b.focus(); }
  }

  box.addEventListener('click', e => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    p = PR.zeroAnswer(p, b.dataset.q, b.dataset.v);
    saves = UI.store.set(KEY, p);
    draw(`[data-q="${b.dataset.q}"][data-v="${b.dataset.v}"]`);
    if (window.ProfileBar) ProfileBar.refresh();
  });
  $('.item-btn', el).addEventListener('click', () => setOpen(!el.classList.contains('open')));
  /* the profile page, or another tab, changed the answers */
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    p = PR.clean(UI.store.get(KEY));
    draw();
    if (window.ProfileBar) ProfileBar.refresh();
  });
  window.addEventListener('hashchange', () => { if (location.hash === '#step-0') setOpen(true); });

  draw();
  setOpen(!PR.zeroComplete(p) || location.hash === '#step-0');
})();
