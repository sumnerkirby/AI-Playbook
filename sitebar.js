/* The row of tools under the site bar scrolls sideways on a phone; start it
   with the current page's tool in view. */
(function(){
  const row = document.currentScript && document.currentScript.previousElementSibling;
  const cur = row && row.classList.contains('toolrow') && row.querySelector('[aria-current]');
  if (cur && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, cur.offsetLeft - row.offsetLeft - 24);
})();
