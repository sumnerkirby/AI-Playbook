/* Progress: what is done, from what the tools already saved. Pure functions,
   no DOM, so the progress page, the home page card and the tests run the
   same code. Reads only; saves nothing.
   Needs, loaded first: data/profile_options.js, data/profile_effects.js,
   profile_engine.js, data/progress.js.

   The saved data, one value per storage key (null if not saved):
     {profile, quick, policy, policy_draft, ai_list, pulse, pulse_calendar, done, risk, record} */

var ProgressEngine = (function(){
  const G = PROGRESS;
  const arr = x => Array.isArray(x) ? x : [];

  /* the facts each stage is judged on */
  function facts(s){
    s = s || {};
    const lines = arr(s.ai_list && s.ai_list.lines).filter(l => l && !l.retired_on);
    return {
      profile: ProfileEngine.complete(ProfileEngine.clean(s.profile)),
      quick: !!(s.quick && (s.quick.screener || s.quick.hash)),
      quick_found: arr(s.quick && s.quick.finds).length,
      policy: !!(s.policy && s.policy.a),
      policy_started: !!s.policy_draft,
      lines: lines.length,
      checkins: arr(s.pulse && s.pulse.checkins).length,
      calendar: !!s.pulse_calendar,
      steps: new Set(arr(s.done).map(String)),
      snapshots: arr(s.risk && s.risk.snapshots).length,
      copies: arr(s.record && s.record.generations).length,
    };
  }

  /* done, and a short note when something is under way */
  function essentials(f){
    const judge = {
      business: () => ({done: f.profile}),
      quick: () => ({done: f.quick}),
      policy: () => ({done: f.policy, started: f.policy_started}),
      tool: () => ({done: f.lines > 0, found: f.quick_found > 0}),
      reminder: () => ({done: f.calendar || f.checkins > 0}),
    };
    return G.essentials.stages.map(st => {
      const j = judge[st.id]();
      return Object.assign({}, st, {done: j.done, started: !!j.started,
        note: j.done ? null : (j.found && st.todo_found) || st.todo});
    });
  }
  function full(f, essentialsDone){
    const steps = G.full.steps.map(st => Object.assign({}, st, {
      id: 'step-' + st.n, label: `Step ${st.n}: ${st.title}`, href: `playbook.html#step-${st.n}`, cta: `Open step ${st.n}`,
      note: (essentialsDone ? G.full.after_essentials + ' ' : '') + G.full.step_note,
      done: st.n === 0 ? f.profile : f.steps.has(String(st.n)),
    }));
    const tools = G.full.tools.map(t => Object.assign({}, t, {
      done: t.id === 'risk' ? f.snapshots > 0 : f.copies > 0, note: t.todo}));
    return steps.concat(tools);
  }

  /* everything the page needs: both tracks, counts, and the one next thing */
  function status(saved){
    const f = facts(saved);
    const e = essentials(f), u = full(f, e.every(x => x.done));
    const next = e.find(x => !x.done) || u.find(x => !x.done) || Object.assign({id: 'all_done', done: false, note: G.all_done.todo}, G.all_done);
    const track = e.some(x => x === next) ? 'essentials' : u.some(x => x === next) ? 'full' : 'done';
    const any = f.profile || f.quick || f.policy || f.policy_started || f.lines > 0 || f.checkins > 0 || f.calendar ||
      f.steps.size > 0 || f.snapshots > 0 || f.copies > 0;
    return {
      essentials: e, full: u, next, track, any,
      counts: {essentials: [e.filter(x => x.done).length, e.length], full: [u.filter(x => x.done).length, u.length]},
    };
  }

  /* the saved data, from the browser's storage (or stand-ins in the tests) */
  const KEYS = {profile: 'sb-ai-playbook:profile', quick: 'sb-ai-playbook:quick', policy: 'sb-ai-playbook:policy',
    ai_list: 'sb-ai-playbook:ai-list', pulse: 'sb-ai-playbook:pulse', pulse_calendar: 'sb-ai-playbook:pulse-calendar',
    done: 'sb-ai-playbook:done', risk: 'sb-ai-playbook:risk', record: 'sb-ai-playbook:record'};
  function readSaved(local, session){
    /* most keys hold JSON; the calendar date is plain text */
    const get = (area, k) => {
      let v = null;
      try { v = area.getItem(k); } catch (e) { return null; }
      if (v === null || v === undefined) return null;
      try { return JSON.parse(v); } catch (e) { return v; }
    };
    const out = {};
    Object.keys(KEYS).forEach(k => { out[k] = local ? get(local, KEYS[k]) : null; });
    out.policy_draft = session ? get(session, 'sb-ai-playbook:policy-draft') : null;
    return out;
  }

  return {facts, status, readSaved};
})();
