/* Business profile: pure functions, no DOM, so the profile page, the
   summary bar on every page, and the tests run the same code.
   Needs, loaded first: data/profile_options.js, data/profile_effects.js.

   A profile:
     {profile_version: 2, team_size, ai_use: [...], industry: [main, second?],
      finance_subtype, registration, it_support}
   The link form, for sharing and QR codes (after the #, so never sent to a
   server):  p=solo.use.finance-advice-state
             p=small.use+configure.professional+finance.provider */

var ProfileEngine = (function(){
  const O = PROFILE_OPTIONS, FX = PROFILE_EFFECTS;
  const PATHS = ['none', 'use', 'configure', 'build'];
  const ids = list => list.options.map(o => o.id);
  const finance = () => O.industry.options.find(o => o.id === 'finance');

  function blank(){
    return {profile_version: O.profile_version, team_size: null, ai_use: [], industry: [], finance_subtype: null, registration: null, it_support: null};
  }
  /* the highest of use, configure, build sets the path; "none" only alone */
  function path(p){
    const uses = (p.ai_use || []).filter(u => PATHS.includes(u));
    if (!uses.length) return null;
    return uses.reduce((a, b) => PATHS.indexOf(b) > PATHS.indexOf(a) ? b : a);
  }
  const complete = p => !!(p && p.team_size && p.ai_use.length && p.industry.length);

  /* keep only what's valid, whatever the source (storage, a link, a file) */
  function clean(raw){
    const p = blank();
    if (!raw || typeof raw !== 'object') return p;
    if (ids(O.team_size).includes(raw.team_size)) p.team_size = raw.team_size;
    const uses = (Array.isArray(raw.ai_use) ? raw.ai_use : []).filter((u, i, a) => ids(O.ai_use).includes(u) && a.indexOf(u) === i);
    p.ai_use = uses.includes('none') && uses.length > 1 ? uses.filter(u => u !== 'none') : uses;
    p.industry = (Array.isArray(raw.industry) ? raw.industry : []).filter((u, i, a) => ids(O.industry).includes(u) && a.indexOf(u) === i).slice(0, 2);
    if (p.industry.includes('finance')){
      if (finance().subtypes.some(s => s.id === raw.finance_subtype)) p.finance_subtype = raw.finance_subtype;
      if (p.finance_subtype === 'advice' && finance().registration.options.some(r => r.id === raw.registration)) p.registration = raw.registration;
    }
    if (ids(O.it_support).includes(raw.it_support)) p.it_support = raw.it_support;
    return p;
  }

  /* ---------- the link ---------- */
  function encode(p){
    if (!complete(p)) return '';
    const ind = p.industry.map(i => i !== 'finance' || !p.finance_subtype ? i
      : ['finance', p.finance_subtype].concat(p.finance_subtype === 'advice' && p.registration ? [p.registration] : []).join('-'));
    return 'p=' + [p.team_size, p.ai_use.join('+'), ind.join('+')].concat(p.it_support ? [p.it_support] : []).join('.');
  }
  function decode(str){
    const m = /(?:^|[#&])p=([a-z_.+-]+)/.exec(String(str || ''));
    if (!m) return null;
    const [team, uses, inds, it] = m[1].split('.');
    const raw = {team_size: team, ai_use: (uses || '').split('+'), industry: [], it_support: it};
    (inds || '').split('+').forEach(x => {
      const [id, sub, reg] = x.split('-');
      raw.industry.push(id);
      if (id === 'finance'){ raw.finance_subtype = sub; raw.registration = reg; }
    });
    const p = clean(raw);
    return complete(p) ? p : null;
  }

  /* ---------- what the profile says about the business ---------- */
  function summary(p){
    if (!complete(p)) return [];
    const team = O.team_size.options.find(o => o.id === p.team_size).summary;
    const ind = p.industry.map(i => {
      const s = O.industry_summary[i];
      const sub = i === 'finance' && p.finance_subtype && finance().subtypes.find(x => x.id === p.finance_subtype);
      return sub ? `${s} (${sub.id})` : s;
    }).join(' and ');
    return [team, O.path_summary[path(p)], ind];
  }
  /* did the quick check or the monthly check-ins find anything that acts? */
  function actsFromSaved(quick, pulse){
    let yes = false, known = false;
    if (quick && quick.screener && quick.screener.answers){
      const q3 = quick.screener.answers.q3;
      if (q3 === 'yes' || q3 === 'not_sure') yes = true;
      if (q3) known = true;
    }
    ((quick && quick.finds) || []).forEach(f => {
      const a = f.tags && f.tags.can_act;
      if (a && a !== 'no'){ yes = true; }
      if (a) known = true;
    });
    const conns = pulse && Array.isArray(pulse.checkins) ? pulse.checkins.some(c => (c.connections || []).length) : false;
    if (conns) yes = true;
    if (pulse && Array.isArray(pulse.checkins) && pulse.checkins.length) known = true;
    return yes ? 'yes' : known ? 'no' : 'unknown';
  }
  function facts(p, acts){
    return {
      team_size: p.team_size, path: path(p), ai_use: p.ai_use, industry: p.industry,
      it_support: p.it_support, acts: acts || 'unknown',
    };
  }

  /* ---------- effects ---------- */
  function matches(cond, f){
    if (!cond) return true;
    if (cond.all) return cond.all.every(c => matches(c, f));
    if (cond.any) return cond.any.some(c => matches(c, f));
    const v = f[cond.q];
    return Array.isArray(v) ? v.some(x => cond.in.includes(x)) : cond.in.includes(v);
  }
  function effectsFor(page, f){
    return FX.effects.filter(e => (e.page === page || e.page === '*') && matches(e.when, f));
  }
  /* grouped by page, then in step order, for the "what changes" list */
  function allEffects(f){
    const pages = Object.keys(FX.pages), targets = Object.keys(FX.targets);
    return FX.effects.filter(e => matches(e.when, f)).map((e, i) => [e, i]).sort(([a, i], [b, j]) =>
      (pages.indexOf(a.page) - pages.indexOf(b.page)) || (targets.indexOf(a.target) - targets.indexOf(b.target)) || (i - j)).map(([e]) => e);
  }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(s){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''; }
  /* one plain line per change, for the "what changes for you" list */
  function describe(e){
    const where = e.target ? `${FX.pages[e.page]}: ${FX.targets[e.target]}` : FX.pages[e.page];
    const what = {
      note: `a note for you${e.title ? `: ${e.title}` : ''}`,
      hide: `set aside, with a way to show it`,
      tag: e.text && e.text.toLowerCase(),
      banner: e.title && e.title.toLowerCase(),
      overlay: `notes for your industry`,
    }[e.kind];
    return {where, what, reason: e.reason || null, href: e.page === '*' ? null : e.page + (e.target && e.target[0] === '#' ? e.target : '')};
  }

  function overlays(p){
    return p.industry.filter(i => O.overlays[i]).map(i => {
      const o = O.overlays[i];
      const extra = [];
      if (i === 'finance' && p.finance_subtype && o.subtype_points) extra.push(o.subtype_points[p.finance_subtype]);
      if (i === 'finance' && p.registration && o.registration_points) extra.push(o.registration_points[p.registration]);
      return {industry: i, label: O.industry.options.find(x => x.id === i).label, summary: o.summary,
        points: o.points.concat(extra.filter(Boolean)), red_line: o.red_line, advice: o.advice, last_reviewed: o.last_reviewed};
    });
  }

  /* what the other tools can start from */
  function forTools(p){
    return {
      industry: p.industry[0] || null,
      policy_team: p.team_size === 'solo' ? 'solo' : p.team_size ? 'team' : null,
    };
  }

  return {fmtDate, blank, path, complete, clean, encode, decode, summary, actsFromSaved, facts, matches, effectsFor, allEffects, describe, overlays, forTools};
})();
