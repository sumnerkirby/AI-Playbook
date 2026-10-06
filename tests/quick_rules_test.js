/* Tests for the quick check rules and engine. The worked examples double as
   documentation: given this business and these answers, expect this result.

   Terminal (macOS, nothing to install):  tests/run_tests.sh
   Browser:                               tests/run_tests.html

   Sources of the cases:
     Dana        exploratory/walkthroughs/solo_financial_adviser.md, and the
                 Dana sections of quick_questionnaires/01 and 02
     Example 1-5 exploratory/feature_concepts/02_tool_check.md, worked
                 examples, as far as the quick cards can express them */

var TestRun = (function(){
  const E = QuickEngine;
  const results = [];
  let current = null;

  function test(name, fn){
    current = {name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }
  const ids = r => r.hits.map(h => h.id).sort();

  /* every combination of answers for a list of {id, answers} questions */
  function combos(questions){
    let out = [{}];
    questions.forEach(q => {
      const next = [];
      out.forEach(o => q.answers.forEach(a => next.push(Object.assign({}, o, {[q.id]: a.id}))));
      out = next;
    });
    return out;
  }
  const INDUSTRIES = [null].concat(PROFILE_OPTIONS.industry.options.map(o => o.id));

  /* ================= data integrity ================= */

  test('rule ids are unique', () => {
    const seen = {};
    RULES.rules.forEach(r => { ok(!seen[r.id], 'duplicate rule id ' + r.id); seen[r.id] = 1; });
  });

  test('every rule is complete and dated', () => {
    RULES.rules.forEach(r => {
      ok(['screener', 'card'].includes(r.check), r.id + ': check');
      ok(['stop', 'check'].includes(r.outcome), r.id + ': outcome');
      ok(r.reason && r.fix, r.id + ': reason and fix');
      ok(/^\d{4}-\d{2}-\d{2}$/.test(r.last_reviewed), r.id + ': last_reviewed');
      ok(r.how && r.how.href && r.how.label, r.id + ': how link');
      ok(r.check !== 'screener' || r.title, r.id + ': screener rules need a title');
      ok(!r.flag || r.flag === 'get_advice', r.id + ': flag');
      ok(['you', 'it_provider', 'supplier', 'advisor'].includes(r.owner), r.id + ': owner');
      (r.sources || []).forEach(s => ok(RULE_SOURCES[s], r.id + ': unknown source ' + s));
    });
  });

  test('every rule condition names a real question and real answers', () => {
    const screenerQ = {}, cardQ = {};
    SCREENER.questions.forEach(q => { screenerQ[q.id] = q.answers.map(a => a.id); });
    Object.keys(CARD_QUESTIONS).forEach(id => { cardQ[id] = CARD_QUESTIONS[id].answers.map(a => a.id); });
    cardQ._card = CARDS.cards.map(c => c.id);
    function walk(cond, table, rid){
      if (cond.all || cond.any) return (cond.all || cond.any).forEach(c => walk(c, table, rid));
      ok(table[cond.q], `${rid}: unknown question ${cond.q}`);
      (cond.in || []).forEach(v => ok(table[cond.q] && table[cond.q].includes(v), `${rid}: ${cond.q} has no answer ${v}`));
    }
    RULES.rules.forEach(r => walk(r.when, r.check === 'screener' ? screenerQ : cardQ, r.id));
  });

  test('every card question has a short label for the result', () => {
    Object.entries(CARD_QUESTIONS).forEach(([id, q]) => ok(q.short, id + ': short'));
    CARDS.cards.forEach(c => c.questions.forEach(id => ok(CARD_QUESTIONS[id], `${c.id}: unknown question ${id}`)));
  });

  test('codes used in links are unique where they need to be', () => {
    const cardCodes = CARDS.cards.map(c => c.code);
    eq(new Set(cardCodes).size, cardCodes.length, 'card codes');
    const qCodes = Object.values(CARD_QUESTIONS).map(q => q.code);
    eq(new Set(qCodes).size, qCodes.length, 'card question codes');
    INDUSTRIES.forEach(ind => {
      const codes = E.screenerQuestions({industry: ind}, {q4: 'yes'}).map(q => q.code);
      eq(new Set(codes).size, codes.length, 'screener codes for ' + ind);
    });
    const indCodes = PROFILE_OPTIONS.industry.options.map(o => o.code);
    eq(new Set(indCodes).size, indCodes.length, 'industry codes');
    [...SCREENER.questions, ...Object.values(CARD_QUESTIONS)].forEach(q => {
      const c = q.answers.map(a => a.code);
      eq(new Set(c).size, c.length, 'answer codes in ' + (q.id || q.text));
    });
  });

  /* ================= A. screener ================= */

  test('screener: six questions, a seventh only for finance', () => {
    eq(E.screenerQuestions({industry: null}, {}).length, 6, 'no industry');
    eq(E.screenerQuestions({industry: 'retail'}, {}).length, 6, 'retail');
    eq(E.screenerQuestions({industry: 'other'}, {}).length, 6, 'other');
    eq(E.screenerQuestions({industry: 'finance'}, {}).map(q => q.id).pop(), 'q7_finance', 'finance');
    ok(SCREENER.questions.every(q => !q.applies_to || q.applies_to.industry.every(i => PROFILE_OPTIONS.industry.options.some(o => o.id === i))), 'every seventh question is for an industry still offered');
    eq(E.screenerQuestions({industry: null}, {q4: 'yes'}).length, 7, 'q4 yes opens the follow-up');
  });

  test('screener: passwords, Yes or Not sure, both say to change any password (FIXES 2.6)', () => {
    const fix = id => RULES.rules.find(r => r.id === id).fix;
    ok(/Change any password/.test(fix('a.never_put_in')), 'yes');
    ok(/Change any password you find\.$/.test(fix('a.never_put_in.not_sure')), 'not sure');
  });

  test('screener: all no means no flags, for every industry', () => {
    INDUSTRIES.forEach(ind => {
      const ctx = {industry: ind}, a = {};
      E.screenerQuestions(ctx, {}).forEach(q => { a[q.id] = 'no'; });
      const r = E.evaluateScreener(ctx, a);
      eq(r.light, 'go', 'light for ' + ind);
      eq(r.hits.length, 0, 'flags for ' + ind);
    });
  });

  test('screener: Dana, solo financial adviser, in 90 seconds', () => {
    const ctx = {industry: 'finance'};
    const r = E.evaluateScreener(ctx, {q1: 'yes', q2: 'no', q3: 'not_sure', q4: 'no', q5: 'no', q6: 'yes', q7_finance: 'yes'});
    eq(r.light, 'stop', 'light');
    eq(r.hits.filter(h => h.outcome === 'stop').map(h => h.id).sort(),
      ['a.finance.no_agreement', 'a.personal_data.personal_account', 'a.recording_untold'], 'three stop-now fixes');
    eq(r.hits.filter(h => h.outcome === 'check').map(h => h.id), ['a.acts_without_approval.not_sure'], 'one find-out');
  });

  test('screener: a person deciding clears question 4; an old follow-up answer is dropped', () => {
    const ctx = {industry: null}, base = {q1: 'no', q2: 'no', q3: 'no', q5: 'no', q6: 'no'};
    eq(E.evaluateScreener(ctx, Object.assign({q4: 'yes', q4b: 'yes'}, base)).light, 'go', 'person decides');
    eq(ids(E.evaluateScreener(ctx, Object.assign({q4: 'yes', q4b: 'no'}, base))), ['a.decisions_no_person'], 'no person');
    eq(E.evaluateScreener(ctx, Object.assign({q4: 'no', q4b: 'no'}, base)).light, 'go', 'q4 no ignores a stale q4b');
    ok(!E.screenerComplete(ctx, Object.assign({q4: 'yes'}, base)), 'q4 yes without q4b is incomplete');
  });

  test('screener: industry question from another industry is ignored', () => {
    const r = E.evaluateScreener({industry: 'retail'}, {q1: 'no', q2: 'no', q3: 'no', q4: 'no', q5: 'no', q6: 'no', q7_healthcare: 'yes'});
    eq(r.light, 'go', 'light');
  });

  test('screener, every combination: not sure never gives go; yes always stops', () => {
    let n = 0;
    INDUSTRIES.forEach(ind => {
      const ctx = {industry: ind};
      const qs = E.screenerQuestions(ctx, {q4: 'yes'});
      combos(qs).forEach(a => {
        const visible = E.pruneScreener(ctx, a);
        const r = E.evaluateScreener(ctx, a);
        const vals = Object.entries(visible);
        const anyUnsure = vals.some(([, v]) => v === 'not_sure');
        const redLine = vals.some(([k, v]) => v === 'yes' && k !== 'q4' && k !== 'q4b') ||
                        (visible.q4 === 'yes' && visible.q4b === 'no');
        if (anyUnsure) ok(r.light !== 'go', `${ind} ${JSON.stringify(visible)} gave go with a not sure`);
        if (redLine) ok(r.light === 'stop', `${ind} ${JSON.stringify(visible)} should stop`);
        if (!anyUnsure && !redLine) ok(r.light === 'go', `${ind} ${JSON.stringify(visible)} should be go`);
        n++;
      });
    });
    ok(n > 10000, 'checked ' + n + ' combinations');
  });

  /* ================= B. cards ================= */

  test('cards: twelve for everyone plus the trial card; the finance card only for finance', () => {
    eq(E.cardsFor({industry: null}).length, 13, 'no industry');
    eq(E.cardsFor({industry: 'other'}).length, 13, 'other');
    ok(!E.cardsFor({industry: 'retail'}).some(c => c.id === 'client_planning'), 'no finance card for retail');
    ok(E.cardsFor({industry: 'finance'}).some(c => c.id === 'client_planning'), 'finance card');
  });

  test('cards: the account question only appears when personal details go in', () => {
    eq(E.cardQuestions('writing', {}).map(q => q.id), ['data'], 'before answering');
    eq(E.cardQuestions('writing', {data: 'none'}).map(q => q.id), ['data'], 'nothing personal');
    eq(E.cardQuestions('writing', {data: 'customer'}).map(q => q.id), ['data', 'account'], 'customer details');
    eq(E.cardQuestions('writing', {data: 'not_sure'}).map(q => q.id), ['data', 'account'], 'not sure');
    ok(E.cardComplete('writing', {data: 'none'}), 'complete with one answer');
    ok(!E.cardComplete('writing', {data: 'sensitive'}), 'incomplete without account');
  });

  test('industry advice: professional services get a check-with-an-advisor note, worded as a flag (log item 49)', () => {
    const t = CARDS.industry_advice.professional;
    ok(/Check with an advisor\.$/.test(t), 'ends by sending the reader to an advisor');
    ok(!/[\u2013\u2014]/.test(t), 'no dashes');
    ok(Object.keys(CARDS.industry_advice).every(id => PROFILE_OPTIONS.industry.options.some(o => o.id === id)), 'keys are real industries');
  });

  test('cards: the phone card asks what callers tell it (log item 35)', () => {
    eq(E.cardQuestions('phone', {told: 'yes', acts: 'suggests'}).map(q => q.id), ['told', 'acts', 'data'], 'asks what goes in');
    ok(!E.cardComplete('phone', {told: 'yes', acts: 'suggests'}), 'not complete before what goes in');
    const ctx = {industry: 'finance'};
    const r = E.evaluateCard('phone', {told: 'yes', acts: 'suggests', data: 'sensitive', account: 'business'}, ctx);
    eq(r.light, 'check', 'client details on a business plan: check, not go');
    ok(r.hits.some(h => h.id === 'b.finance.agreement'), 'data agreement overlay applies');
  });

  test('cards: Dana, in about 4 minutes (1 go, 2 check, 2 stop)', () => {
    const ctx = {industry: 'finance'};
    const r = {
      writing:      E.evaluateCard('writing',      {data: 'sensitive', account: 'personal'}, ctx),
      meetings:     E.evaluateCard('meetings',     {told: 'no', data: 'customer', account: 'business'}, ctx),
      marketing:    E.evaluateCard('marketing',    {data: 'none', account: 'personal'}, ctx),
      spreadsheets: E.evaluateCard('spreadsheets', {data: 'sensitive', account: 'business'}, ctx),
      inbox:        E.evaluateCard('inbox',        {acts: 'not_sure', data: 'none'}, ctx),
    };
    eq(r.writing.light, 'stop', 'writing');
    eq(r.meetings.light, 'stop', 'meetings');
    eq(r.marketing.light, 'go', 'marketing');
    eq(r.spreadsheets.light, 'check', 'spreadsheets');
    eq(r.inbox.light, 'check', 'inbox');
    eq(E.tally(Object.values(r)), {go: 1, check: 2, stop: 2}, 'tally');
    ok(r.spreadsheets.hits.some(h => h.id === 'b.finance.agreement'), 'finance overlay adds the data agreement');
  });

  test('example 1: free ChatGPT drafting replies with customer details (retail)', () => {
    const ctx = {industry: 'retail'};
    const before = E.evaluateCard('customers', {says_ai: 'yes', data: 'customer', account: 'personal'}, ctx);
    eq(before.light, 'stop', 'before');
    eq(ids(before), ['b.personal_data.personal_account'], 'reason');
    const after = E.evaluateCard('customers', {says_ai: 'yes', data: 'customer', account: 'business'}, ctx);
    eq(after.light, 'check', 'after moving plans: supplier still to check');
  });

  test('healthcare, education and defense are no longer covered (Oct 4, 2026)', () => {
    const gone = ['healthcare', 'education', 'defense'];
    ok(!PROFILE_OPTIONS.industry.options.some(o => gone.includes(o.id)), 'not offered');
    const tied = r => r.applies_to && Array.isArray(r.applies_to.industry) && r.applies_to.industry.some(i => gone.includes(i));
    ok(!RULES.rules.some(tied), 'no rule for them');
    ok(!SCREENER.questions.some(tied) && !CARDS.cards.some(tied), 'no question or card for them');
    const ctx = {industry: 'healthcare'};
    eq(E.screenerQuestions(ctx, {}).length, 6, 'an old link with healthcare gets the general questions');
  });

  test('example 3: automation that reads invoices and schedules payment (trades)', () => {
    const ctx = {industry: 'trades'};
    eq(E.evaluateCard('bookkeeping', {acts: 'without_asking', data: 'none'}, ctx).light, 'stop', 'no approval');
    const later = E.evaluateCard('bookkeeping', {acts: 'after_approval', data: 'none'}, ctx);
    eq(later.light, 'check', 'approval added, access still to limit');
    eq(ids(later), ['b.acts_after_approval'], 'remaining reason');
  });

  test('example 4: candidate screening, recruiter decides, hires in NYC', () => {
    const ctx = {industry: 'hiring'};
    const nyc = E.evaluateCard('hiring', {person_decides: 'yes', nyc_co: 'yes'}, ctx);
    eq(nyc.light, 'check', 'NYC');
    ok(nyc.hits.some(h => h.flag === 'get_advice'), 'get advice');
    eq(E.evaluateCard('hiring', {person_decides: 'yes', nyc_co: 'no'}, ctx).light, 'go', 'elsewhere');
    eq(E.evaluateCard('hiring', {person_decides: 'no', nyc_co: 'no'}, ctx).light, 'stop', 'no person');
  });

  test('example 5: writing add-on for a solo consultant (known limit of the quick cards)', () => {
    const ctx = {industry: 'professional'};
    eq(E.evaluateCard('extensions', {data: 'customer', account: 'personal'}, ctx).light, 'stop', 'client details, personal');
    /* The full tool check makes this red for client work: client-confidential
       material on a plan that may train on it. The quick cards have no
       training question and no client-confidential answer, so the best they
       can say is check. Recorded here so the gap is visible. */
    eq(E.evaluateCard('extensions', {data: 'customer', account: 'business'}, ctx).light, 'check', 'business plan');
    eq(E.evaluateCard('extensions', {data: 'none'}, ctx).light, 'check', 'add-ons are never go without a look');
  });

  test('cards, every combination: not sure never gives go; worst answer wins', () => {
    let n = 0;
    INDUSTRIES.forEach(ind => {
      const ctx = {industry: ind};
      E.cardsFor(ctx).forEach(c => {
        const qs = c.questions.map(id => Object.assign({id}, CARD_QUESTIONS[id]));
        combos(qs).forEach(a => {
          const visible = E.pruneCard(c.id, a);
          const r = E.evaluateCard(c.id, a, ctx);
          const v = visible;
          if (Object.values(v).includes('not_sure')) ok(r.light !== 'go', `${ind} ${c.id} ${JSON.stringify(v)} gave go with a not sure`);
          const red = (['customer', 'sensitive'].includes(v.data) && v.account === 'personal') ||
                      v.acts === 'without_asking' || v.person_decides === 'no' || v.told === 'no';
          if (red) ok(r.light === 'stop', `${ind} ${c.id} ${JSON.stringify(v)} should stop`);
          if (r.light === 'go') ok(!red && !Object.values(v).includes('not_sure'), `${c.id} go is clean`);
          n++;
        });
      });
    });
    ok(n > 500, 'checked ' + n + ' combinations');
  });

  /* ================= the link ================= */

  test('link: Dana round trip', () => {
    const state = {
      industry: 'finance',
      screener: {q1: 'yes', q2: 'no', q3: 'not_sure', q4: 'no', q5: 'no', q6: 'yes', q7_finance: 'yes'},
      cards: [
        {id: 'writing', answers: {data: 'sensitive', account: 'personal'}},
        {id: 'meetings', answers: {told: 'no', data: 'customer', account: 'business'}},
        {id: 'marketing', answers: {data: 'none'}},
      ],
      none: false,
    };
    const s = E.encode(state);
    eq(s, 'v=1&i=fi&a=1y2n3u4n5n6y7y&b=wr-dsap.mt-tndcab.mk-dn', 'encoded');
    eq(E.decode('#' + s), state, 'decoded');
  });

  test('link: every card answer survives a round trip', () => {
    INDUSTRIES.forEach(ind => {
      const ctx = {industry: ind};
      E.cardsFor(ctx).forEach(c => {
        const qs = c.questions.map(id => Object.assign({id}, CARD_QUESTIONS[id]));
        combos(qs).forEach(a => {
          const state = {industry: ind, screener: {}, cards: [{id: c.id, answers: E.pruneCard(c.id, a)}], none: false};
          eq(E.decode(E.encode(state)), state, `${ind} ${c.id} ${JSON.stringify(a)}`);
        });
      });
    });
  });

  test('link: junk is rejected or ignored, never trusted', () => {
    eq(E.decode(''), null, 'empty');
    eq(E.decode('#p=solo'), null, 'no version');
    const d = E.decode('#v=1&i=zz&a=1y9y2q&b=wr-dz.zz.wr-dn');
    eq(d.industry, null, 'unknown industry');
    eq(d.screener, {q1: 'yes'}, 'unknown question and answer codes dropped');
    eq(d.cards, [{id: 'writing', answers: {}}], 'unknown card dropped, duplicate card ignored');
    eq(E.decode('#v=1&b=0').none, true, 'none of these');
    eq(E.decode('#v=1&b=pn').cards, [], 'industry card without its industry');
  });

  /* ================= carry-over ================= */

  test('a task question part 1 already answered is not asked again (log item 135)', () => {
    const st = (screener, ids) => E.fromScreener({industry: null, screener, cards: ids.map(id => ({id, answers: {}}))});
    let s = st({q4: 'yes', q4b: 'yes', q6: 'no'}, ['hiring', 'meetings']);
    eq([s.cards[0].answers.person_decides, s.cards[1].answers.told], ['yes', 'yes'], 'final decision and people told come from part 1');
    eq(E.cardQuestions('hiring', s.cards[0].answers).find(q => s.cards[0].answers[q.id] === undefined).id, 'nyc_co', 'the hiring task asks only about NYC or Colorado');
    eq(st({q4: 'yes', q4b: 'no'}, ['hiring']).cards[0].answers.person_decides, 'no', 'no in part 1 stays no');
    eq(st({q4: 'no'}, ['hiring']).cards[0].answers.person_decides, 'yes', 'AI does not decide: a person does');
    eq(st({q4: 'yes', q4b: 'not_sure', q6: 'not_sure'}, ['hiring', 'phone']).cards.map(c => c.answers), [{}, {}], 'not sure in part 1: the task still asks');
    eq(st({q6: 'yes'}, ['meetings']).cards[0].answers, {}, 'something records without telling: the task asks which');
    const d = E.decode('#v=1&a=1n2n3n4ydy5n6n&b=hi');
    eq(d.cards[0].answers.person_decides, 'yes', 'a link fills it in too');
  });
  test('carry-over: tapped cards become discovery finds with quick tags', () => {
    const out = E.carryOver({
      industry: 'finance',
      screener: {q1: 'yes', q2: 'no', q3: 'not_sure', q4: 'no', q5: 'no', q6: 'yes', q7_finance: 'yes'},
      cards: [{id: 'writing', answers: {data: 'sensitive', account: 'personal'}}, {id: 'inbox', answers: {acts: 'not_sure', data: 'none'}}],
    }, '2026-09-29');
    eq(out.rules_version, RULES.version, 'rules version saved with the result');
    eq(out.finds.length, 2, 'finds');
    eq(out.finds[0].tags.account, 'personal', 'account tag');
    eq(out.finds[0].tags.customer_info, 'yes', 'customer info tag');
    eq(out.finds[1].tags.can_act, 'dont_know', 'can act tag');
    eq(out.finds[0].status, 'to_check', 'status');
    eq(out.screener.flags.length, 4, 'screener flags');
  });

  /* ---------- report ---------- */
  const failed = results.filter(r => r.fails.length);
  return {
    results, failed,
    summary: `${results.length - failed.length} of ${results.length} tests passed`,
  };
})();
