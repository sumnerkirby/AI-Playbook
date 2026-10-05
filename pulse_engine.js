/* F. Monthly pulse: pure functions over the check-in log, with no DOM, so
   the page and the tests run the same code.
   Needs, loaded first: data/profile_options.js, data/questions.js,
   data/rules.js, quick_engine.js, data/pulse_questions.js.

   The log (kept in this browser, with backup and restore):
     {version: 1, industry, last_backup, checkins: [
       {date, pulse_version, rules_version,
        new_tools:   [{name, card, answers, light, reasons}],
        incidents:   [{text}],
        connections: [{name, approval, light}],
        people:      undefined (not asked) | {answer: yes|no, accounts: yes|no|not_sure, light},
        sweep:       undefined (not due) | {answer: yes|no|not_looked, found: [names]}}]}
   An empty list means the answer was no: "no, no, no" is still a dated
   check-in, which is the point. */

var PulseEngine = (function(){
  const P = PULSE;
  const RANK = {go: 0, check: 1, stop: 2};

  /* ---------- dates (ISO strings, no time zones) ---------- */
  const iso = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
  function monthsBetween(a, b){
    const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }
  function addMonths(s, n){
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, last));
    return t.toISOString().slice(0, 10);
  }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(s){ if (!iso(s)) return ''; const [y, m, d] = s.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; }
  function monthsFrom(s, n){
    const [y, m] = s.split('-').map(Number);
    return Array.from({length: n}, (_, i) => { const k = m - 1 + i; return `${MONTHS[k % 12]} ${y + Math.floor(k / 12)}`; });
  }

  /* ---------- the log ---------- */
  const emptyLog = () => ({version: 1, industry: null, last_backup: null, checkins: []});
  const sorted = log => log.checkins.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  function last(log){ const s = sorted(log); return s.length ? s[s.length - 1] : null; }

  /* where things stand today */
  function status(log, today){
    const l = last(log);
    if (!l) return {state: 'none', days: null, last: null, next: today};
    const days = daysBetween(l.date, today);
    return {
      state: days >= P.overdue_after_days ? 'overdue' : days >= P.due_after_days ? 'due' : 'done',
      days, last: l.date, next: addMonths(l.date, 1),
    };
  }
  /* the card-statement sweep: on the first check-in, then every third
     month after the last time someone actually looked */
  function sweepDue(log, today){
    const looked = log.checkins.filter(c => c.sweep && (c.sweep.answer === 'yes' || c.sweep.answer === 'no')).map(c => c.date).sort();
    if (!looked.length) return true;
    return monthsBetween(looked[looked.length - 1], today) >= P.sweep_every_months;
  }
  function backupDue(log, today){
    if (log.checkins.length < 3) return false;
    return !log.last_backup || daysBetween(log.last_backup, today) >= P.backup_every_days;
  }

  /* ---------- lights ---------- */
  function toolLight(card, answers, ctx){
    const r = QuickEngine.evaluateCard(card, answers, ctx);
    return {light: r.light, reasons: r.hits.map(h => h.id)};
  }
  function connectionRule(approval){ return P.connection_rules[approval] || null; }
  function peopleRule(accounts){ return P.people_rules[accounts] || null; }
  function newCheckin(today){
    return {date: today, pulse_version: P.version, rules_version: RULES.version, new_tools: [], incidents: [], connections: []};
  }
  /* a reported problem always needs a look, so it counts as check */
  function worst(c){
    const lights = c.new_tools.map(t => t.light).concat(c.connections.map(x => x.light), c.people && c.people.light ? [c.people.light] : [],
      c.incidents.length ? ['check'] : []);
    return lights.reduce((w, l) => RANK[l] > RANK[w] ? l : w, 'go');
  }
  function summary(c){
    const parts = [];
    parts.push(c.new_tools.length ? `${c.new_tools.length} new tool${c.new_tools.length > 1 ? 's' : ''}` : 'no new tools');
    parts.push(c.incidents.length ? `${c.incidents.length} thing${c.incidents.length > 1 ? 's' : ''} went wrong` : 'nothing went wrong');
    parts.push(c.connections.length ? `${c.connections.length} new connection${c.connections.length > 1 ? 's' : ''}` : 'no new connections');
    if (c.people && c.people.answer === 'yes') parts.push(c.people.accounts === 'yes' ? 'someone joined or left, accounts updated' : 'someone joined or left, accounts to update');
    if (c.unreadable) parts.push(`${c.unreadable} ${c.unreadable === 1 ? 'entry' : 'entries'} could not be restored from a backup`);
    if (c.sweep) parts.push(c.sweep.answer === 'yes' ? `${c.sweep.found.length} found on the statement` : c.sweep.answer === 'no' ? 'statement checked' : 'statement not checked yet');
    return parts.join(', ');
  }

  /* everything the pulse has found, newest first */
  function aiList(log){
    const out = [];
    sorted(log).forEach(c => {
      c.new_tools.forEach(t => out.push({date: c.date, name: t.name, source: 'new_tool', card: t.card, light: t.light}));
      c.connections.forEach(x => out.push({date: c.date, name: x.name, source: 'connection', light: x.light}));
      if (c.sweep && c.sweep.answer === 'yes') c.sweep.found.forEach(n => out.push({date: c.date, name: n, source: 'statement', light: null}));
    });
    return out.reverse();
  }
  function incidents(log){
    return sorted(log).flatMap(c => c.incidents.map(i => ({date: c.date, text: i.text}))).reverse();
  }

  /* ---------- calendar file (RFC 5545), made in the browser ----------
     A monthly event that links back to this page. Days after the 28th
     move to the 28th so no month is skipped. */
  function icsText(s){ return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line){
    const out = [];
    let cur = '', bytes = 0;
    for (const ch of line){
      const cp = ch.codePointAt(0);
      const b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;   // UTF-8 bytes
      if (bytes + b > (out.length ? 74 : 75)){ out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function reminderStart(s){
    const [y, m, d] = s.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, 28)).padStart(2, '0')}`;
  }
  function ics(opts){
    const start = reminderStart(opts.start).replace(/-/g, '') + 'T090000';
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AI Playbook for small businesses//Monthly AI check-in//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:ai-check-in-${start}@ai-playbook.local`,
      `DTSTAMP:${opts.stamp}`,
      `DTSTART:${start}`,
      'DURATION:PT10M',
      'RRULE:FREQ=MONTHLY',
      `SUMMARY:${icsText(P.calendar.summary)}`,
      `DESCRIPTION:${icsText(P.calendar.description + (opts.url ? ' Open: ' + opts.url : ''))}`,
      opts.url ? `URL:${opts.url}` : null,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(P.calendar.summary)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean);
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /* ---------- CSV, for a shared drive or spreadsheet ----------
     Cells that a spreadsheet would run as a formula get a leading
     apostrophe. */
  function cell(v){
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(log){
    const rows = [['date', 'kind', 'name', 'detail', 'light']];
    const label = id => { const c = QuickEngine.card(id); return c ? c.label : ''; };
    /* the words on screen, not the internal ids */
    const WORDS = {go: 'acceptable', check: 'needs a check', stop: 'stop'};
    const word = l => WORDS[l] || l || '';
    const opt = (list, id) => { const o = list.find(x => x.id === id); return o ? o.label : id; };
    const Qs = P.questions;
    sorted(log).forEach(c => {
      rows.push([c.date, 'check-in', '', summary(c), word(worst(c))]);
      c.new_tools.forEach(t => rows.push([c.date, 'new tool', t.name, label(t.card), word(t.light)]));
      c.incidents.forEach(i => rows.push([c.date, 'something went wrong', '', i.text, word('check')]));
      c.connections.forEach(x => rows.push([c.date, 'new connection', x.name, 'Approval before it acts: ' + opt(Qs.connection.approval, x.approval), word(x.light)]));
      if (c.people && c.people.answer === 'yes') rows.push([c.date, 'joined or left', '', 'AI accounts added or removed: ' + opt(Qs.people.accounts, c.people.accounts), word(c.people.light)]);
      if (c.sweep && c.sweep.answer === 'yes') c.sweep.found.forEach(n => rows.push([c.date, 'found on statement', n, '', 'to check']));
    });
    return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  /* ---------- restoring a backup: trust nothing in the file ---------- */
  function cleanText(s, max){ return typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200) : ''; }
  function restore(obj, ctx){
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.checkins)) throw new Error('This file is not a check-in backup.');
    const log = emptyLog();
    const industries = PROFILE_OPTIONS.industry.options.map(o => o.id);
    log.industry = industries.includes(obj.industry) ? obj.industry : null;
    log.last_backup = iso(obj.last_backup) ? obj.last_backup : null;
    let dropped = 0;
    obj.checkins.forEach(c => {
      if (!c || !iso(c.date)){ dropped++; return; }
      const out = newCheckin(c.date);
      const before = dropped;
      out.pulse_version = cleanText(c.pulse_version, 40) || P.version;
      out.rules_version = cleanText(c.rules_version, 40) || RULES.version;
      (Array.isArray(c.new_tools) ? c.new_tools : []).forEach(t => {
        const name = cleanText(t && t.name);
        if (!name || !QuickEngine.card(t.card)){ dropped++; return; }
        const answers = QuickEngine.pruneCard(t.card, Object.fromEntries(Object.entries(t.answers || {})
          .filter(([k, v]) => CARD_QUESTIONS[k] && CARD_QUESTIONS[k].answers.some(a => a.id === v))));
        /* lights are worked out again under today's rules, never taken from the file */
        out.new_tools.push(Object.assign({name, card: t.card, answers}, toolLight(t.card, answers, ctx || {industry: log.industry})));
      });
      (Array.isArray(c.incidents) ? c.incidents : []).forEach(i => { const text = cleanText(i && i.text, 300); if (text) out.incidents.push({text}); else dropped++; });
      (Array.isArray(c.connections) ? c.connections : []).forEach(x => {
        const name = cleanText(x && x.name), rule = connectionRule(x && x.approval);
        if (!name || !rule){ dropped++; return; }
        out.connections.push({name, approval: x.approval, light: rule.light});
      });
      if (c.people && c.people.answer === 'no') out.people = {answer: 'no'};
      else if (c.people && c.people.answer === 'yes'){
        const rule = peopleRule(c.people.accounts);
        if (rule) out.people = {answer: 'yes', accounts: c.people.accounts, light: rule.light}; else dropped++;
      }
      if (c.sweep && ['yes', 'no', 'not_looked'].includes(c.sweep.answer)){
        const raw = c.sweep.answer === 'yes' && Array.isArray(c.sweep.found) ? c.sweep.found : [];
        const found = raw.map(n => cleanText(n)).filter(Boolean);
        dropped += raw.length - found.length;
        out.sweep = {answer: c.sweep.answer, found};
      }
      const prior = Number.isInteger(c.unreadable) && c.unreadable > 0 ? Math.min(c.unreadable, 999) : 0;
      if (prior + dropped - before) out.unreadable = prior + dropped - before;
      log.checkins.push(out);
    });
    log.checkins = sorted(log);
    return {log, dropped};
  }

  /* ---------- carry-over into the full tools ----------
     New tools and statement finds become discovery finds with their dates;
     incidents go to the incident log; check-in dates are the review history
     the record's Reviews section needs. */
  function carryOver(log, today){
    const finds = [];
    sorted(log).forEach(c => {
      c.new_tools.forEach(t => finds.push({name: t.name, use: t.card, found_by: 'pulse_new_tool', found_on: c.date, quick_light: t.light, quick_reasons: t.reasons, status: 'to_check'}));
      c.connections.forEach(x => finds.push({name: x.name, found_by: 'pulse_connection', found_on: c.date, tags: {can_act: 'yes', approval: x.approval}, quick_light: x.light, status: 'to_check'}));
      if (c.sweep && c.sweep.answer === 'yes') c.sweep.found.forEach(n => finds.push({name: n, found_by: 'pulse_statement', found_on: c.date, status: 'to_check'}));
    });
    finds.forEach((f, i) => { f.id = 'pulse-' + String(i + 1).padStart(3, '0'); });
    return {
      kind: 'quick_pulse', pulse_version: P.version, rules_version: RULES.version, saved_on: today,
      finds,
      incidents: incidents(log).reverse(),
      reviews: sorted(log).map(c => ({date: c.date, kind: 'monthly_pulse', summary: summary(c)})),
    };
  }

  return {
    daysBetween, monthsBetween, addMonths, fmtDate, monthsFrom, reminderStart,
    emptyLog, sorted, last, status, sweepDue, backupDue,
    toolLight, connectionRule, peopleRule, newCheckin, worst, summary, aiList, incidents,
    ics, csv, restore, carryOver,
  };
})();
