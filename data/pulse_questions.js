/* F. Monthly pulse: questions and wording. Data only; pulse_engine.js
   decides what is asked and what each answer means.
   Design: exploratory/quick_questionnaires/06_monthly_pulse.md

   New tools reuse the tap-what-you-do cards and rules from B
   (data/questions.js, data/rules.js), so a tool added here gets the same
   light it would get in the quick check. */

var PULSE = {
  version: '2026.10.1-pulse',
  last_reviewed: '2026-10-03',
  sweep_every_months: 3,
  due_after_days: 30,
  overdue_after_days: 45,
  backup_every_days: 90,

  questions: {
    new_tool: {
      text: `Did you start using any new AI tool or feature this month?`,
      hint: `Including AI switched on in software you already use.`,
      name_label: `What is it called?`,
      name_placeholder: `For example: AI summaries in our booking software`,
      card_text: `What is it for?`,
    },
    incident: {
      text: `Did anything go wrong, or feel wrong, with AI this month?`,
      hint: `Incorrect information sent out, something pasted into the wrong tool, an unexpected result, or a scam that used AI. Near misses count.`,
      text_label: `What happened, in one line?`,
      text_placeholder: `For example: pasted a client's email into the free ChatGPT by mistake`,
    },
    connection: {
      text: `Was any AI tool connected to email, files, accounts or payments?`,
      hint: `Such as an assistant given access to your inbox, or an automation with an AI step.`,
      name_label: `Which tool, and what was it connected to?`,
      name_placeholder: `For example: Copilot connected to our shared drive`,
      approval_text: `Does a person have to approve before it sends, pays or deletes anything?`,
      approval: [
        {id: 'all',      label: `Yes, every time`},
        {id: 'some',     label: `For some things`},
        {id: 'none',     label: `No`},
        {id: 'not_sure', label: `Not sure`},
      ],
    },
    /* not asked when the profile says the business is one person */
    people: {
      text: `Did anyone join or leave the business this month?`,
      hint: `Staff, contractors, or anyone else who uses AI for the business.`,
      accounts_text: `Were their AI accounts added or removed?`,
      accounts: [
        {id: 'yes',      label: `Yes`},
        {id: 'no',       label: `Not yet`},
        {id: 'not_sure', label: `Not sure`},
      ],
    },
    sweep: {
      text: `Check your card or bank statement for AI subscriptions. Is anything new?`,
      hint: `Every third month. This is the quickest way to find AI that nobody mentioned.`,
      names_label: `Look for names like these`,
      found_label: `What did you find? Separate names with commas.`,
      answers: [
        {id: 'yes',       label: `Yes, something new`},
        {id: 'no',        label: `Nothing new`},
        {id: 'not_looked', label: `I will check later`},
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
    none:     {light: 'stop',  reason: `It can send, pay or delete without anyone approving.`,
               fix: `Turn on approval before it sends, pays or deletes anything, or disconnect it.`},
    not_sure: {light: 'check', reason: `Not sure whether it needs approval.`,
               fix: `Look in its settings for automatic actions, and whether each needs approval.`},
  },
  connection_how: {href: 'playbook.html#step-7', label: `Step 7: Limit what AI can do without approval`},

  /* what the answer about people joining or leaving means */
  people_rules: {
    yes:      {light: 'go',    reason: `Their AI accounts were added or removed.`,
               fix: `Keep doing this each time someone joins or leaves.`},
    no:       {light: 'check', reason: `Someone joined or left, and their AI accounts have not been changed yet.`,
               fix: `Remove the AI accounts of anyone who left, and transfer anything they own. Give anyone new a business account, with two-step sign-in turned on.`},
    not_sure: {light: 'check', reason: `Someone joined or left, and you are not sure about their AI accounts.`,
               fix: `Check each AI tool's list of users. Remove anyone who left, and transfer anything they own.`},
  },
  people_how: {href: 'playbook.html#step-4', label: `Step 4: Protect sensitive information`},

  incident_card: {
    title: `If something went wrong`,
    steps: [
      `Stop using the tool for that task until you know what happened.`,
      `Delete what went in, where you can: the chat, the upload, any shared link.`,
      `If a password or code went in, change it now.`,
      `If personal information went in, or incorrect information reached someone, decide whether anyone must be notified. Ask for advice if you are not sure.`,
      `Record what happened and what you changed. This log serves that purpose.`,
    ],
    how: {href: 'policy-incident-response.html', label: `Incident response template`},
  },

  calendar: {
    summary: `AI check-in (1 minute)`,
    description: `New AI tools, problems with AI, AI connected to email, files, accounts or payments, and, for a team, AI accounts for anyone who joined or left.`,
  },

  print_card: {
    title: `Monthly AI check-in`,
    questions: [
      `Did you start using any new AI tool or feature this month?`,
      `Did anything go wrong, or feel wrong, with AI this month?`,
      `Was any AI tool connected to email, files, accounts or payments?`,
      `Did anyone join or leave? Were their AI accounts added or removed?`,
    ],
    sweep_note: `Every third month: check your card statement for AI subscriptions.`,
    after: `If any answer is yes, open the check-in page and record it.`,
  },
};
