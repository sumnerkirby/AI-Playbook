/* Small helpers shared by the interactive pages: escaping, the traffic
   light (shape and word, never colour alone), storage that may be blocked,
   and downloads made in the browser. The quick check, policy and pulse
   pages still carry their own copies; they can move to this file later. */

var UI = (function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const ICON = {
    green: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="M5.6 10.4l2.9 2.9 5.9-6.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    amber: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.2l9.2 17H.8z" fill="currentColor"/><path d="M10 7.2v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="15.1" r="1.3" fill="#fff"/></svg>',
    red: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.3 1h7.4L19 6.3v7.4L13.7 19H6.3L1 13.7V6.3z" fill="currentColor"/><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };
  /* the quick check's go / check / stop use the same shapes */
  const CLS = {green: 'go', amber: 'check', red: 'stop', go: 'go', check: 'check', stop: 'stop'};
  const KEYS = {go: 'green', check: 'amber', stop: 'red', green: 'green', amber: 'amber', red: 'red'};
  function light(l, text){
    if (!l) return `<span class="light none">${esc(text || 'To check')}</span>`;
    return `<span class="light ${CLS[l]}">${ICON[KEYS[l]]}${esc(text)}</span>`;
  }
  const store = {
    get(k, area){ try { return JSON.parse(window[area || 'localStorage'].getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v, area){ try { window[area || 'localStorage'].setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k, area){ try { window[area || 'localStorage'].removeItem(k); } catch (e) {} },
  };
  function download(text, name, type){
    const url = URL.createObjectURL(new Blob([text], {type}));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const today = () => new Date().toLocaleDateString('en-CA');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(s){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''; }
  return {esc, light, store, download, today, fmtDate};
})();
