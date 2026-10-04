/* The two ways through the site, in order: the essentials (the quick-win
   order: describe the business, quick check, policy, one tool, a reminder)
   and the full playbook (steps 0 to 9, then the risk overview and the
   record). Data, not logic: progress_engine.js works out what is done from
   what the tools already saved, and saves nothing itself.
   Step titles must match the playbook (tested). */

var PROGRESS = {
  version: '2026-10-04',

  essentials: {
    title: `The essentials`,
    time: `under an hour`,
    intro: `Five things that cover the most common risks, in the order that gives the most protection soonest.`,
    stages: [
      {id: 'business', label: `Describe your business`, time: `under a minute`, href: 'profile.html',
       cta: `Answer three questions`,
       todo: `Three questions about your team, how you use AI and your industry. Every tool starts from the answers.`},
      {id: 'quick', label: `Do the quick check`, time: `about 10 minutes`, href: 'quick_check.html',
       cta: `Start the quick check`,
       todo: `Six red-flag questions, then the tasks you use AI for. Choose Save in this browser at the end, so this page can see it.`},
      {id: 'policy', label: `Write your AI policy`, time: `8 to 10 minutes`, href: 'quick_policy.html',
       cta: `Start my AI policy`,
       todo: `A one-page policy to share with staff, built from your answers. Choose Save in this browser at the end.`},
      {id: 'tool', label: `Check the tool you use most`, time: `5 to 15 minutes`, href: 'tool_check.html',
       cta: `Open my AI list`,
       todo: `Its settings, its supplier, and what goes into it. The tool then has its own to-do list.`,
       todo_found: `Your quick check found tasks to look at. Start with the tool you use most.`},
      {id: 'reminder', label: `Set a monthly reminder`, time: `1 minute`, href: 'quick_pulse.html',
       cta: `Set the reminder`,
       todo: `Add a monthly reminder to your calendar, or do your first one-minute check-in.`},
    ],
  },

  full: {
    title: `The full playbook`,
    intro: `The nine steps, each marked done on the playbook, and the two tools that pull the work together.`,
    step_note: `Read what to do, then mark the step done on the playbook when you can answer its questions.`,
    after_essentials: `The essentials are done. The full playbook goes further, one step at a time.`,
    steps: [
      {n: 0, title: `Describe your business`, helps: [{href: 'profile.html', label: `Your business`}]},
      {n: 1, title: `Appoint an AI lead`, helps: [{href: 'policy-ai-lead.html', label: `AI lead role description`}]},
      {n: 2, title: `List the AI tools in use`, helps: [{href: 'quick_check.html', label: `Quick check`}, {href: 'tool_check.html', label: `AI list`}]},
      {n: 3, title: `Write an AI policy`, helps: [{href: 'quick_policy.html', label: `AI policy`}]},
      {n: 4, title: `Protect sensitive information`, helps: [{href: 'guide-data.html', label: `Guide`}]},
      {n: 5, title: `Evaluate AI suppliers`, helps: [{href: 'policy-supplier-questions.html', label: `Supplier questions`}]},
      {n: 6, title: `Check AI output before use`, helps: [{href: 'policy-human-review.html', label: `Checking AI-assisted work`}]},
      {n: 7, title: `Limit what AI can do without approval`, helps: [{href: 'policy-connected-ai.html', label: `Rules for AI that can act`}]},
      {n: 8, title: `Prepare for incidents`, helps: [{href: 'policy-incident-response.html', label: `Incident plan`}]},
      {n: 9, title: `Hold a quarterly review`, helps: [{href: 'quick_pulse.html', label: `Monthly check-in`}, {href: 'policy-quarterly-review.html', label: `Review checklist`}]},
    ],
    tools: [
      {id: 'risk', label: `Save a risk snapshot`, href: 'risk_matrix.html', cta: `Open the risk overview`,
       todo: `All your AI risks on one grid. Save a snapshot at each quarterly review.`},
      {id: 'record', label: `Make your record`, href: 'record.html', cta: `Open the record`,
       todo: `One document, assembled from your answers, to show an insurer, a customer or your bank. Print it or download Word to make a copy.`},
    ],
  },

  /* when everything is done */
  all_done: {label: `Keep it current`, href: 'quick_pulse.html', cta: `Open the monthly check-in`,
    todo: `Everything is in place. A one-minute check-in each month, and a review each quarter, keep it that way.`},
};
