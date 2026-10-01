/* The progress bar on every question flow (quick check, policy, check-in,
   profile, tool check): where you are in words, and as a bar. Styles: .pbar
   in site.css.
   Flows with a fixed number of questions pass n and total, and show
   Question n of total. Flows where an answer can open more questions
   (quick check part 2, tool check) pass frac instead (0 to 1, worked out from
   tasks or sections, whose number does not change), so the total never grows
   and the bar never steps back; their left label says which task or section. */
var progressBar = function(o){
  const byFrac = typeof o.frac === 'number';
  const pct = byFrac ? Math.min(100, Math.max(0, Math.round(o.frac * 100)))
    : o.total ? Math.round((o.n - 1) / o.total * 100) : 0;
  const words = byFrac ? '' : `Question ${o.n} of ${o.total}`;
  const aria = byFrac
    ? `aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct}% done"`
    : `aria-valuemin="0" aria-valuemax="${o.total}" aria-valuenow="${o.n - 1}" aria-valuetext="${words}, ${pct}% done"`;
  return `<div class="pbar">
    <p class="pbar-top"><span>${o.left}</span><span>${words ? `<b>${words}</b> &middot; ` : ''}${pct}% done</span></p>
    <div class="pbar-track" role="progressbar" aria-label="Progress" ${aria}><i style="width:${pct}%"></i></div>
  </div>`;
};
