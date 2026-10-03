/* What this site has saved in this browser, and Delete everything.
   Works on any two Storage-like objects (getItem, removeItem, length, key),
   so the tests can pass in their own. Storage that is blocked counts as
   empty. */
var PrivacyEngine = (function(){
  const SK = STORAGE_KEYS;
  const AREAS = {local: 'localStorage', session: 'sessionStorage'};

  function keysIn(store){
    const out = [];
    try { for (let i = 0; i < store.length; i++){ const k = store.key(i); if (k && k.startsWith(SK.prefix)) out.push(k); } }
    catch (e) {}
    return out;
  }
  function describe(full, area){
    const short = full.slice(SK.prefix.length);
    const d = SK.keys.find(k => k.key === short && k.area === area);
    return {key: full, area, tool: d ? d.tool : 'This site', what: d ? d.what : 'Something saved by an older version of this site'};
  }
  /* stores: {local, session}; each entry says what it is, in the words of
     the privacy page, in the page's order (anything unlisted last) */
  const rank = g => { const i = SK.keys.findIndex(k => SK.prefix + k.key === g.key && k.area === g.area); return i < 0 ? SK.keys.length : i; };
  function found(stores){
    return ['local', 'session'].flatMap(a => stores[a] ? keysIn(stores[a]).sort().map(k => describe(k, a)) : [])
      .sort((x, y) => rank(x) - rank(y));
  }
  /* removes every key with the site's prefix, listed or not, and returns what went */
  function deleteAll(stores){
    const gone = found(stores);
    gone.forEach(g => { try { stores[g.area].removeItem(g.key); } catch (e) {} });
    return gone.filter(g => { try { return stores[g.area].getItem(g.key) === null; } catch (e) { return true; } });
  }
  return {found, deleteAll, AREAS};
})();
