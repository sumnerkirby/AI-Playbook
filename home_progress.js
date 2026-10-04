/* Home page: once anything is saved, a card above the two ways through says
   what to do next (progress_engine.js). Reads only; shows nothing on a
   first visit. */
(function(){
  const box = document.getElementById('continue');
  if (!box) return;
  let local = null, session = null;
  try { local = window.localStorage; session = window.sessionStorage; } catch (e) { return; }
  const S = ProgressEngine.status(ProgressEngine.readSaved(local, session));
  if (!S.any) return;
  const esc = UI.esc;
  const color = {essentials: 'var(--part3)', full: 'var(--part2)', done: 'var(--part1)'}[S.track];
  const where = S.track === 'essentials' ? `The essentials, ${S.counts.essentials[0]} of ${S.counts.essentials[1]} done`
    : S.track === 'full' ? `The full playbook, ${S.counts.full[0]} of ${S.counts.full[1]} done` : 'Everything done';
  box.innerHTML = `<div class="start continue" style="--c:${color}">
      <span class="k">Welcome back &middot; ${where}</span>
      <h2>${esc(S.next.label)}</h2>
      <p>${esc(S.next.note || '')}</p>
      <a class="start-btn" href="${esc(S.next.href)}">${esc(S.next.cta || 'Open it')}</a>
      <p class="more"><a href="progress.html">See your progress</a></p>
    </div>`;
  box.hidden = false;
})();
