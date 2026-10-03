/* Prints every test run (tests/quick_rules_test.js, tests/quick_policy_test.js, tests/quick_pulse_test.js)
   for the terminal runner. */
[typeof TestRun !== 'undefined' && TestRun, typeof PolicyTestRun !== 'undefined' && PolicyTestRun, typeof PulseTestRun !== 'undefined' && PulseTestRun, typeof ProfileTestRun !== 'undefined' && ProfileTestRun, typeof ToolTestRun !== 'undefined' && ToolTestRun, typeof RiskTestRun !== 'undefined' && RiskTestRun, typeof AnswersTestRun !== 'undefined' && AnswersTestRun, typeof RecordTestRun !== 'undefined' && RecordTestRun, typeof PrivacyTestRun !== 'undefined' && PrivacyTestRun].filter(Boolean).forEach(run => {
  run.results.forEach(r => {
    print((r.fails.length ? 'FAIL ' : 'ok   ') + r.name);
    r.fails.slice(0, 8).forEach(f => print('       ' + f));
    if (r.fails.length > 8) print('       ... and ' + (r.fails.length - 8) + ' more');
  });
  print(run.summary);
  print('');
});
