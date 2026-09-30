/* D. Answers become the policy: pure functions from answers to a policy,
   with no DOM, so the page and the tests run the same code.
   Needs, loaded first: data/profile_options.js, data/questions.js,
   data/rules.js, quick_engine.js (for carry-over from A and B),
   data/policy_questions.js.

   A policy is a list of sections; each section is a list of blocks; each
   block is text made of parts. A part is a string, {fill: label} for a
   blank still to answer, or {b: text} for bold. toHTML() writes the
   markup the site's templates use (h4, p, ul, ul.checks, span.fill), so
   docx.js turns it into Word unchanged. */

var PolicyEngine = (function(){
  const P = POLICY;

  /* ---------- small helpers ---------- */
  const on = v => v !== undefined && v !== null && v !== '';
  function fmtDate(iso){
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[m - 1]} ${d}, ${y}`;
  }
  function addMonths(iso, n){
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, last));
    return t.toISOString().slice(0, 10);
  }
  function addDays(iso, n){
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  /* "A", "A and B", "A, B and C" */
  function joinList(items){
    if (items.length < 2) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  /* "{business}: Using AI" with vars -> parts; empty vars become blanks.
     A value that starts a sentence gets a capital ("the owner decides"
     becomes "The owner decides"; "ask the owner" stays as it is). */
  function fill(template, vars){
    const parts = [];
    template.split(/(\{\w+\})/).forEach(seg => {
      const m = /^\{(\w+)\}$/.exec(seg);
      if (!m){ if (seg) parts.push(seg); return; }
      const v = vars[m[1]];
      if (!on(v)){ parts.push({fill: P.blanks[m[1]] || m[1]}); return; }
      const prev = parts[parts.length - 1];
      const starts = !parts.length || (typeof prev === 'string' && /[.!?]\s+$/.test(prev));
      const s = String(v);
      parts.push(starts ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    });
    return parts;
  }
  const text = parts => parts.map(p => typeof p === 'string' ? p : p.fill ? `[${p.fill}]` : p.b).join('');

  /* ---------- answers ---------- */
  function neverDefaults(industry){
    return P.never_options
      .filter(o => (!o.industry || o.industry === industry) && o.on && !(o.off_for || []).includes(industry))
      .map(o => o.id);
  }
  function initial(today, industry){
    return {
      team: null, industry: industry || null,
      business: '', decider: '',
      tools: [], not_yet_by: addDays(today, 30),
      never: neverDefaults(industry || null), never_other: [], never_touched: false,
      people_info: null,
      checks: P.check_options.filter(o => o.on).map(o => o.id), checks_other: [],
      decisions: null, decision_kinds: [],
      acts: null, telling: [],
      incident_who: '', incident_speed: 'straight_away',
      recording: null,
      review: addMonths(today, 3), adopted: today,
      prefilled: [],
    };
  }
  /* changing industry refreshes the suggestions, unless the owner has
     already edited the list */
  function setIndustry(a, industry){
    a.industry = industry || null;
    if (!a.never_touched) a.never = neverDefaults(a.industry);
    return a;
  }
  function visibleQuestions(a){
    return P.questions.filter(q => !(q.team_only && a.team === 'solo'));
  }
  function neverOptions(industry){
    return P.never_options.filter(o => !o.industry || o.industry === industry);
  }

  /* ---------- carry-over from the quick check (A and B) ----------
     Only answers the quick check actually gave; everything else is left for
     the owner. Returns the keys it set so the page can say where they came
     from. */
  function fromQuick(q, a){
    if (!q) return a;
    const set = k => { if (!a.prefilled.includes(k)) a.prefilled.push(k); };
    if (q.industry){ setIndustry(a, q.industry); set('industry'); }
    const s = q.screener || {};
    const cards = {};
    (q.cards || []).forEach(c => { cards[c.id] = c.answers || {}; });

    /* acting on its own: A question 3, or any card that acts */
    const acts = Object.values(cards).map(c => c.acts).filter(Boolean);
    if (s.q3 === 'yes' || acts.some(x => x === 'without_asking' || x === 'after_approval')){ a.acts = 'yes'; set('acts'); }
    else if (s.q3 === 'not_sure' || acts.includes('not_sure')){ a.acts = 'not_sure'; set('acts'); }
    else if (s.q3 === 'no'){ a.acts = 'no'; set('acts'); }

    /* decisions about people: A question 4, or the hiring card */
    if (s.q4 === 'yes' || cards.hiring){
      a.decisions = 'yes'; set('decisions');
      if (cards.hiring && !a.decision_kinds.includes('hiring')) a.decision_kinds.push('hiring');
    } else if (s.q4 === 'no'){ a.decisions = 'no'; set('decisions'); }

    /* recording: A question 6, or the meeting-notes and phone cards */
    if (s.q6 === 'yes' || cards.meetings || cards.phone){ a.recording = 'yes'; set('recording'); }
    else if (s.q6 === 'not_sure'){ a.recording = 'not_sure'; set('recording'); }

    /* telling customers: the answering-customers card */
    if (cards.customers){
      a.telling = cards.customers.says_ai === 'yes' ? ['chatbot'] : ['not_yet'];
      set('telling');
    }
    return a;
  }
  /* what the quick check said, to jog memory on the tools question */
  function quickHints(q){
    if (!q) return {activities: [], personal: false};
    const activities = (q.cards || []).map(c => QuickEngine.card(c.id)).filter(Boolean).map(c => c.label);
    const personal = (q.screener || {}).q1 === 'yes' || (q.cards || []).some(c => (c.answers || {}).account === 'personal');
    return {activities, personal};
  }

  /* ---------- the policy ---------- */
  function build(a){
    const solo = a.team === 'solo';
    const T = solo ? P.text.solo : P.text.team;
    const business = a.tools.filter(t => t.account === 'business').map(t => t.name);
    const notYet = a.tools.filter(t => t.account !== 'business').map(t => t.name);
    const speed = (P.speed_options.find(o => o.id === a.incident_speed) || {}).text;
    const vars = {
      business: a.business.trim(), decider: a.decider.trim(),
      adopted: fmtDate(a.adopted), review: fmtDate(a.review),
      incident_who: (a.incident_who || a.decider).trim(), speed,
      tools: joinList(business), date: fmtDate(a.not_yet_by),
      kinds: joinList(a.decision_kinds.map(k => (P.decision_kinds.find(o => o.id === k) || {}).label).filter(Boolean)),
    };
    const p = (tpl, extra) => ({p: fill(tpl, Object.assign({}, vars, extra || {}))});
    const pending = label => ({p: [{fill: label}]});
    const sections = [];
    const sec = (id, heading, blocks) => sections.push({id, heading, blocks: blocks.filter(Boolean)});

    sec('why', T.why_h, [p(T.why)]);
    if (!solo) sec('who', T.who_h, [p(T.who)]);

    /* approved tools. The rule "work accounts only" never appears without
       the tools that are still being moved (the design's first check). */
    const tb = [];
    if (business.length) tb.push(p(T.tools_intro), {ul: business.map(n => [n])});
    else if (!notYet.length) tb.push(p(T.tools_intro), {ul: [[{fill: P.blanks.tools}]]});
    tb.push(p(T.tools_rule));
    notYet.forEach(n => tb.push(p(T.tools_not_yet, {tool: n})));
    tb.push(p(T.tools_other));
    sec('tools', T.tools_h, tb);

    const never = neverItems(a);
    sec('never', T.never_h, [
      {ul: never.length ? never.map(n => [n]) : [[{fill: 'What must never go in'}]]},
      p(T.never_after),
    ]);

    const people = {
      approved: business.length ? T.people_approved : T.people_approved_none,
      removed: T.people_removed, none: T.people_none,
    }[a.people_info];
    sec('people', T.people_h, [people ? p(people) : pending('What customer and staff information can go in')]);

    const checks = checkItems(a);
    sec('checking', T.checking_h, [
      p(T.checking_intro),
      {ul: checks.length ? checks.map(c => [c]) : [[{fill: 'What must be checked'}]]},
      p(T.checking_after),
      a.decisions === 'yes' ? p(T.decisions_yes) : a.decisions === 'no' && T.decisions_no ? p(T.decisions_no) : null,
    ]);

    sec('acting', T.acting_h, [a.acts === 'no' ? null : p(T.acting_rule), p(T.acting_connect)]);

    const tell = {chatbot: T.telling_chatbot, agreements: T.telling_agreements, not_yet: T.telling_not_yet, no_ai: T.telling_no_ai};
    sec('telling', T.telling_h, a.telling.length
      ? P.telling_options.filter(o => a.telling.includes(o.id)).map(o => p(tell[o.id]))
      : [pending('How we tell customers about AI')]);

    const rec = a.recording === 'yes' || a.recording === 'not_sure' ? T.recording_yes
      : a.recording === 'no' ? T.recording_no : null;
    if (rec) sec('recording', T.recording_h, [p(rec)]);
    else if (a.recording === null) sec('recording', T.recording_h, [pending('Our rule on recording calls')]);

    const contact = P.incident_contacts[a.industry];
    sec('wrong', T.wrong_h, [p(T.wrong), contact ? p(contact) : null]);
    sec('review', T.review_h, [p(T.review)]);

    if (solo && business.length){
      const blocks = [];
      business.forEach(n => blocks.push({p: [{b: n}]}, {checks: T.settings.map(s => ['☐ ' + s])}));
      sec('settings', T.settings_h, blocks);
    }
    if (!solo) sections.push({id: 'sign', heading: null, blocks: [
      p(T.sign), {p: ['Name: ____________   Signed: ____________   Date: ____________']},
    ]});

    return {
      solo,
      title: fill(T.title, vars),
      meta: fill(T.meta, vars),
      sections,
      footer: fill(T.footer, vars),
      never_sheet: {
        title: fill(solo ? P.never_sheet.title_solo : P.never_sheet.title_team, vars),
        items: never,
        after: fill(solo ? P.never_sheet.after_solo : P.never_sheet.after, vars),
      },
      todos: todos(a, business, notYet),
    };
  }
  function neverItems(a){
    return neverOptions(a.industry).filter(o => a.never.includes(o.id)).map(o => o.label)
      .concat(a.never_other.map(s => s.trim()).filter(Boolean));
  }
  function checkItems(a){
    const solo = a.team === 'solo';
    return P.check_options.filter(o => a.checks.includes(o.id))
      .map(o => (solo && o.solo_label) || o.label).map(l => l.charAt(0).toLowerCase() + l.slice(1))
      .concat(a.checks_other.map(s => s.trim()).filter(Boolean));
  }
  function todos(a, business, notYet){
    const out = [];
    const add = (key, vars) => { const t = P.todos[key]; out.push({id: key, text: text(fill(t.text, vars || {})), owner: t.owner}); };
    if (notYet.length) add('not_yet_tools', {tools: joinList(notYet), date: fmtDate(a.not_yet_by) || 'a date you choose'});
    if (a.people_info === 'approved' && !business.length) add('no_business');
    if (a.acts === 'not_sure') add('acts_not_sure');
    if (a.telling.includes('not_yet')) add('telling_not_yet');
    if (a.recording === 'not_sure') add('recording_not_sure');
    if (a.decisions === 'yes') add('decisions_advice');
    if (a.team !== 'solo') add('share');
    if (a.team === 'solo' && business.length) add('settings');
    return out;
  }

  /* ---------- markup ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  function partsHTML(parts){
    return parts.map(x => typeof x === 'string' ? esc(x)
      : x.fill ? `<span class="fill">[${esc(x.fill)}]</span>`
      : `<strong>${esc(x.b)}</strong>`).join('');
  }
  function blockHTML(b){
    if (b.p) return `<p>${partsHTML(b.p)}</p>`;
    if (b.ul) return `<ul>${b.ul.map(li => `<li>${partsHTML(li)}</li>`).join('')}</ul>`;
    if (b.checks) return `<ul class="checks">${b.checks.map(li => `<li>${partsHTML(li)}</li>`).join('')}</ul>`;
    return '';
  }
  /* the title stays the first element, so docx.js uses it as the title */
  function toHTML(doc){
    return `<h4>${partsHTML(doc.title)}</h4>` +
      `<div class="pol-sec" data-sec="title"><p>${partsHTML(doc.meta)}</p></div>` +
      doc.sections.map(s => `<div class="pol-sec" data-sec="${s.id}">${s.heading ? `<h4>${esc(s.heading)}</h4>` : ''}${s.blocks.map(blockHTML).join('')}</div>`).join('') +
      `<div class="pol-sec" data-sec="review"><p><em>${partsHTML(doc.footer)}</em></p></div>`;
  }
  function neverHTML(doc){
    const n = doc.never_sheet;
    return `<h4>${partsHTML(n.title)}</h4>` +
      `<ul>${(n.items.length ? n.items : ['']).map(i => `<li>${i ? esc(i) : '<span class="fill">[What must never go in]</span>'}</li>`).join('')}</ul>` +
      `<p>${partsHTML(n.after)}</p>`;
  }
  const plain = doc => [text(doc.title), text(doc.meta)]
    .concat(doc.sections.flatMap(s => [s.heading ? '\n' + s.heading : null].concat(s.blocks.map(b =>
      b.p ? text(b.p) : (b.ul || b.checks).map(li => (b.ul ? '- ' : '') + text(li)).join('\n')))).filter(x => x !== null))
    .concat(['', text(doc.footer)]).join('\n');

  /* ---------- carry-over into the full tools ----------
     Shapes follow exploratory/feature_concepts/04_rules_as_data.md: the
     playbook's "done when" answers for steps 1, 3, 4 and 6, and each tool
     named here as a discovery find. */
  function carryOver(a, today){
    const doc = build(a);
    return {
      kind: 'quick_policy',
      policy_version: P.version,
      saved_on: today,
      profile: {team_size: a.team, industry: a.industry},
      answers: a,
      playbook: {
        step_1: {decides_new_tools: a.team === 'solo' ? 'owner' : a.decider || null, ask_if_unsure: a.team === 'solo' ? 'owner' : a.decider || null, evidence: 'recorded', date: a.adopted},
        step_3: {rules_last_updated: a.adopted, next_review: a.review, evidence: 'recorded'},
        step_4: {never_put_in: doc.never_sheet.items, people_info: a.people_info, evidence: 'recorded'},
        step_6: {human_checks: checkItems(a), decisions_about_people: a.decisions, evidence: 'recorded'},
      },
      finds: a.tools.map((t, i) => ({
        id: 'policy-' + String(i + 1).padStart(3, '0'), name: t.name, found_by: 'quick_d', found_on: today,
        tags: {account: t.account === 'business' ? 'business' : 'personal'}, status: 'to_check',
      })),
      todos: doc.todos,
    };
  }

  return {
    fmtDate, addMonths, addDays, joinList, fill, text,
    initial, setIndustry, neverDefaults, neverOptions, visibleQuestions,
    fromQuick, quickHints, build, toHTML, neverHTML, plain, carryOver,
  };
})();
