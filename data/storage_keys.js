/* Everything this site saves in the browser, by key. The privacy page lists
   these, and Delete everything names them as it removes them.
   Delete everything removes every key that starts with PREFIX, so a key
   missing from this list would still be deleted; the privacy test checks
   that every key the code writes is listed here too.
   area: 'local' is kept until deleted (localStorage); 'session' lasts until
   the tab is closed (sessionStorage). */
var STORAGE_KEYS = {
  version: '2026-10-03',
  prefix: 'sb-ai-playbook:',
  keys: [
    {key: 'profile',        area: 'local',   tool: 'Step 0, the quick check, Your business', what: 'Your answers about your business: size, how you use AI, industry'},
    {key: 'done',           area: 'local',   tool: 'The playbook', what: 'Which steps you marked done'},
    {key: 'answers',        area: 'local',   tool: 'The playbook', what: 'What you wrote under Done when you can answer'},
    {key: 'view',           area: 'session', tool: 'The playbook', what: 'Which steps were open, so a reload keeps your place'},
    {key: 'quick',          area: 'local',   tool: 'Quick check', what: 'Your quick check result, saved when you finish it'},
    {key: 'quick-other',    area: 'session', tool: 'Quick check', what: 'What you typed under Something else'},
    {key: 'ai-list',        area: 'local',   tool: 'AI list', what: 'Your AI list: each tool, your answers about it and its to-dos'},
    {key: 'tool-saved',     area: 'session', tool: 'AI list', what: 'Which checks were saved in this tab, so Back does not save one twice'},
    {key: 'risk',           area: 'local',   tool: 'Risk overview', what: 'Risks you added, your responses and snapshots'},
    {key: 'policy',         area: 'local',   tool: 'AI policy', what: 'Your AI policy, saved when it is ready'},
    {key: 'policy-draft',   area: 'session', tool: 'AI policy', what: 'The policy you are working on'},
    {key: 'pulse',          area: 'local',   tool: 'Monthly check-in', what: 'Your check-ins'},
    {key: 'pulse-calendar', area: 'local',   tool: 'Monthly check-in', what: 'The date you added the calendar reminder'},
    {key: 'record',         area: 'local',   tool: 'Record', what: 'The business name, controls you confirmed, and the sign-off'},
  ],
};
