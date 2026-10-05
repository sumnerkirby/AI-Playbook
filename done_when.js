/* The playbook's "You're done when you can answer" questions get a short
   answer field each, kept in this browser only, for the AI use and risk
   record. Draws and saves; answers_engine.js does the rest.
   Data: data/done_when.js. Loaded on playbook.html after site.js. */

(function(){
  const A = AnswersEngine, D = DONE_WHEN, esc = UI.esc;
  const KEY = 'sb-ai-playbook:answers';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  let store = A.clean(UI.store.get(KEY));
  let saves = true;

  function save(){ saves = UI.store.set(KEY, store); }
  const slug = k => 'dw-' + k.replace(/\./g, '-');

  function field(key, kind, labelledby, label){
    const v = store.answers[key] ? store.answers[key].value : '';
    const lab = label ? `<span class="dw-part">${esc(label)}</span>` : '';
    if (kind === 'date')
      return `<label class="dw-date">${lab}<input type="date" data-key="${key}" value="${esc(v)}" ${label ? '' : `aria-labelledby="${labelledby}"`}></label>`;
    return `<textarea class="dw-text" rows="2" data-key="${key}" aria-labelledby="${labelledby}" maxlength="${D.max_length}">${esc(v)}</textarea>`;
  }

  function count(n){
    const c = A.control(store, n, [], UI.today());
    return `${c.answered} of ${c.total} answered`;
  }

  D.steps.forEach(s => {
    const art = $(`.item[data-step="${s.step}"]`);
    const sec = art && $('.sec-document .content', art);
    const items = sec ? $$('li', sec) : [];
    if (items.length !== s.questions.length) return;   // page and data disagree: leave the page as it was

    s.questions.forEach((q, i) => {
      const li = items[i], id = slug(q.id);
      li.innerHTML = `<span class="dw-q" id="${id}">${li.innerHTML}</span>` + (q.parts
        ? `<span class="dw-parts">${q.parts.map(p => field(q.id + '.' + p.id, p.kind, id, p.label)).join('')}</span>`
        : field(q.id, q.kind || 'text', id));
      if (q.placeholder) $('textarea', li).placeholder = q.placeholder;
    });

    const ev = store.evidence[s.step] ? store.evidence[s.step].value : '';
    const foot = document.createElement('div');
    foot.className = 'dw-foot';
    foot.innerHTML =
      (s.from ? `<p class="dw-from">${esc(s.from.text)} <a href="${s.from.href}">Open it</a></p>` : '') +
      `<label class="dw-evidence"><span>${esc(D.evidence.label)}</span>
         <textarea class="dw-text" rows="2" data-evidence="${s.step}" placeholder="${esc(D.evidence.placeholder)}" maxlength="${D.max_length}">${esc(ev)}</textarea></label>
       <p class="dw-note" aria-live="polite">Kept in this browser only. Your answers go into your <a href="record.html">AI use and risk record</a>.</p>`;
    sec.appendChild(foot);

    const meta = $('.meta', art);
    if (meta){
      const c = document.createElement('span');
      c.className = 'dw-count';
      c.dataset.step = s.step;
      c.textContent = count(s.step);
      meta.appendChild(c);
    }
  });

  /* Mark step done turns on once every question in the step is answered,
     the same rule the record and Your progress use (Sumner, Oct 5, 2026).
     Read from the fields on the page, so it changes as the owner types. */
  function gate(art){
    const m = $('.mark', art), foot = $('.stepfoot', art);
    if (!m || !foot) return;
    const qs = $$('.sec-document .content li', art).filter(li => $('[data-key]', li));
    const open = qs.filter(li => !$$('[data-key]', li).every(f => f.value.trim())).length;
    const on = m.getAttribute('aria-pressed') === 'true';
    let hint = $('.dw-gate', foot);
    if (!hint){
      hint = document.createElement('p');
      hint.className = 'dw-gate';
      hint.id = 'dw-gate-' + art.dataset.step;
      foot.appendChild(hint);
    }
    const q = n => n === 1 ? '1 question' : n + ' questions';
    hint.textContent = !open ? ''
      : on ? `Marked done, with ${q(open)} still to answer. The step counts on Your progress and in the record once every question is answered.`
      : `Answer ${open === qs.length ? 'the questions above' : open === 1 ? 'the remaining question above' : `the ${open} remaining questions above`} to mark this step done.`;
    hint.hidden = !open;
    m.disabled = !on && open > 0;
    if (open) m.setAttribute('aria-describedby', hint.id); else m.removeAttribute('aria-describedby');
  }
  const gateAll = () => $$('.item[data-step]').forEach(gate);
  gateAll();
  /* after site.js has marked or unmarked a step, or cleared them all */
  document.addEventListener('click', e => { if (e.target.closest('.mark, #reset')) setTimeout(gateAll, 0); });

  /* save as the owner types; a date is kept for when each answer last changed */
  let timer = null;
  document.addEventListener('input', e => {
    const t = e.target;
    if (!t.dataset || (!t.dataset.key && !t.dataset.evidence)) return;
    if (t.dataset.key) gate(t.closest('.item[data-step]'));
    clearTimeout(timer);
    timer = setTimeout(() => commit(t), 350);
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || (!t.dataset.key && !t.dataset.evidence)) return;
    if (t.dataset.key) gate(t.closest('.item[data-step]'));
    commit(t);
  });

  function commit(t){
    const today = UI.today();
    if (t.dataset.key) A.set(store, t.dataset.key, t.value, today);
    else A.setEvidence(store, t.dataset.evidence, t.value, today);
    save();
    const step = t.dataset.evidence || A.fields()[t.dataset.key].step;
    const c = $(`.dw-count[data-step="${step}"]`);
    if (c) c.textContent = count(step);
    const note = $(`.item[data-step="${step}"] .dw-note`);
    if (note) note.innerHTML = saves
      ? `Saved in this browser only. Your answers go into your <a href="record.html">AI use and risk record</a>.`
      : `This browser is not saving, so these answers will be lost when you close the page.`;
  }
})();
