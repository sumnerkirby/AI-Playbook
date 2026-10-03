/* The privacy page: the table of keys, with what is saved now, and Delete
   everything. privacy_engine.js finds and removes the keys; this script
   draws and asks before deleting. */
(function(){
  const PE = PrivacyEngine, SK = STORAGE_KEYS, esc = UI.esc;
  const $ = s => document.querySelector(s);
  const area = a => { try { return window[PE.AREAS[a]]; } catch (e) { return null; } };
  const stores = () => ({local: area('local'), session: area('session')});
  const KEPT = {local: 'Until you delete it', session: 'Until you close the tab'};
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  $('#keys-version').textContent = SK.version;

  function drawTable(){
    const now = new Set(PE.found(stores()).map(f => f.area + ' ' + f.key));
    $('#keys tbody').innerHTML = SK.keys.map(k => {
      const saved = now.has(k.area + ' ' + SK.prefix + k.key);
      return `<tr><td data-label="What">${esc(k.what)}</td><td data-label="Tool">${esc(k.tool)}</td>
        <td data-label="Key"><code>${esc(SK.prefix + k.key)}</code></td><td data-label="Kept">${KEPT[k.area]}</td>
        <td data-label="Saved now" class="now">${saved ? 'Yes' : 'No'}</td></tr>`;
    }).join('');
  }

  const row = $('#delete-row'), status = $('#status');
  function drawButton(){
    const n = PE.found(stores()).length;
    row.innerHTML = n
      ? `<button class="btn danger" type="button" data-act="ask">Delete everything this site saved</button>`
      : `<p>Nothing from this site is saved in this browser.</p>`;
  }
  function drawConfirm(){
    const f = PE.found(stores());
    row.innerHTML = `<div><p><b>Delete ${plural(f.length, 'item', 'items')}?</b></p>
      <ul>${f.map(x => `<li>${esc(x.what)} (${esc(x.tool)})</li>`).join('')}</ul>
      <div class="row"><button class="btn danger" type="button" data-act="delete">Delete everything</button>
      <button class="btn quiet" type="button" data-act="cancel">Cancel</button></div></div>`;
    $('[data-act="delete"]').focus();
  }
  function deleteAll(){
    const gone = PE.deleteAll(stores());
    /* answers can be in this page's address too */
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
    drawTable();
    drawButton();
    status.innerHTML = gone.length
      ? `Deleted ${plural(gone.length, 'item', 'items')}: ${gone.map(g => esc(g.what)).join('; ')}.`
      : 'Nothing was deleted. This browser may be blocking storage.';
    status.focus();
  }

  row.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'ask'){ status.textContent = ''; return drawConfirm(); }
    if (b.dataset.act === 'cancel'){ drawButton(); return $('[data-act="ask"]').focus(); }
    if (b.dataset.act === 'delete') return deleteAll();
  });
  status.tabIndex = -1;
  drawTable();
  drawButton();
})();
