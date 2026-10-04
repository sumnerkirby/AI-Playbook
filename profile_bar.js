/* The business profile on every page: a summary bar under the site bar, and
   the changes the profile makes to this page (data/profile_effects.js).
   A thin layer over static pages, as STYLE_GUIDE.md section 8 asks. Every
   page works without it: with no script or no profile, readers see
   everything.
   Needs, loaded first: data/profile_options.js, data/profile_effects.js,
   profile_engine.js. ProfileBar.refresh() draws it again, for step 0 of the
   playbook and the quick check, which change the profile on the page. */
(function(){
  const PR = ProfileEngine;
  const KEY = 'sb-ai-playbook:profile';
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'profile.html') return;   // the profile page draws its own
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

  const site = $('.sitebar');
  if (!site) return;
  /* what this script added or set aside, so a redraw starts from the page as it was */
  let made = [], hid = [];
  const add = n => { made.push(n); return n; };

  function apply(){
    made.forEach(n => n.remove());
    hid.forEach(el => { el.hidden = false; });
    made = []; hid = [];
    const p = PR.clean(read(KEY));
    const bar = add(document.createElement('section'));
    bar.className = 'profilebar';
    bar.setAttribute('aria-label', 'Your business');
    if (!PR.complete(p)){
      /* the playbook and the quick check ask these questions as step 0, and the
         AI list has its own box asking for the profile, so a second prompt
         would compete */
      if (page === 'quick_check.html' || page === 'tool_check.html' || page === 'playbook.html') return;
      bar.innerHTML = `<span class="k">Tailor this site</span><span class="words">Answer three questions to see which parts of this site apply to your business.</span><a href="profile.html">Start (under a minute)</a>`;
      (document.querySelector('.toolrow') || site).after(bar);
      return;
    }
    /* on the playbook, the answers are step 0 of the same page */
    bar.innerHTML = `<span class="k">Your business</span><span class="words">${PR.summary(p).map(w => `<b>${esc(w)}</b>`).join('<i aria-hidden="true">&middot;</i>')}</span><a href="${page === 'playbook.html' ? '#step-0' : 'profile.html'}">Change</a>`;
    (document.querySelector('.toolrow') || site).after(bar);

    /* the AI list, not just the profile: what the quick check and check-ins found */
    const facts = PR.facts(p, PR.actsFromSaved(read('sb-ai-playbook:quick'), read('sb-ai-playbook:pulse')));
    const effects = PR.effectsFor(page, facts);
    let notes = 0;

    function noteHTML(label, title, body){
      return `<span class="k">${esc(label)}${title ? ` &middot; ${esc(title)}` : ''}</span>${body}`;
    }
    function bodyHTML(e){
      return `${e.text ? `<p>${esc(e.text)}</p>` : ''}${e.list ? `<ul>${e.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}` +
        `${e.links ? `<p>${e.links.map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' &middot; ')}</p>` : ''}`;
    }
    function overlayHTML(){
      return PR.overlays(p).map(o => `<p><b>${esc(o.label)}.</b> ${esc(o.summary)}</p><ul>${o.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` +
        `<p><b>Red line in the checks:</b> ${esc(o.red_line)}</p><p class="advice"><b>Get advice</b>${esc(o.advice)}</p>` +
        `<p class="small-note">Last reviewed ${esc(PR.fmtDate(o.last_reviewed))}. Not legal advice.</p>`).join('');
    }
    /* a note inside a playbook step goes at the top of the step, and the
       closed step shows that it has one */
    function place(el, node){
      const step = el.matches('.item') ? el : null;
      if (step){
        $('.menu', step).prepend(node);
        const meta = $('.meta', step);
        if (meta && !$('.fornote', meta)){
          const pill = add(document.createElement('span'));
          pill.className = 'fornote';
          pill.textContent = 'Note for you';
          meta.appendChild(pill);
        }
      } else el.after(node);
    }

    effects.forEach(e => {
      if (e.kind === 'banner'){
        const b = add(document.createElement('aside'));
        b.className = 'callout profile-note';
        b.innerHTML = noteHTML('For your business', e.title, bodyHTML(e));
        bar.after(b);
        notes++;
        return;
      }
      const el = e.target && document.querySelector(e.target);
      if (!el) return;
      if (e.kind === 'note' || e.kind === 'overlay'){
        const n = add(document.createElement('aside'));
        n.className = 'profile-note';
        n.innerHTML = e.kind === 'note' ? noteHTML('For your business', e.title, bodyHTML(e)) : noteHTML('Your industry', null, overlayHTML());
        place(el, n);
        notes++;
      } else if (e.kind === 'tag'){
        const t = add(document.createElement('span'));
        t.className = 'profile-tag';
        t.textContent = e.text;
        el.appendChild(t);
        notes++;
      } else if (e.kind === 'hide'){
        /* set aside, never removed: the reason and a way back stay in place */
        const stub = add(document.createElement('div'));
        stub.className = 'profile-stub';
        stub.innerHTML = `<span class="k">Set aside for your business</span><span>${esc(e.reason)}</span><button type="button" class="btn quiet">Show anyway</button>`;
        stub.querySelector('button').addEventListener('click', () => { el.hidden = false; stub.remove(); el.focus && el.focus(); });
        el.hidden = true;
        hid.push(el);
        el.before(stub);
        notes++;
      }
    });
    if (notes){
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = `${notes} change${notes > 1 ? 's' : ''} on this page`;
      bar.insertBefore(c, bar.lastElementChild);
    }
  }

  apply();
  window.ProfileBar = {refresh: apply};
})();
