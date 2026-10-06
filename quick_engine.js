/* Quick check engine. Pure functions over the data files, with no DOM, so
   the page and the tests run exactly the same code.
   Needs, loaded first: data/profile_options.js, data/questions.js,
   data/rules.js. Runs in a browser or under JavaScriptCore (tests/). */

var QuickEngine = (function(){
  const RANK = {go: 0, check: 1, stop: 2};

  /* ---------- conditions ---------- */
  function matches(cond, answers){
    if (!cond) return true;
    if (cond.all) return cond.all.every(c => matches(c, answers));
    if (cond.any) return cond.any.some(c => matches(c, answers));
    if (cond.q) return cond.in.includes(answers[cond.q]);
    throw new Error('Unknown condition: ' + JSON.stringify(cond));
  }
  function applies(scope, ctx){
    if (!scope) return true;
    const ind = scope.industry;
    if (ind && ind !== '*' && !ind.includes(ctx.industry)) return false;
    if (scope.region && scope.region !== (ctx.region || 'us')) return false;
    return true;
  }

  /* ---------- rules: worst outcome wins, nothing is added up ---------- */
  function evaluate(check, answers, ctx){
    const hits = RULES.rules
      .filter(r => r.check === check && applies(r.applies_to, ctx) && matches(r.when, answers))
      .sort((a, b) => RANK[b.outcome] - RANK[a.outcome]);
    return {light: hits.length ? hits[0].outcome : 'go', hits};
  }

  /* ---------- A. screener ---------- */
  /* Visible questions, in order. A follow-up only counts while the answer
     that opened it still stands, so answers are pruned as we go. */
  function screenerQuestions(ctx, answers){
    const seen = {};
    return SCREENER.questions.filter(q => {
      if (!applies(q.applies_to, ctx) || !matches(q.show_if, seen)) return false;
      if (answers[q.id] !== undefined) seen[q.id] = answers[q.id];
      return true;
    });
  }
  function pruneScreener(ctx, answers){
    const out = {};
    screenerQuestions(ctx, answers).forEach(q => { if (answers[q.id] !== undefined) out[q.id] = answers[q.id]; });
    return out;
  }
  function screenerComplete(ctx, answers){
    return screenerQuestions(ctx, answers).every(q => answers[q.id] !== undefined);
  }
  function evaluateScreener(ctx, answers){
    return evaluate('screener', pruneScreener(ctx, answers), ctx);
  }

  /* ---------- B. cards ---------- */
  function cardsFor(ctx){
    return CARDS.cards.filter(c => applies(c.applies_to, ctx));
  }
  function card(id){ return CARDS.cards.find(c => c.id === id); }
  function cardQuestions(cardId, answers){
    const seen = {};
    return card(cardId).questions
      .map(id => Object.assign({id}, CARD_QUESTIONS[id]))
      .filter(q => {
        if (!matches(q.show_if, seen)) return false;
        if (answers[q.id] !== undefined) seen[q.id] = answers[q.id];
        return true;
      });
  }
  function pruneCard(cardId, answers){
    const out = {};
    cardQuestions(cardId, answers).forEach(q => { if (answers[q.id] !== undefined) out[q.id] = answers[q.id]; });
    return out;
  }
  function cardComplete(cardId, answers){
    return cardQuestions(cardId, answers).every(q => answers[q.id] !== undefined);
  }
  /* A task question that part 1 has already answered takes that answer, and
     follows part 1 if it changes (from_screener in data/questions.js). */
  function fromScreener(state){
    const s = state.screener || {};
    (state.cards || []).forEach(cd => card(cd.id).questions.forEach(id => {
      const hit = (CARD_QUESTIONS[id].from_screener || []).find(r => r.in.includes(s[r.q]));
      if (hit) cd.answers[id] = hit.answer;
    }));
    return state;
  }
  function evaluateCard(cardId, answers, ctx){
    return evaluate('card', Object.assign(pruneCard(cardId, answers), {_card: cardId}), ctx);
  }
  function tally(results){
    const t = {go: 0, check: 0, stop: 0};
    results.forEach(r => { t[r.light]++; });
    return t;
  }

  /* ---------- the link: answers after the # ----------
     v=1 & i=<industry code> & a=<question code><answer code>...
     & b=<card code>-<question code><answer code>... joined by '.'
     b=0 means "none of these" was confirmed. Free text never goes in the
     link. Browsers don't send the part after # to the server. */
  const industries = () => PROFILE_OPTIONS.industry.options;

  function encode(state){
    const p = [['v', '1']];
    const ind = industries().find(o => o.id === state.industry);
    if (ind) p.push(['i', ind.code]);
    const ctx = {industry: state.industry};
    const s = state.screener || {};
    const a = screenerQuestions(ctx, s)
      .filter(q => s[q.id] !== undefined)
      .map(q => q.code + q.answers.find(x => x.id === s[q.id]).code).join('');
    if (a) p.push(['a', a]);
    if (state.none) p.push(['b', '0']);
    else if (state.cards && state.cards.length){
      p.push(['b', state.cards.map(c => {
        const def = card(c.id), ans = c.answers || {};
        const qs = cardQuestions(c.id, ans).filter(q => ans[q.id] !== undefined);
        const body = qs.map(q => q.code + q.answers.find(x => x.id === ans[q.id]).code).join('');
        return body ? def.code + '-' + body : def.code;
      }).join('.')]);
    }
    return p.map(([k, v]) => k + '=' + v).join('&');
  }

  function decode(str){
    const params = {};
    String(str || '').replace(/^#/, '').split('&').forEach(kv => {
      const i = kv.indexOf('=');
      if (i > 0) params[kv.slice(0, i)] = kv.slice(i + 1);
    });
    if (params.v !== '1') return null;
    const state = {industry: null, screener: {}, cards: [], none: false};
    const ind = industries().find(o => o.code === params.i);
    if (ind) state.industry = ind.id;
    const ctx = {industry: state.industry};

    const a = params.a || '';
    for (let k = 0; k + 1 < a.length; k += 2){
      /* several industry questions share code 7; take the one that applies */
      const q = SCREENER.questions.find(x => x.code === a[k] && applies(x.applies_to, ctx));
      const ans = q && q.answers.find(x => x.code === a[k + 1]);
      if (ans) state.screener[q.id] = ans.id;
    }
    state.screener = pruneScreener(ctx, state.screener);

    if (params.b === '0') state.none = true;
    else if (params.b){
      params.b.split('.').forEach(chunk => {
        const [code, body = ''] = chunk.split('-');
        const def = cardsFor(ctx).find(c => c.code === code);
        if (!def || state.cards.some(c => c.id === def.id)) return;
        const answers = {};
        for (let k = 0; k + 1 < body.length; k += 2){
          const qid = def.questions.find(id => CARD_QUESTIONS[id].code === body[k]);
          const ans = qid && CARD_QUESTIONS[qid].answers.find(x => x.code === body[k + 1]);
          if (ans) answers[qid] = ans.id;
        }
        state.cards.push({id: def.id, answers: pruneCard(def.id, answers)});
      });
    }
    return fromScreener(state);
  }

  /* ---------- carry-over into the full tools ----------
     Shapes follow exploratory/feature_concepts/04_rules_as_data.md: each
     tapped card becomes a discovery find with quick tags and its use set;
     each screener flag becomes a hint for the discovery queue. */
  function carryOver(state, today){
    const ctx = {industry: state.industry};
    const tri = v => v === undefined ? undefined : v === 'not_sure' ? 'dont_know' : v;
    const finds = (state.cards || []).map((c, n) => {
      const r = evaluateCard(c.id, c.answers, ctx);
      const a = c.answers;
      return {
        id: 'quick-' + String(n + 1).padStart(3, '0'),
        name: null,
        use: c.id,
        found_by: 'quick_b',
        found_on: today,
        tags: {
          account: tri(a.account),
          customer_info: a.data === undefined ? undefined
            : a.data === 'not_sure' ? 'dont_know' : a.data === 'none' ? 'no' : 'yes',
          sensitive: a.data === 'sensitive' ? 'yes' : undefined,
          can_act: a.acts === undefined ? undefined
            : a.acts === 'not_sure' ? 'dont_know' : a.acts === 'suggests' ? 'no' : a.acts,
          people_told: tri(a.told),
          person_decides: tri(a.person_decides),
        },
        quick_light: r.light,
        quick_reasons: r.hits.map(h => h.id),
        status: 'to_check',
      };
    });
    const screener = evaluateScreener(ctx, state.screener || {});
    return {
      kind: 'quick_check',
      rules_version: RULES.version,
      profile_version: PROFILE_OPTIONS.profile_version,
      saved_on: today,
      profile: {industry: state.industry},
      screener: {answers: pruneScreener(ctx, state.screener || {}), light: screener.light, flags: screener.hits.map(h => h.id)},
      finds,
    };
  }

  return {
    matches, applies, evaluate,
    screenerQuestions, pruneScreener, screenerComplete, evaluateScreener,
    cardsFor, card, cardQuestions, pruneCard, cardComplete, fromScreener, evaluateCard, tally,
    encode, decode, carryOver,
  };
})();
