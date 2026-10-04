/* Business profile: pure functions, no DOM, so the profile page, the
   summary bar on every page, and the tests run the same code.
   Needs, loaded first: data/profile_options.js, data/profile_effects.js.

   A profile:
     {profile_version: 3, team_size, ai_use: [...], industry: [main, second?], it_support}
   The link form, for sharing and QR codes (after the #, so never sent to a
   server):  p=solo.use.finance
             p=small.use+configure.professional+finance.provider
   Answers no longer offered (O.retired) are mapped to what replaces them, so
   older links and saved profiles still open. */

var ProfileEngine = (function(){
  const O = PROFILE_OPTIONS, FX = PROFILE_EFFECTS;
  const PATHS = ['none', 'use', 'configure'];
  const ids = list => list.options.map(o => o.id);
  const retire = (q, v) => (O.retired[q] && O.retired[q][v]) || v;

  function blank(){
    return {profile_version: O.profile_version, team_size: null, ai_use: [], industry: [], it_support: null};
  }
  /* the higher of use and configure sets the path; "none" only alone */
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
    const team = retire('team_size', raw.team_size);
    if (ids(O.team_size).includes(team)) p.team_size = team;
    const uses = (Array.isArray(raw.ai_use) ? raw.ai_use : []).map(u => retire('ai_use', u)).filter((u, i, a) => ids(O.ai_use).includes(u) && a.indexOf(u) === i);
    p.ai_use = uses.includes('none') && uses.length > 1 ? uses.filter(u => u !== 'none') : uses;
    p.industry = (Array.isArray(raw.industry) ? raw.industry : []).map(u => retire('industry', u)).filter((u, i, a) => ids(O.industry).includes(u) && a.indexOf(u) === i).slice(0, 2);
    if (ids(O.it_support).includes(raw.it_support)) p.it_support = raw.it_support;
    return p;
  }

  /* ---------- the link ---------- */
  function encode(p){
    if (!complete(p)) return '';
    return 'p=' + [p.team_size, p.ai_use.join('+'), p.industry.join('+')].concat(p.it_support ? [p.it_support] : []).join('.');
  }
  function decode(str){
    const m = /(?:^|[#&])p=([a-z_.+-]+)/.exec(String(str || ''));
    if (!m) return null;
    const [team, uses, inds, it] = m[1].split('.');
    const raw = {team_size: team, ai_use: (uses || '').split('+'), industry: [], it_support: it};
    /* older links carried finance-advice-state; only the industry is kept */
    (inds || '').split('+').forEach(x => raw.industry.push(x.split('-')[0]));
    const p = clean(raw);
    return complete(p) ? p : null;
  }

  /* ---------- what the profile says about the business ---------- */
  function summary(p){
    if (!complete(p)) return [];
    const team = O.team_size.options.find(o => o.id === p.team_size).summary;
    const ind = p.industry.map(i => O.industry_summary[i]).join(' and ');
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
      note: `a note for your business${e.title ? `: ${e.title}` : ''}`,
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
      return {industry: i, label: O.industry.options.find(x => x.id === i).label, summary: o.summary,
        points: o.points.slice(), red_line: o.red_line, advice: o.advice, last_reviewed: o.last_reviewed};
    });
  }

  /* ---------- step 0: the questions asked before the playbook and the quick check ----------
     The three profile questions. Who looks after IT stays on the profile
     page, where it is optional. Step 0 sits outside the nine steps and the
     quick check's two parts, so it changes neither count. */
  function zeroSteps(){
    return ['team', 'use', 'industry'];
  }
  function zeroQuestion(id){
    const withDetail = o => ({id: o.id, label: o.label, detail: o.examples || ''});
    return {
      team: {id, label: O.team_size.label, why: O.team_size.why, options: O.team_size.options.map(withDetail)},
      use: {id, multi: true, label: O.ai_use.label, why: `Select all that apply. ${O.ai_use.why}`, options: O.ai_use.options.map(withDetail)},
      industry: {id, label: O.industry.label, why: O.industry.why, options: O.industry.options.map(withDetail)},
    }[id] || null;
  }
  /* what is chosen now, always as a list (the first industry only: a
     second one is kept, and is changed on the profile page) */
  function zeroValue(p, id){
    return ({team: [p.team_size], use: p.ai_use, industry: p.industry.slice(0, 1)}[id] || []).filter(Boolean);
  }
  /* choosing an answer gives a new profile; on the multiple-choice question
     it adds or removes the answer, and "We do not use AI" stands alone */
  function zeroAnswer(p, id, v){
    const n = clean(p);
    if (id === 'team') n.team_size = v;
    else if (id === 'use') n.ai_use = n.ai_use.includes(v) ? n.ai_use.filter(x => x !== v) : v === 'none' ? ['none'] : n.ai_use.filter(x => x !== 'none').concat(v);
    else if (id === 'industry') n.industry = [v].concat(n.industry.slice(1).filter(x => x !== v));
    return clean(n);
  }
  const zeroComplete = p => zeroSteps(p).every(id => zeroValue(p, id).length > 0);

  /* what the other tools can start from */
  function forTools(p){
    return {
      industry: p.industry[0] || null,
      policy_team: p.team_size === 'solo' ? 'solo' : p.team_size ? 'team' : null,
    };
  }

  /* The Get advice banner for regulated industries (FIXES 1.4), on step 0
     of the playbook, the quick check result and the tool check result.
     One entry per industry in the list that has one, in the list's order. */
  function adviceBanners(industries){
    return (industries || []).filter((i, n, a) => O.overlays[i] && O.overlays[i].seek_advice && a.indexOf(i) === n).map(i => ({
      industry: i, label: O.industry.options.find(x => x.id === i).label, text: O.overlays[i].seek_advice, links: O.overlays[i].links || []}));
  }
  /* the same markup on every page; esc is the page's own escaping */
  function adviceHTML(industries, esc){
    const b = adviceBanners(industries);
    if (!b.length) return '';
    const link = l => `<a href="${esc(l.href)}" rel="noopener">${esc(l.title)}</a>`;
    const h = O.general_help;
    return `<div class="advice-banner" role="note">${b.map(x => `<p class="advice"><b>Get advice</b>${b.length > 1 ? `<span class="ind">${esc(x.label)}.</span> ` : ''}${esc(x.text)}</p>
      <ul class="advice-links">${x.links.map(l => `<li>${link(l)}</li>`).join('')}</ul>`).join('')}
      <p class="advice-help">${esc(h.text)} ${h.links.map(link).join(' &middot; ')}</p></div>`;
  }

  return {adviceBanners, adviceHTML, fmtDate, blank, path, complete, clean, encode, decode, summary, actsFromSaved, facts, matches, effectsFor, allEffects, describe, overlays, forTools,
    zeroSteps, zeroQuestion, zeroValue, zeroAnswer, zeroComplete};
})();
