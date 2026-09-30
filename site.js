/* Shared behaviour for the site's own pages. Every page works without it:
   the markup ships fully open, and this script collapses it, wires the
   toggles, and remembers which playbook steps the reader has marked done. */
(function(){
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- copy buttons on templates (guides) ---------- */
  $$('[data-copy]').forEach(btn => {
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      const src = document.getElementById(btn.dataset.copy);
      try {
        await navigator.clipboard.writeText(src.innerText.trim());
        btn.textContent = 'Copied';
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(src);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        btn.textContent = 'Selected: press copy';
      }
      setTimeout(() => { btn.textContent = btn.dataset.label || 'Copy'; }, 2200);
    });
  });

  /* ---------- print buttons: print one template on its own ---------- */
  $$('[data-print]').forEach(btn => {
    btn.hidden = false;
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.print).closest('.template').classList.add('print-target');
      document.body.classList.add('print-one');
      window.print();
    });
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-one');
    $$('.print-target').forEach(t => t.classList.remove('print-target'));
  });

  /* ---------- citations: send the quoted passage along, so the library page
     can open the record at that passage and highlight it, and say where the
     reader came from, so it can offer the way back ---------- */
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('figure.quote').forEach(fig => {
    const a = $('figcaption a[href*="#"]', fig), q = $('blockquote', fig);
    if (!a || !q) return;
    const [file, hash] = a.getAttribute('href').split('#');
    const step = fig.closest('.item[data-step]');
    const spot = step || fig.closest('section[id]');
    const from = spot ? `${here}#${spot.id}` : here;
    const label = step ? `step ${step.dataset.step}` : document.title;
    const p = new URLSearchParams({q: q.textContent.replace(/\s+/g, ' ').trim(), from, label});
    a.href = `${file}?${p}#${hash}`;
  });

  /* ---------- Word downloads: docx.js builds the file from the template on
     the page, and is only fetched the first time someone asks for one ---------- */
  let docxLib;
  const loadDocx = () => docxLib || (docxLib = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'docx.js';
    s.onload = ok;
    s.onerror = () => { docxLib = null; fail(); };
    document.head.appendChild(s);
  }));
  $$('[data-docx]').forEach(btn => {
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      const src = document.getElementById(btn.dataset.docx);
      const name = $('.template-head span', src.closest('.template')).textContent.split('·')[0].trim();
      try {
        await loadDocx();
        const url = URL.createObjectURL(window.templateDocx(src, name));
        const a = document.createElement('a');
        a.href = url;
        a.download = name + '.docx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (e) {
        btn.textContent = 'Download failed';
        setTimeout(() => { btn.textContent = btn.dataset.label || 'Word'; }, 2200);
      }
    });
  });

  /* ---------- tables: label each cell so rows can stack on a phone ---------- */
  $$('table.grid:not(.keep)').forEach(t => {
    const heads = $$('thead th', t).map(th => th.textContent.trim());
    $$('tbody tr', t).forEach(tr => [...tr.cells].forEach((td, i) => { td.dataset.label = heads[i] || ''; }));
    t.classList.add('stacked');
  });

  /* ---------- the playbook ---------- */
  const steps = $$('.item[data-step]');
  if (!steps.length) return;

  const KEY = 'sb-ai-playbook:done';
  const store = {
    get(){ try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } },
    set(s){ try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) {} },
  };
  let done = store.get();

  function setSec(sec, open){
    sec.classList.toggle('open', open);
    $('.menu-btn', sec).setAttribute('aria-expanded', open);
    $('.content', sec).hidden = !open;
  }
  function setStep(el, open){
    el.classList.toggle('open', open);
    $('.item-btn', el).setAttribute('aria-expanded', open);
    $('.panel', el).hidden = !open;
    syncToggle();
  }

  steps.forEach(el => {
    $('.item-btn', el).addEventListener('click', () => setStep(el, !el.classList.contains('open')));
    $$('.sec', el).forEach(sec => {
      setSec(sec, sec.dataset.open === 'true');
      $('.menu-btn', sec).addEventListener('click', () => setSec(sec, !sec.classList.contains('open')));
    });
    $('.mark', el).addEventListener('click', () => {
      const n = el.dataset.step;
      done.has(n) ? done.delete(n) : done.add(n);
      store.set(done);
      syncDone();
    });
    setStep(el, false);

    /* how many source passages the step quotes, visible while it's closed */
    const n = $$('figure.quote', el).length;
    if (n){
      const c = document.createElement('span');
      c.className = 'srcs';
      c.textContent = `${n} passage${n > 1 ? 's' : ''} quoted`;
      $('.meta', el).appendChild(c);
    }
  });

  /* atlas: one cell per step, grouped by part, lit when done */
  const atlas = $('#atlas');
  $$('.fn-head[data-part]').forEach(head => {
    const part = steps.filter(s => s.dataset.part === head.dataset.part);
    const g = document.createElement('div');
    g.className = 'atlas-group';
    g.innerHTML = `<p class="atlas-label"><b>${head.dataset.label}</b>steps ${part[0].dataset.step}&ndash;${part[part.length - 1].dataset.step}</p>`;
    const cells = document.createElement('div');
    cells.className = 'atlas-cells';
    part.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell';
      b.innerHTML = `<b>${s.dataset.step}</b><span></span>`;
      $('span', b).textContent = $('.title', s).firstChild.textContent.trim();
      b.style.setProperty('--c', getComputedStyle(s).getPropertyValue('--c'));
      b.dataset.step = s.dataset.step;
      b.addEventListener('click', () => openStep(s, true));
      cells.appendChild(b);
    });
    g.appendChild(cells);
    atlas.insertBefore(g, $('.atlas-note', atlas));
  });

  function syncDone(){
    steps.forEach(el => {
      const n = el.dataset.step, on = done.has(n);
      const name = $('.title', el).firstChild.textContent.trim();
      $('.donepill', el).hidden = !on;
      const m = $('.mark', el);
      m.setAttribute('aria-pressed', on);
      m.textContent = on ? `Step ${n} done ✓` : `Mark step ${n} done`;
      const cell = $(`.cell[data-step="${n}"]`, atlas);
      cell.classList.toggle('on', on);
      cell.setAttribute('aria-label', `Step ${n}: ${name}${on ? ', done' : ''}`);
    });
    $('#tally').textContent = `${done.size} of ${steps.length} steps done`;
    const bar = $('#tally-bar');
    if (bar){
      bar.setAttribute('aria-valuemax', steps.length);
      bar.setAttribute('aria-valuenow', done.size);
      $('i', bar).style.width = Math.round(done.size / steps.length * 100) + '%';
    }
    $('#reset').hidden = !done.size;
  }
  $('#reset').addEventListener('click', () => { done = new Set(); store.set(done); syncDone(); });

  function syncToggle(){
    $('#toggle').textContent = steps.every(s => s.classList.contains('open')) ? 'Collapse all' : 'Expand all';
  }
  $('#toggle').addEventListener('click', () => {
    const open = !steps.every(s => s.classList.contains('open'));
    steps.forEach(s => {
      $$('.sec', s).forEach(sec => setSec(sec, open || sec.dataset.open === 'true'));
      setStep(s, open);
    });
  });

  function openStep(el, focus){
    setStep(el, true);
    el.style.scrollMarginTop = ($('.controls').offsetHeight + 24) + 'px';
    el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
    if (focus) $('.item-btn', el).focus({preventScroll: true});
  }
  function openFromHash(){
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (el && el.matches('.item[data-step]')) openStep(el, true);
  }

  /* a link to a step opens it even when the hash already names it */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#step-"]');
    const el = a && document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    history.pushState(null, '', a.getAttribute('href'));
    openStep(el, true);
  });

  /* coming back from a source page: reopen what was open, so the browser's
     own scroll restoration lands where the reader left off */
  const VIEW = 'sb-ai-playbook:view';
  window.addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem(VIEW, JSON.stringify(steps.filter(s => s.classList.contains('open'))
        .map(s => [s.id, $$('.sec', s).map(sec => sec.classList.contains('open'))])));
    } catch (e) {}
  });
  function restoreView(){
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!nav || nav.type !== 'back_forward') return false;
    try {
      JSON.parse(sessionStorage.getItem(VIEW) || '[]').forEach(([id, secs]) => {
        const el = document.getElementById(id);
        if (!el || !el.matches('.item[data-step]')) return;
        $$('.sec', el).forEach((sec, i) => setSec(sec, !!secs[i]));
        setStep(el, true);
      });
      return true;
    } catch (e) { return false; }
  }

  syncDone();
  syncToggle();
  if (!restoreView()) openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();
