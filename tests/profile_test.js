/* Tests for the business profile (profile_engine.js, data/profile_effects.js).
   Run with the other tests: tests/run_tests.sh or tests/run_tests.html.
   The check that every target exists on its page reads the page files, so it
   runs in the terminal only; the browser runner says it was skipped. */

var ProfileTestRun = (function(){
  const PR = ProfileEngine, FX = PROFILE_EFFECTS, O = PROFILE_OPTIONS;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'profile: ' + name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }
  const P = o => PR.clean(Object.assign(PR.blank(), o));
  const DANA = P({team_size: 'solo', ai_use: ['use'], industry: ['finance'], finance_subtype: 'advice', registration: 'state'});
  const ids = list => list.map(e => e.id).sort();

  /* ---------- data ---------- */
  test('no em dashes or en dashes in effects or overlays', () => {
    ok(!/[\u2013\u2014]/.test(JSON.stringify(FX) + JSON.stringify(O.overlays)), 'found a dash');
  });
  test('every effect is complete, and names a page and place the list can describe', () => {
    const seen = {};
    FX.effects.forEach(e => {
      ok(!seen[e.id], 'duplicate id ' + e.id); seen[e.id] = 1;
      ok(['note', 'hide', 'tag', 'banner', 'overlay'].includes(e.kind), e.id + ': kind');
      ok(FX.pages[e.page], e.id + ': page has a name');
      ok(e.target === null ? e.kind === 'banner' : FX.targets[e.target], e.id + ': target has a name');
      if (e.kind === 'note') ok(e.title && e.text, e.id + ': note needs title and text');
      if (e.kind === 'hide') ok(e.reason, e.id + ': hide needs a reason');
      if (e.kind === 'tag') ok(e.text, e.id + ': tag needs text');
    });
  });
  test('the basics are never hidden: no effect hides a playbook step', () => {
    FX.effects.filter(e => e.kind === 'hide').forEach(e => {
      ok(!FX.core.includes(e.target), e.id + ' hides a core step');
      ok(e.page !== 'playbook.html', e.id + ' hides something on the playbook page');
    });
  });
  test('every target and link exists (reads the page files)', () => {
    if (typeof readFile !== 'function'){ current.skipped = 'terminal only'; return; }
    const cache = {};
    const page = f => cache[f] || (cache[f] = readFile(f));
    FX.effects.filter(e => e.target).forEach(e => {
      const html = page(e.page);
      const m = /^#(.+)$/.exec(e.target) || /^a\[href="(.+)"\]$/.exec(e.target);
      ok(m, e.id + ': target form');
      if (m) ok(html.includes(e.target[0] === '#' ? `id="${m[1]}"` : `href="${m[1]}"`), `${e.id}: ${e.target} not found in ${e.page}`);
    });
    FX.effects.forEach(e => (e.links || []).forEach(l => {
      try { page(l.href.split('#')[0]); } catch (err) { ok(false, `${e.id}: link to missing file ${l.href}`); }
    }));
  });
  test('every industry but other has an overlay, and each is dated', () => {
    O.industry.options.filter(o => o.id !== 'other').forEach(o => {
      const ov = O.overlays[o.id];
      ok(ov && ov.summary && ov.points.length && ov.red_line && ov.advice, o.id + ': overlay');
      ok(ov && /^\d{4}-\d{2}-\d{2}$/.test(ov.last_reviewed), o.id + ': last_reviewed');
    });
  });

  /* ---------- the profile ---------- */
  test('path: the highest of use, configure, build; none only on its own', () => {
    eq(PR.path(P({ai_use: ['use', 'build', 'configure']})), 'build', 'build');
    eq(PR.path(P({ai_use: ['use']})), 'use', 'use');
    eq(PR.path(P({ai_use: ['none']})), 'none', 'none');
    eq(P({ai_use: ['none', 'use']}).ai_use, ['use'], 'none dropped when something else is ticked');
  });
  test('link: the concept example decodes to Dana', () => {
    eq(PR.decode('#p=solo.use.finance-advice-state'), DANA, 'decoded');
    eq(PR.encode(DANA), 'p=solo.use.finance-advice-state', 'encoded');
    eq(PR.decode('#x=1&p=solo.use.finance-advice-state'), DANA, 'among other parameters');
  });
  test('link: every profile survives a round trip', () => {
    const uses = [['use'], ['configure'], ['build'], ['none'], ['use', 'configure'], ['use', 'configure', 'build']];
    const inds = O.industry.options.map(o => [o.id]).concat([['professional', 'finance'], ['healthcare', 'education']]);
    const subs = [[null, null], ['advice', 'sec'], ['advice', 'not_sure'], ['advice', null], ['insurance', null], ['lending', null]];
    let n = 0;
    ids_(O.team_size).forEach(t => uses.forEach(u => inds.forEach(i => [null].concat(ids_(O.it_support)).forEach(it =>
      (i.includes('finance') ? subs : [[null, null]]).forEach(([s, r]) => {
        const p = P({team_size: t, ai_use: u, industry: i, finance_subtype: s, registration: r, it_support: it});
        eq(PR.decode('#' + PR.encode(p)), p, PR.encode(p));
        n++;
      })))));
    ok(n > 1000, 'checked ' + n);
  });
  function ids_(list){ return list.options.map(o => o.id); }
  test('link: junk is dropped or refused, never trusted', () => {
    eq(PR.decode('#p=giant.use.retail'), null, 'unknown team size');
    eq(PR.decode('#p=solo.use.retail+pirates').industry, ['retail'], 'unknown industry dropped');
    eq(PR.decode('#p=solo.use.retail+finance+healthcare').industry, ['retail', 'finance'], 'at most two industries');
    eq(PR.decode('#p=solo.use.finance-lending-sec').registration, null, 'registration only for advisers');
    eq(PR.decode('#p=solo.use.retail.everyone').it_support, null, 'unknown IT answer');
    eq(PR.decode('#step-3'), null, 'an ordinary anchor is not a profile');
    eq(PR.encode(P({team_size: 'solo'})), '', 'an unfinished profile has no link');
  });
  test('summary bar words', () => {
    eq(PR.summary(DANA), ['Just me', 'Ready-made tools', 'Finance (advice)'], 'Dana');
    eq(PR.summary(P({team_size: 'medium', ai_use: ['use', 'configure'], industry: ['trades', 'creative']})),
      ['Team of 11 to 50', 'Tools you set up', 'Trades and Creative'], 'two industries');
  });

  /* ---------- effects ---------- */
  test('Dana: notes on five steps and her industry, two templates set aside', () => {
    const f = PR.facts(DANA, 'unknown');
    eq(ids(PR.effectsFor('playbook.html', f)), ['industry.overlay', 'solo.step1', 'solo.step2', 'solo.step3', 'solo.step6', 'solo.step8'], 'playbook');
    eq(ids(PR.effectsFor('policies.html', f)), ['solo.hide.approval', 'solo.hide.lead'], 'policies');
    eq(ids(PR.effectsFor('guide-ai-policy.html', f)), ['solo.policy'], 'policy guide');
    const ov = PR.overlays(DANA)[0];
    ok(ov.points.some(x => x.startsWith('Advisers:')), 'adviser point');
    ok(ov.points.some(x => x.startsWith('State-registered advisers')), 'registration point');
  });
  test('a team of 30 that sets up automations, with an IT company', () => {
    const p = P({team_size: 'medium', ai_use: ['use', 'configure'], industry: ['trades'], it_support: 'provider'});
    const f = PR.facts(p, 'yes');
    eq(ids(PR.effectsFor('playbook.html', f)), ['acts.yes.step7', 'configure.review', 'configure.step7', 'industry.overlay', 'it.provider.step7'], 'playbook');
    eq(ids(PR.effectsFor('policies.html', f)), ['medium.tag.approval', 'medium.tag.lead'], 'policies');
  });
  test('over 50 gets a banner on every page; build gets the developer notes', () => {
    const f = PR.facts(P({team_size: 'large', ai_use: ['build'], industry: ['other']}));
    ok(PR.effectsFor('guide-data.html', f).some(e => e.id === 'large.banner'), 'banner anywhere');
    ok(PR.effectsFor('playbook.html', f).some(e => e.id === 'build.step5'), 'developer notes');
    ok(!PR.effectsFor('playbook.html', f).some(e => e.id === 'industry.overlay'), 'no overlay for other');
  });
  test('every possible profile: no step hidden, and every change can be described', () => {
    let n = 0;
    ids_(O.team_size).forEach(t => ['use', 'configure', 'build', 'none'].forEach(u => ids_(O.industry).forEach(i =>
      [null].concat(ids_(O.it_support)).forEach(it => ['yes', 'no', 'unknown'].forEach(a => {
        const f = PR.facts(P({team_size: t, ai_use: [u], industry: [i], it_support: it}), a);
        PR.allEffects(f).forEach(e => {
          ok(!(e.kind === 'hide' && FX.core.includes(e.target)), 'core hidden');
          const d = PR.describe(e);
          ok(d.where && d.what, 'describe ' + e.id);
        });
        n++;
      })))));
    ok(n > 1000, 'checked ' + n);
  });

  /* ---------- the AI list, not just the profile ---------- */
  test('acts: worked out from a saved quick check and monthly check-ins', () => {
    eq(PR.actsFromSaved(null, null), 'unknown', 'nothing saved');
    eq(PR.actsFromSaved({screener: {answers: {q3: 'no'}}, finds: [{tags: {can_act: 'no'}}]}, null), 'no', 'nothing acts');
    eq(PR.actsFromSaved({screener: {answers: {q3: 'no'}}, finds: [{tags: {can_act: 'after_approval'}}]}, null), 'yes', 'a card that acts');
    eq(PR.actsFromSaved({screener: {answers: {q3: 'not_sure'}}, finds: []}, null), 'yes', 'not sure counts as might');
    eq(PR.actsFromSaved({screener: {answers: {q3: 'no'}}, finds: []}, {checkins: [{connections: [{name: 'x'}]}]}), 'yes', 'a new connection');
  });
  test('the other tools start from the profile', () => {
    eq(PR.forTools(DANA), {industry: 'finance', policy_team: 'solo'}, 'Dana');
    eq(PR.forTools(P({team_size: 'small', ai_use: ['use'], industry: ['retail']})).policy_team, 'team', 'team');
  });

  /* ---------- step 0 ---------- */
  test('step 0: three questions, and finance adds what kind and how registered', () => {
    eq(PR.zeroSteps(PR.blank()), ['team', 'use', 'industry'], 'blank');
    eq(PR.zeroSteps(P({industry: ['retail']})), ['team', 'use', 'industry'], 'retail');
    eq(PR.zeroSteps(P({industry: ['finance'], finance_subtype: 'insurance'})), ['team', 'use', 'industry', 'finance_sub'], 'insurance');
    eq(PR.zeroSteps(DANA), ['team', 'use', 'industry', 'finance_sub', 'registration'], 'Dana');
    PR.zeroSteps(DANA).forEach(id => ok(PR.zeroQuestion(id) && PR.zeroQuestion(id).options.length, id + ': has options'));
  });
  test('step 0: answers build a clean profile, one question at a time', () => {
    let p = PR.blank();
    p = PR.zeroAnswer(p, 'team', 'solo');
    p = PR.zeroAnswer(p, 'use', 'use');
    p = PR.zeroAnswer(p, 'use', 'configure');
    eq(p.ai_use, ['use', 'configure'], 'several uses');
    eq(PR.zeroAnswer(p, 'use', 'none').ai_use, ['none'], 'none stands alone');
    eq(PR.zeroAnswer(PR.zeroAnswer(p, 'use', 'none'), 'use', 'build').ai_use, ['build'], 'an answer replaces none');
    eq(PR.zeroAnswer(p, 'use', 'use').ai_use, ['configure'], 'choosing again removes it');
    ok(!PR.zeroComplete(p), 'no industry yet');
    p = PR.zeroAnswer(p, 'industry', 'finance');
    ok(PR.complete(p) && !PR.zeroComplete(p), 'finance still needs what kind');
    p = PR.zeroAnswer(p, 'finance_sub', 'advice');
    ok(!PR.zeroComplete(p), 'advice still needs registration');
    p = PR.zeroAnswer(p, 'registration', 'sec');
    ok(PR.zeroComplete(p), 'complete');
    p = PR.zeroAnswer(p, 'industry', 'retail');
    eq([p.industry, p.finance_subtype, p.registration], [['retail'], null, null], 'leaving finance clears its answers');
  });
  test('step 0: changing the first industry keeps a second one, and IT support stays', () => {
    const two = P({team_size: 'small', ai_use: ['use'], industry: ['professional', 'finance'], finance_subtype: 'lending', it_support: 'provider'});
    eq(PR.zeroValue(two, 'industry'), ['professional'], 'shows the first');
    const n = PR.zeroAnswer(two, 'industry', 'healthcare');
    eq([n.industry, n.finance_subtype, n.it_support], [['healthcare', 'finance'], 'lending', 'provider'], 'second industry and IT kept');
    eq(PR.zeroAnswer(two, 'industry', 'finance').industry, ['finance'], 'picking the second as the first leaves one');
  });

  const failed = results.filter(r => r.fails.length);
  const skipped = results.filter(r => r.skipped);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} profile tests passed${skipped.length ? ` (${skipped.length} terminal only, skipped here)` : ''}`};
})();
