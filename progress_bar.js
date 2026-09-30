/* The progress bar on every question flow (quick check, policy, check-in,
   profile, tool check): where you are in words, and as a bar. Counts are
   worked out afresh on every screen, so when an answer opens more questions
   the total grows and the bar steps back a little. Styles: .pbar in site.css. */
var progressBar = function(o){
  const pct = o.total ? Math.round((o.n - 1) / o.total * 100) : 0;
  const words = `Question ${o.n} of ${o.total}`;
  return `<div class="pbar">
    <p class="pbar-top"><span>${o.left}</span><span><b>${words}</b> &middot; ${pct}% done</span></p>
    <div class="pbar-track" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="${o.total}" aria-valuenow="${o.n - 1}" aria-valuetext="${words}, ${pct}% done"><i style="width:${pct}%"></i></div>
  </div>`;
};
