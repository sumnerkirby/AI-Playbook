/* The playbook used to be this page. Links to a step, the guides or the
   library (index.html#step-6) go on to the same place on playbook.html. */
(function(){
  function forward(){
    var h = location.hash;
    if (/^#(step-\d+|steps|atlas|guides|policies|framework|library)$/.test(h)) location.replace('playbook.html' + h);
  }
  forward();
  window.addEventListener('hashchange', forward);
})();
