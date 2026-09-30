/* The full tool check: questions. Data only; tool_engine.js decides what's
   shown and data/tool_rules.js decides what answers mean.
   Design: exploratory/feature_concepts/02_tool_check.md

   The unit checked is a use: tool + plan + what it's for. Later questions
   only appear when earlier answers make them relevant (show_if). Conditions
   can also read the profile: _industry, _team, _path, and _mode (new or
   discovered). A condition on a list answer is true if any item matches;
   {not: ...} negates. */

var TOOL_QUESTIONS = {
  version: '2026.09.1-tool',
  last_reviewed: '2026-09-29',

  data_classes: [
    {id: 'public',    label: `public information`},
    {id: 'internal',  label: `internal business information`},
    {id: 'personal',  label: `names and contact details`},
    {id: 'sensitive', label: `sensitive personal information`},
    {id: 'regulated', label: `client-confidential or regulated information`},
  ],

  steps: [`What is it?`, `What goes in?`, `The supplier`, `Where the output goes`, `What it can do`, `Things you set up`, `What's already happened`],

  questions: [
    /* ---------- 1. what is it ---------- */
    {id: 'mode', step: 0, kind: 'one',
     text: `Is this a tool you want to start using, or one that's already in use?`,
     options: [
       {id: 'new',        label: `We want to start using it`, detail: `Check it before anyone starts`},
       {id: 'discovered', label: `We found it already in use`, detail: `No blame. Let's make it safe to keep using`},
     ]},
    {id: 'tool', step: 0, kind: 'text', text: `What's the tool called?`,
     placeholder: `For example: ChatGPT, or the AI notes in our booking software`},
    {id: 'plan', step: 0, kind: 'one', text: `Which plan or account is it on?`,
     hint: `What matters is the type of plan, not who pays for it. A personal plan paid for by the business still counts as personal.`,
     options: [
       {id: 'free_personal', label: `A free personal account`},
       {id: 'paid_personal', label: `A paid personal account`},
       {id: 'business',      label: `A business or team plan`},
       {id: 'enterprise',    label: `An enterprise plan`},
       {id: 'built_in',      label: `It came built into software we already pay for`},
       {id: 'own',           label: `Something we set up ourselves`, detail: `A custom assistant, or an automation with an AI step`,
        show_if: {q: '_path', in: ['configure', 'build']}},
       {id: 'dont_know',     label: `Don't know`},
     ]},
    {id: 'extension', step: 0, kind: 'one', text: `Is it a browser add-on, extension or plugin?`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}]},
    {id: 'use', step: 0, kind: 'one', text: `What's it for?`,
     hint: `If it's used for more than one thing, pick one now. You can add another use afterwards.`,
     options: [
       {id: 'writing',     label: `Writing and editing`},
       {id: 'research',    label: `Research and searching`},
       {id: 'summarizing', label: `Summarizing documents`},
       {id: 'meetings',    label: `Meeting notes, transcripts or calls`},
       {id: 'customers',   label: `Answering customers`, detail: `Chat, email or phone`},
       {id: 'marketing',   label: `Marketing images or content`},
       {id: 'finance',     label: `Bookkeeping or finance`},
       {id: 'scheduling',  label: `Scheduling or handling email`},
       {id: 'data',        label: `Analysing data or spreadsheets`},
       {id: 'coding',      label: `Coding or building a website`},
       {id: 'hiring',      label: `Helping decide about a person`, detail: `Hiring, credit, eligibility`},
       {id: 'other',       label: `Something else`},
     ]},
    {id: 'direct', step: 0, kind: 'one', text: `Do customers talk to the AI directly?`,
     hint: `A chatbot, or a voice assistant that answers the phone.`,
     show_if: {q: 'use', in: ['customers']},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No, it drafts and a person sends`}]},
    {id: 'records', step: 0, kind: 'one', text: `Does it record, transcribe or summarize people talking?`,
     show_if: {any: [{q: 'direct', in: ['yes']}, {q: 'use', in: ['other', 'scheduling']}]},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},

    /* ---------- 2. what goes in ---------- */
    {id: 'data', step: 1, kind: 'many', text: `What goes into it?`, hint: `Tick everything that does, even occasionally.`,
     exclusive: ['dont_know'],
     options: [
       {id: 'public',    label: `Public information, or nothing sensitive`},
       {id: 'internal',  label: `Internal business information`, detail: `Plans, prices, documents with no personal details`},
       {id: 'personal',  label: `Names and contact details of customers or staff`},
       {id: 'sensitive', label: `Sensitive personal information`, detail: `Health, money or account details, ID numbers, anything about children`},
       {id: 'regulated', label: `Client-confidential or regulated information`, detail: `Legal matters, tax returns, government contract information`},
       {id: 'secrets',   label: `Passwords, security codes or payment card numbers`},
       {id: 'dont_know', label: `Not sure what goes in`},
     ]},
    /* one industry question, worded for the first industry in the profile */
    {id: 'special', step: 1, kind: 'one',
     show_if: {all: [
       {q: '_industry', in: ['healthcare', 'finance', 'defense', 'education', 'professional', 'creative']},
       {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'dont_know']},
     ]},
     text_by_industry: {
       healthcare:   `Does patient information go in?`,
       finance:      `Does client financial information go in?`,
       defense:      `Does government contract information (CUI) go in, in a tool not approved for CUI?`,
       education:    `Does information about a named child go in?`,
       professional: `Does client-confidential material go in?`,
       creative:     `Does unreleased or embargoed client work go in?`,
     },
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},

    /* ---------- 3. the supplier ---------- */
    {id: 'training', step: 2, kind: 'one', evidence: true,
     show_if: {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']},
     text: `Does your plan use what you put in to train its AI?`,
     options: [
       {id: 'no_checked', label: `No, and we've checked the setting or the terms`},
       {id: 'yes',        label: `Yes`},
       {id: 'dont_know',  label: `Don't know`},
     ]},
    {id: 'deletion', step: 2, kind: 'one', evidence: true,
     show_if: {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']},
     text: `Can you delete what you've put in?`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},
    {id: 'agreement', step: 2, kind: 'one', evidence: true,
     show_if: {any: [{q: 'data', in: ['personal', 'sensitive', 'regulated']}, {q: 'special', in: ['yes']}]},
     text: `Is there a data agreement with the supplier that covers this?`,
     text_by_industry: {healthcare: `Is there a business associate agreement (BAA) that covers this AI feature?`},
     hint: `A data processing addendum or confidentiality agreement. A BAA for healthcare.`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},
    {id: 'published', step: 2, kind: 'one', evidence: true,
     show_if: {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']},
     text: `Does the supplier publish how it handles your data?`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},

    /* ---------- 4. where the output goes ---------- */
    {id: 'output', step: 3, kind: 'many', text: `Where does what it produces go?`,
     options: [
       {id: 'internal',  label: `Only us, inside the business`},
       {id: 'customers', label: `Customers or the public`},
       {id: 'person',    label: `It helps decide something about a person`, detail: `A job, money, housing, health, education`},
     ]},
    {id: 'person_decides', step: 3, kind: 'one', text: `Does a person make the final decision, every time?`,
     show_if: {any: [{q: 'output', in: ['person']}, {q: 'use', in: ['hiring']}]},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},
    {id: 'nyc_co', step: 3, kind: 'one', text: `Do you hire in New York City or Colorado?`,
     hint: `Both have their own rules for AI used in hiring and other decisions about people.`,
     show_if: {any: [{q: 'output', in: ['person']}, {q: 'use', in: ['hiring']}]},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},
    {id: 'safety', step: 3, kind: 'one', text: `Is any of its output safety-relevant?`,
     hint: `Estimates, load calculations, safety checks, specifications.`,
     show_if: {q: '_industry', in: ['trades']},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}]},
    {id: 'qualified', step: 3, kind: 'one', text: `Does a qualified person check it before it's used?`,
     show_if: {q: 'safety', in: ['yes']},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Don't know`}]},

    /* ---------- 5. what it can do ---------- */
    {id: 'acts', step: 4, kind: 'many', text: `What can it do on its own?`, exclusive: ['produces_only'],
     options: [
       {id: 'produces_only', label: `Only produces text or images for us to use`},
       {id: 'reads',         label: `It can read our email, files, calendar or other accounts`},
       {id: 'acts',          label: `It can send, post, book, buy, pay, delete or change things`},
     ]},
    {id: 'approval', step: 4, kind: 'one', text: `Which of those actions need a person to approve them every time?`,
     show_if: {q: 'acts', in: ['acts']},
     options: [
       {id: 'all',       label: `All of them`},
       {id: 'some',      label: `Some of them`},
       {id: 'none',      label: `None`},
       {id: 'dont_know', label: `Don't know`},
     ]},

    /* ---------- 6. things you set up yourself ---------- */
    {id: 'own_access', step: 5, kind: 'one', text: `Who can use it?`, show_if: {q: 'plan', in: ['own']},
     options: [
       {id: 'me',     label: `Just me`},
       {id: 'team',   label: `Our team`},
       {id: 'public', label: `Anyone with the link, or the public`},
     ]},
    {id: 'own_docs', step: 5, kind: 'one', text: `What did you give it to read?`, show_if: {q: 'plan', in: ['own']},
     options: [
       {id: 'none',         label: `Nothing`},
       {id: 'internal',     label: `Public or internal documents`},
       {id: 'confidential', label: `Documents with personal or confidential information`},
     ]},
    {id: 'own_tested', step: 5, kind: 'one', text: `Have you tried to make it misbehave before sharing it?`,
     hint: `Asked it to reveal its instructions, ignore its rules, or show other people's information.`,
     show_if: {q: 'plan', in: ['own']},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}]},

    /* ---------- 7. discovered tools only ---------- */
    {id: 'already_in', step: 6, kind: 'many', text: `What has already gone into it?`, exclusive: ['nothing_sensitive', 'dont_know'],
     show_if: {q: '_mode', in: ['discovered']},
     options: [
       {id: 'nothing_sensitive', label: `Nothing sensitive`},
       {id: 'personal',          label: `Customer or staff details`},
       {id: 'sensitive',         label: `Sensitive or client-confidential information`},
       {id: 'secrets',           label: `Passwords, codes or card numbers`},
       {id: 'dont_know',         label: `Don't know`},
     ]},
  ],

  /* Where supplier settings usually live. Deliberately general: vendor
     settings change, and specific directions must come from the vendor's
     current pages, with a date. `tools` is left empty until those are
     checked (exploratory/handoff_website_development.md, section 11). */
  where_to_look: {
    general: [
      `In the tool's own settings, under Data, Privacy or Data controls.`,
      `On a business plan, in the admin console rather than your own settings.`,
      `On the supplier's trust, privacy or security page, and in the terms for your plan.`,
      `If you still can't tell, ask the supplier in writing and keep the reply.`,
    ],
    tools: {},
    verified: false,
  },

  events: [
    {id: 'terms',      label: `The supplier changed its terms, plan or pricing`},
    {id: 'feature',    label: `The tool gained a new AI feature`},
    {id: 'new_use',    label: `We started using it for something new, or with different information`},
    {id: 'connected',  label: `We connected it to something: email, files, accounts or another tool`},
    {id: 'incident',   label: `Something went wrong`},
    {id: 'owner_left', label: `The person responsible for it left`},
  ],

  retire_checklist: [
    `Cancel the subscription, and check the card statement next month.`,
    `Remove its access: disconnect it from email, files and accounts (connected apps in Google or Microsoft account settings).`,
    `Download anything you need to keep, then delete your data and chat history in the tool.`,
    `Remove shared links and anything you set up in it (custom assistants, automations).`,
    `Mark it retired on the AI list, with the date.`,
  ],
};
