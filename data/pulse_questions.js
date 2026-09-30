/* F. Monthly pulse: questions and wording. Data only; pulse_engine.js
   decides what is asked and what each answer means.
   Design: exploratory/quick_questionnaires/06_monthly_pulse.md

   New tools reuse the tap-what-you-do cards and rules from B
   (data/questions.js, data/rules.js), so a tool added here gets the same
   light it would get in the quick check. */

var PULSE = {
  version: '2026.09.1-pulse',
  last_reviewed: '2026-09-29',
  sweep_every_months: 3,
  due_after_days: 30,
  overdue_after_days: 45,
  backup_every_days: 90,

  questions: {
    new_tool: {
      text: `Did you start using any new AI tool or feature this month?`,
      hint: `Including AI switched on in software you already use.`,
      name_label: `What's it called?`,
      name_placeholder: `For example: AI summaries in our booking software`,
      card_text: `What is it for?`,
    },
    incident: {
      text: `Did anything go wrong, or feel wrong, with AI this month?`,
      hint: `Wrong information sent out, something pasted into the wrong tool, a strange result, a scam that used AI. Near-misses count.`,
      text_label: `What happened, in one line?`,
      text_placeholder: `For example: pasted a client's email into the free ChatGPT by mistake`,
    },
    connection: {
      text: `Did any AI tool get connected to email, files, accounts or payments?`,
      hint: `Such as an assistant given access to your inbox, or an automation with an AI step.`,
      name_label: `Which tool, and what was it connected to?`,
      name_placeholder: `For example: Copilot connected to our shared drive`,
      approval_text: `Does it need a person to approve before it sends, pays or deletes anything?`,
      approval: [
        {id: 'all',      label: `Yes, every time`},
        {id: 'some',     label: `For some things`},
        {id: 'none',     label: `No`},
        {id: 'not_sure', label: `Not sure`},
      ],
    },
    sweep: {
      text: `Look at your card or bank statement for AI subscriptions. Anything new?`,
      hint: `Every third month. It's the quickest way to find AI nobody mentioned.`,
      names_label: `Look for names like these`,
      found_label: `What did you find? Separate names with commas.`,
      answers: [
        {id: 'yes',       label: `Yes, something new`},
        {id: 'no',        label: `Nothing new`},
        {id: 'not_looked', label: `I'll look later`},
      ],
    },
  },

  /* names that often appear on statements; illustrative, not an endorsement */
  statement_names: [`OpenAI`, `ChatGPT`, `Anthropic`, `Claude`, `Microsoft 365 Copilot`, `Google Workspace`, `Gemini`, `Grammarly`, `Otter.ai`, `Fireflies`, `Jasper`, `Midjourney`, `Canva`, `Notion`, `Perplexity`, `Zapier`],

  yes_no: [
    {id: 'yes', label: `Yes`},
    {id: 'no',  label: `No`},
  ],

  /* what a newly connected tool's approval answer means. Same logic as the
     tool check: acting with no approval is a red line. */
  connection_rules: {
    all:      {light: 'go',    reason: `A person approves before it sends, pays or deletes.`,
               fix: `Keep it that way, and limit it to the folders and accounts it needs.`},
    some:     {light: 'check', reason: `Only some actions need approval.`,
               fix: `List which actions need approval, and make sure sending, paying and deleting are on that list.`},
    none:     {light: 'stop',  reason: `It can send, pay or delete with nobody approving.`,
               fix: `Turn on approval before it sends, pays or deletes anything, or disconnect it.`},
    not_sure: {light: 'check', reason: `Not sure whether it needs approval.`,
               fix: `Look in its settings for automatic actions, and whether each needs approval.`},
  },
  connection_how: {href: 'playbook.html#step-7', label: `Step 7: Limit what AI can do on its own`},

  incident_card: {
    title: `If something went wrong`,
    steps: [
      `Stop using the tool for that task until you know what happened.`,
      `Delete what went in, where you can: the chat, the upload, any shared link.`,
      `If a password or code went in, change it now.`,
      `If personal information went in or wrong information reached someone, decide whether anyone needs to be told. Ask for advice if you're not sure.`,
      `Write down what happened and what you changed. This log does that.`,
    ],
    how: {href: 'policy-incident-response.html', label: `Incident response template`},
  },

  calendar: {
    summary: `AI check-in (1 minute)`,
    description: `Three questions: any new AI tools, anything go wrong, anything connected to email, files, accounts or payments.`,
  },

  print_card: {
    title: `Monthly AI check-in`,
    questions: [
      `Did you start using any new AI tool or feature this month?`,
      `Did anything go wrong, or feel wrong, with AI this month?`,
      `Did any AI tool get connected to email, files, accounts or payments?`,
    ],
    sweep_note: `Every third month: check your card statement for AI subscriptions.`,
    after: `Any yes? Open the check-in page and record it.`,
  },
};
