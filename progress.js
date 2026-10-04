/* Your progress: draws both tracks and the next thing to do, from what the
   tools saved (progress_engine.js). Reads only. */
(function(){
  const box = document.getElementById('progress');
  if (!box) return;
  const esc = UI.esc;
  let local = null, session = null;
  try { local = window.localStorage; session = window.sessionStorage; } catch (e) {}
  const S = ProgressEngine.status(ProgressEngine.readSaved(local, session));
  const G = PROGRESS;

  const color = {essentials: 'var(--part3)', full: 'var(--part2)', done: 'var(--part1)'}[S.track];
  const where = S.track === 'essentials' ? `Essentials &middot; <b>step ${S.essentials.indexOf(S.next) + 1} of ${S.essentials.length}</b>`
    : S.track === 'full' ? `The full playbook &middot; <b>${S.counts.full[0]} of ${S.counts.full[1]} done</b>` : 'All done';
  const next = `<div class="start primary next-up" style="--c:${color}">
      <span class="k">Next &middot; ${where}</span>
      <h2>${esc(S.next.label)}</h2>
      <p>${esc(S.next.note || '')}</p>
      <a class="start-btn" href="${esc(S.next.href)}">${esc(S.next.cta || 'Open it')}</a>
    </div>
    ${S.any ? '' : '<p class="none-yet">Nothing is saved in this browser yet. If you used the site in another browser, open your saved file on the <a href="record.html">record</a> page and your progress will show here.</p>'}`;

  const mark = x => x.done ? '&#10003;' : x === S.next ? '&rarr;' : x.started ? '&#9680;' : '&#9675;';
  const state = x => x.done ? 'done' : x === S.next ? 'next' : x.started ? 'started' : '';
  const row = (x, extra) => `<li class="${x.done ? 'done' : ''}${x === S.next ? ' is-next' : ''}">
      <span class="mark" aria-hidden="true">${mark(x)}</span>
      <span class="what"><a href="${esc(x.href)}">${esc(x.label)}</a>${state(x) ? `<span class="state">${state(x)}</span>` : ''}${x.time && !x.done ? `<span class="state">${esc(x.time)}</span>` : ''}</span>
      ${extra || (!x.done && x.note ? `<p class="note">${esc(x.note)}</p>` : '')}</li>`;

  const essentials = `<section class="track-box" style="--c:var(--part3)" aria-labelledby="h-ess">
      <h2 id="h-ess">${esc(G.essentials.title)}</h2>
      <p class="meta-line">${S.counts.essentials[0]} of ${S.counts.essentials[1]} done &middot; ${esc(G.essentials.time)}</p>
      <p class="intro">${esc(G.essentials.intro)}</p>
      <ol class="track">${S.essentials.map(x => row(x)).join('')}</ol>
    </section>`;

  const steps = S.full.filter(x => x.id.indexOf('step-') === 0), tools = S.full.filter(x => x.id.indexOf('step-') !== 0);
  const helps = x => `<p class="helps">${x.helps.map(h => `<a href="${esc(h.href)}">${esc(h.label)}</a>`).join(' &middot; ')}</p>`;
  const full = `<section class="track-box" style="--c:var(--part2)" aria-labelledby="h-full">
      <h2 id="h-full">${esc(G.full.title)}</h2>
      <p class="meta-line">${S.counts.full[0]} of ${S.counts.full[1]} done</p>
      <p class="intro">${esc(G.full.intro)}</p>
      <ol class="track">${steps.map(x => row(x, helps(x))).join('')}</ol>
      <p class="sub">Then</p>
      <ul class="track">${tools.map(x => row(x)).join('')}</ul>
    </section>`;

  box.innerHTML = next + `<div class="tracks">${essentials}${full}</div>`;
})();
