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

  /* save as the owner types; a date is kept for when each answer last changed */
  let timer = null;
  document.addEventListener('input', e => {
    const t = e.target;
    if (!t.dataset || (!t.dataset.key && !t.dataset.evidence)) return;
    clearTimeout(timer);
    timer = setTimeout(() => commit(t), 350);
  });
  document.addEventListener('change', e => { if (e.target.dataset && (e.target.dataset.key || e.target.dataset.evidence)) commit(e.target); });

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
      : `This browser isn&rsquo;t saving, so these answers will be lost when you close the page.`;
  }
})();
