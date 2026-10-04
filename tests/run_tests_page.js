/* Draws the results of every test run on tests/run_tests.html. */
const runs = [TestRun, PolicyTestRun, PulseTestRun, ProfileTestRun, ToolTestRun, RiskTestRun, AnswersTestRun, RecordTestRun, PrivacyTestRun, IndustryTestRun, ProgressTestRun];
document.getElementById('summary').textContent = runs.map(r => r.summary).join(' \u00b7 ');
const esc = s => String(s).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]);
document.getElementById('out').innerHTML = runs.flatMap(x => x.results).map(r =>
  `<div class="t${r.fails.length ? ' fail' : ''}"><b>${r.fails.length ? 'FAIL' : 'OK'}</b>${esc(r.name)}` +
  (r.fails.length ? `<ul>${r.fails.slice(0, 12).map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '') + `</div>`).join('');
