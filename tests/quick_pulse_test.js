/* Tests for F, the monthly pulse (pulse_engine.js).
   Run with the other tests: tests/run_tests.sh or tests/run_tests.html. */

var PulseTestRun = (function(){
  const PU = PulseEngine;
  const results = [];
  let current = null;
  function test(name, fn){
    current = {name: 'pulse: ' + name, fails: []};
    try { fn(); } catch (e) { current.fails.push('threw: ' + (e && e.message || e)); }
    results.push(current);
  }
  function eq(actual, expected, what){
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) current.fails.push(`${what || 'value'}: expected ${b}, got ${a}`);
  }
  function ok(cond, what){ if (!cond) current.fails.push(what || 'expected true'); }
  function throws(fn, what){ try { fn(); current.fails.push(what + ': expected an error'); } catch (e) {} }
  const ctx = {industry: 'finance'};

  function checkin(date, extra){ return Object.assign(PU.newCheckin(date), extra || {}); }
  function tool(name, card, answers){ return Object.assign({name, card, answers}, PU.toolLight(card, answers, ctx)); }
  function danaYear(){
    const log = PU.emptyLog();
    log.industry = 'finance';
    log.checkins.push(checkin('2026-10-02', {sweep: {answer: 'yes', found: ['Otter.ai']}}));
    log.checkins.push(checkin('2026-11-03', {new_tools: [tool('Copilot in Outlook', 'writing', {data: 'sensitive', account: 'personal'})]}));
    log.checkins.push(checkin('2026-12-01', {
      incidents: [{text: 'Pasted a client email into the free ChatGPT'}],
      connections: [{name: 'Zapier invoices', approval: 'none', light: 'stop'}],
    }));
    return log;
  }

  /* ---------- data ---------- */
  test('no em dashes or en dashes in any pulse wording', () => {
    ok(!/[\u2013\u2014]/.test(JSON.stringify(PULSE)), 'found a dash');
  });
  test('every approval answer has a rule, and none is missing a fix', () => {
    PULSE.questions.connection.approval.forEach(o => {
      const r = PU.connectionRule(o.id);
      ok(r && r.light && r.reason && r.fix, 'rule for ' + o.id);
    });
    eq(PU.connectionRule('none').light, 'stop', 'acting with no approval is a red line, as in the tool check');
    eq(PU.connectionRule('not_sure').light, 'check', 'not sure never gives go');
  });

  /* ---------- when things are due ---------- */
  test('status: none, done, due, overdue, and the next date', () => {
    const log = PU.emptyLog();
    eq(PU.status(log, '2026-09-29').state, 'none', 'no check-ins');
    log.checkins.push(checkin('2026-09-01'));
    eq(PU.status(log, '2026-09-29'), {state: 'done', days: 28, last: '2026-09-01', next: '2026-10-01'}, 'recent');
    eq(PU.status(log, '2026-10-01').state, 'due', '30 days');
    eq(PU.status(log, '2026-10-16').state, 'overdue', '45 days');
  });
  test('the statement sweep: first time, then every third month after someone looked', () => {
    const log = PU.emptyLog();
    ok(PU.sweepDue(log, '2026-09-29'), 'first check-in');
    log.checkins.push(checkin('2026-09-29', {sweep: {answer: 'no', found: []}}));
    ok(!PU.sweepDue(log, '2026-10-29'), 'one month later');
    ok(!PU.sweepDue(log, '2026-11-02'), 'two months later');
    ok(PU.sweepDue(log, '2026-12-01'), 'third month');
    const later = PU.emptyLog();
    later.checkins.push(checkin('2026-09-29', {sweep: {answer: 'not_looked', found: []}}));
    ok(PU.sweepDue(later, '2026-10-29'), 'I\'ll look later asks again next month');
  });
  test('backup reminder after three check-ins, then every 90 days', () => {
    const log = danaYear();
    ok(PU.backupDue(log, '2026-12-01'), 'three check-ins, never backed up');
    log.last_backup = '2026-12-01';
    ok(!PU.backupDue(log, '2027-01-15'), 'recently backed up');
    ok(PU.backupDue(log, '2027-03-02'), '90 days later');
    const two = PU.emptyLog(); two.checkins.push(checkin('2026-10-01'), checkin('2026-11-01'));
    ok(!PU.backupDue(two, '2027-06-01'), 'not before the third check-in');
  });

  /* ---------- the answers ---------- */
  test('a new tool gets the same light it would get in the quick check', () => {
    const answers = {data: 'sensitive', account: 'personal'};
    eq(PU.toolLight('writing', answers, ctx).light, QuickEngine.evaluateCard('writing', answers, ctx).light, 'same as B');
    eq(PU.toolLight('writing', answers, ctx).light, 'stop', 'stop');
    eq(PU.toolLight('marketing', {data: 'none'}, ctx).light, 'go', 'go');
  });
  test('"no, no, no" is still a dated check-in', () => {
    const c = checkin('2026-10-01');
    eq(PU.summary(c), 'no new tools, nothing went wrong, no new connections', 'summary');
    eq(PU.worst(c), 'go', 'light');
  });
  test('a year of Dana: the list, the incident log and the worst light per month', () => {
    const log = danaYear();
    eq(PU.aiList(log).map(x => [x.date, x.name, x.light]), [
      ['2026-12-01', 'Zapier invoices', 'stop'],
      ['2026-11-03', 'Copilot in Outlook', 'stop'],
      ['2026-10-02', 'Otter.ai', null],
    ], 'AI list, newest first');
    eq(PU.incidents(log), [{date: '2026-12-01', text: 'Pasted a client email into the free ChatGPT'}], 'incidents');
    eq(PU.sorted(log).map(PU.worst), ['go', 'stop', 'stop'], 'worst per check-in');
    eq(PU.summary(log.checkins[2]), 'no new tools, 1 thing went wrong, 1 new connection', 'summary');
  });

  /* ---------- calendar file ---------- */
  test('calendar file: valid shape, monthly, lines folded, text escaped', () => {
    const url = 'https://example.github.io/ai-playbook/quick_pulse.html';
    const s = PU.ics({start: '2026-10-31', stamp: '20260929T120000Z', url});
    ok(s.startsWith('BEGIN:VCALENDAR\r\n') && s.endsWith('END:VCALENDAR\r\n'), 'wrapped, with CRLF');
    ok(s.includes('\r\nRRULE:FREQ=MONTHLY\r\n'), 'monthly');
    ok(s.includes('DTSTART:20261028T090000'), 'the 31st moves to the 28th so no month is skipped');
    ok(s.includes('New AI tools\\, problems with AI\\,'), 'commas escaped');
    s.split('\r\n').forEach(l => ok(l.length <= 75, 'line too long: ' + l));
    ok(s.replace(/\r\n /g, '').includes('URL:' + url), 'URL survives folding');
    ok(!/\n(?!.)/.test(s.replace(/\r\n/g, '')), 'no bare newlines');
  });

  /* ---------- CSV ---------- */
  test('CSV: one row per thing, quotes doubled, formulas defused', () => {
    const log = danaYear();
    log.checkins[2].incidents.push({text: '=HYPERLINK("http://x","click")'});
    const rows = PU.csv(log).trim().split('\r\n');
    eq(rows[0], 'date,kind,name,detail,light', 'header');
    ok(rows.includes('2026-11-03,new tool,Copilot in Outlook,"Writing emails, letters or documents",stop'), 'new tool row');
    ok(rows.includes('2026-12-01,something went wrong,,"\'=HYPERLINK(""http://x"",""click"")",'), 'formula defused and quoted: ' + rows.filter(r => r.includes('HYPERLINK')));
    eq(rows.filter(r => r.split(',')[1] === 'check-in').length, 3, 'one check-in row each');
  });

  /* ---------- backup and restore ---------- */
  test('restore: a backup round-trips', () => {
    const log = danaYear(); log.last_backup = '2026-12-01';
    const r = PU.restore(JSON.parse(JSON.stringify(log)), ctx);
    eq(r.dropped, 0, 'nothing dropped');
    eq(r.log, log, 'same log');
  });
  test('restore: trusts nothing in the file', () => {
    throws(() => PU.restore(null), 'null');
    throws(() => PU.restore({checkins: 'no'}), 'not a list');
    const r = PU.restore({industry: 'pirates', checkins: [
      {date: 'yesterday'},
      {date: '2026-10-01', new_tools: [
        {name: 'Tampered', card: 'writing', answers: {data: 'sensitive', account: 'personal', evil: 'x'}, light: 'go'},
        {name: 'Unknown card', card: 'teleport', answers: {}},
      ], incidents: [{text: 'line\u0000one\nline two'}, {text: ''}],
      connections: [{name: 'Bot', approval: 'maybe'}], sweep: {answer: 'yes', found: ['A', 7, '']}},
    ]});
    eq(r.log.industry, null, 'unknown industry');
    eq(r.log.checkins.length, 1, 'bad date dropped');
    const c = r.log.checkins[0];
    eq(c.new_tools.map(t => [t.name, t.light, Object.keys(t.answers)]), [['Tampered', 'stop', ['data', 'account']]], 'light worked out again, unknown answers dropped');
    eq(c.incidents, [{text: 'line one line two'}], 'control characters removed');
    eq(c.connections, [], 'unknown approval dropped');
    eq(c.sweep.found, ['A'], 'only real names kept');
    eq(c.unreadable, 5, 'the check-in says entries were left out');
    ok(PU.summary(c).includes("5 entries couldn't be restored"), 'and its summary says so');
    eq(PU.reminderStart('2027-01-31'), '2027-01-28', 'reminder day');
    eq(PU.restore(JSON.parse(JSON.stringify(r.log))).log.checkins[0].unreadable, 5, 'the note survives a second backup and restore');
    eq(r.dropped, 6, 'dropped count: bad date, unknown card, empty incident, unknown approval, two bad names');
  });

  /* ---------- carry-over ---------- */
  test('carry-over: finds with dates, the incident log, and the review history', () => {
    const c = PU.carryOver(danaYear(), '2026-12-01');
    eq(c.finds.map(f => [f.id, f.name, f.found_by, f.found_on]), [
      ['pulse-001', 'Otter.ai', 'pulse_statement', '2026-10-02'],
      ['pulse-002', 'Copilot in Outlook', 'pulse_new_tool', '2026-11-03'],
      ['pulse-003', 'Zapier invoices', 'pulse_connection', '2026-12-01'],
    ], 'finds');
    eq(c.reviews.map(r => r.date), ['2026-10-02', '2026-11-03', '2026-12-01'], 'review dates');
    eq(c.incidents.length, 1, 'incidents');
    eq(c.rules_version, RULES.version, 'rules version');
  });

  test('printable card: twelve months across the year end', () => {
    const m = PU.monthsFrom('2026-10-15', 12);
    eq([m[0], m[2], m[3], m[11]], ['October 2026', 'December 2026', 'January 2027', 'September 2027'], 'months');
  });

  /* ---------- joined or left (FIXES 1.2) ---------- */
  test('joined or left: accounts not yet changed is a check, done is go, and it shows in the summary, CSV and worst light', () => {
    eq(['yes', 'no', 'not_sure'].map(a => PU.peopleRule(a).light), ['go', 'check', 'check'], 'lights');
    ok(PULSE.questions.people.accounts.every(o => PU.peopleRule(o.id) && PU.peopleRule(o.id).fix), 'every answer has a rule');
    const c = checkin('2027-01-04', {people: {answer: 'yes', accounts: 'no', light: 'check'}});
    eq(PU.worst(c), 'check', 'worst light');
    ok(PU.summary(c).includes('someone joined or left, accounts to update'), 'summary');
    const log = PU.emptyLog(); log.checkins.push(c);
    ok(PU.csv(log).includes('joined or left'), 'CSV row');
    eq(PU.worst(checkin('2027-01-04', {people: {answer: 'no'}})), 'go', 'nobody joined or left');
    ok(PULSE.print_card.questions.some(q => /join or leave/.test(q)), 'on the printable card');
  });
  test('joined or left: restore keeps a valid answer, works the light out again, and drops junk', () => {
    const log = PU.emptyLog();
    log.checkins.push(checkin('2027-01-04', {people: {answer: 'yes', accounts: 'yes', light: 'stop'}}));
    log.checkins.push(checkin('2027-02-01', {people: {answer: 'yes', accounts: 'maybe'}}));
    log.checkins.push(checkin('2027-03-01'));
    const r = PU.restore(JSON.parse(JSON.stringify(log)), ctx);
    eq(r.log.checkins.map(c => c.people || null), [{answer: 'yes', accounts: 'yes', light: 'go'}, null, null], 'restored');
    eq(r.dropped, 1, 'junk counted');
  });

  const failed = results.filter(r => r.fails.length);
  return {results, failed, summary: `${results.length - failed.length} of ${results.length} pulse tests passed`};
})();
