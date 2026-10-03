/* The row of tools under the site bar scrolls sideways on a phone; start it
   with the current page's tool in view, and fade its right edge while there
   is more to scroll to. */
(function(){
  const row = document.currentScript && document.currentScript.previousElementSibling;
  if (!row || !row.classList.contains('toolrow')) return;
  const cur = row.querySelector('[aria-current]');
  if (cur && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, cur.offsetLeft - row.offsetLeft - 24);
  const more = () => row.classList.toggle('more', row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
  more();
  row.addEventListener('scroll', more, {passive: true});
  window.addEventListener('resize', more);
})();
