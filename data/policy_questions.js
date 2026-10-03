/* D. Answers become the policy: questions, options, and every sentence the
   policy can contain. Data only; policy_engine.js chooses the sentences and
   fills them in. Design: exploratory/quick_questionnaires/04_answers_become_the_policy.md

   Sentences use {placeholders}. An empty placeholder becomes a highlighted
   blank ([Business name]) rather than disappearing, so an unfinished policy
   looks unfinished. Wording is plain and makes no legal commitments; legal
   points appear only as things to check with an advisor. */

var POLICY = {
  version: '2026.10.1-policy',
  last_reviewed: '2026-10-03',

  /* ---------- the questions, in order ---------- */
  questions: [
    {id: 'setup',     section: 'title',    text: `Before you start`},
    {id: 'business',  section: 'title',    text: `What is the name of your business?`,
     why: `It appears at the top of the page.`},
    {id: 'decider',   section: 'who',      text: `Who decides which AI tools can be used?`, team_only: true,
     why: `The most useful sentence in any AI policy says whom to ask.`},
    {id: 'tools',     section: 'tools',    text: `Which AI tools are approved for work?`,
     why: `Select the tools you use, or add your own. Mark each one as a business account or not yet.`},
    {id: 'never',     section: 'never',    text: `What must never go into any AI tool?`,
     why: `Be specific. The common items are already checked, along with any for your industry.`},
    {id: 'people_info', section: 'people', text: `What customer or staff information can go into AI tools?`,
     solo_text: `What client information can go into AI tools?`},
    {id: 'checks',    section: 'checking', text: `Which work must a person check before it goes out?`},
    {id: 'decisions', section: 'checking', text: `Is AI used to help make decisions about people?`,
     why: `Such as hiring, pay, or whether someone receives credit or a service.`},
    {id: 'acts',      section: 'acting',   text: `Can any AI tool act on its own: send, pay, book or delete?`},
    {id: 'telling',   section: 'telling',  text: `Do you tell customers when they are dealing with AI?`},
    {id: 'incident',  section: 'wrong',    text: `If something goes wrong, whom do people tell, and how quickly?`, team_only: true},
    {id: 'recording', section: 'recording', text: `Do calls or meetings get recorded or summarized by AI?`},
    {id: 'review',    section: 'review',   text: `When will you review this?`,
     why: `Every three months is a reasonable interval. Also review it whenever you add a new AI tool.`},
  ],

  team: [
    {id: 'solo', label: `Only me`, detail: `The result is a one-page set of your own rules and settings`},
    {id: 'team', label: `Me and a team`, detail: `The result is a one-page policy to share with staff`},
  ],

  /* common tools as quick picks; the owner can add any other */
  common_tools: [`ChatGPT`, `Microsoft Copilot`, `Google Gemini`, `Claude`, `Grammarly`, `Canva`, `Otter.ai`, `Zoom AI Companion`],
  account_options: [
    {id: 'business', label: `Business account`},
    {id: 'not_yet',  label: `Not yet`, detail: `Personal or free for now`},
  ],
  account_hint: `The type of plan matters, not who pays for it. A personal plan paid for by the business is still a personal plan.`,

  never_options: [
    {id: 'passwords', label: `Passwords, security codes or login details`, on: true},
    {id: 'cards',     label: `Payment card numbers`, on: true},
    {id: 'bank',      label: `Bank account numbers`, on: true},
    {id: 'ids',       label: `Social Security numbers and other ID numbers`, on: true},
    {id: 'health',    label: `Health or medical information about anyone`, on: true, off_for: ['healthcare']},
    {id: 'hr',        label: `Staff pay, performance or disciplinary records`, on: false},
    /* industry suggestions, ticked by default for that industry */
    {id: 'patients',  industry: 'healthcare',   on: true, label: `Patient information, unless the tool is covered by a business associate agreement (BAA)`},
    {id: 'client_conf', industry: 'professional', on: true, label: `Client-confidential documents, unless the tool is approved for client work`},
    {id: 'tax',       industry: 'professional', on: false, label: `Tax return information, unless the client has agreed in writing`},
    {id: 'client_fin', industry: 'finance',     on: true, label: `Client account numbers, statements and portfolio details, unless the tool is covered by a data agreement`},
    {id: 'candidates', industry: 'hiring',      on: true, label: `Candidates' health, disability or background-check information`},
    {id: 'children',  industry: 'education',    on: true, label: `Information that identifies a child`},
    {id: 'cui',       industry: 'defense',      on: true, label: `Controlled Unclassified Information (CUI), unless the tool is approved for it`},
    {id: 'drawings',  industry: 'trades',       on: true, label: `Customer drawings and specifications, unless the customer has agreed`},
    {id: 'embargo',   industry: 'creative',     on: true, label: `Unreleased or embargoed client work, unless the client has agreed`},
  ],

  people_info_options: [
    {id: 'approved', label: `Only in approved business-account tools`, detail: `And only what the task needs`},
    {id: 'removed',  label: `Only with names and details removed`},
    {id: 'none',     label: `None at all`},
  ],

  check_options: [
    {id: 'customers', label: `Anything sent to a customer`, solo_label: `Anything sent to a client`, on: true},
    {id: 'published', label: `Anything published under our name`, solo_label: `Anything published under my name`, on: true},
    {id: 'figures',   label: `Anything with figures, prices or dates`, on: true},
    {id: 'advice',    label: `Anything legal, financial or medical`, on: false},
  ],

  decision_kinds: [
    {id: 'hiring',  label: `hiring`},
    {id: 'pay',     label: `pay or performance`},
    {id: 'credit',  label: `credit, lending or insurance`},
    {id: 'service', label: `whether a customer receives a service`},
  ],

  yes_no: [
    {id: 'yes', label: `Yes`},
    {id: 'no',  label: `No`},
  ],
  yes_no_not_sure: [
    {id: 'yes',      label: `Yes`},
    {id: 'no',       label: `No`},
    {id: 'not_sure', label: `Not sure`},
  ],

  telling_options: [
    {id: 'chatbot',    label: `Our chatbot or assistant states that it is an AI`},
    {id: 'agreements', label: `We mention AI in client agreements`},
    {id: 'not_yet',    label: `Not yet`},
    {id: 'no_ai',      label: `We do not use AI to deal with customers`},
  ],

  speed_options: [
    {id: 'straight_away', label: `Immediately`, text: `immediately`},
    {id: 'same_day',      label: `The same day`,  text: `the same day`},
    {id: 'within_day',    label: `Within 24 hours`, text: `within 24 hours`},
  ],

  /* walkthrough gap 12: who else might need to know, by industry. Flags,
     not conclusions. */
  incident_contacts: {
    healthcare:   `Ask a compliance advisor whether it is a privacy incident under HIPAA.`,
    finance:      `Check whether the compliance consultant, custodian or insurer must be notified.`,
    professional: `Check whether the client, the professional association or the insurer must be notified.`,
    defense:      `Check the contract: some incidents involving CUI must be reported quickly.`,
    education:    `If it involves a child's information, check whether the parents or the school must be notified.`,
    hiring:       `If it involves candidates' information, check whether they must be notified.`,
  },

  /* ---------- the sentences ---------- */
  blanks: {
    business: `Business name`, decider: `Name or role`, tools: `Approved tools`,
    date: `date`, incident_who: `Name`, kinds: `the decisions`,
  },

  text: {
    team: {
      title: `{business}: Using AI at work`,
      meta: `Version 1.0, adopted {adopted}. Responsible: {decider}.`,
      why_h: `Why we have this policy`,
      why: `AI tools can save us time, and we want you to use them. We also hold information that our customers and colleagues trust us with, and some AI tools store or reuse what is typed into them. This policy explains how to use AI in a way that keeps that information safe and keeps our work to the standard our customers expect.`,
      who_h: `Whom to ask`,
      who: `{decider} decides which AI tools we can use. If you are not sure whether something is allowed, ask {decider}.`,
      tools_h: `Approved tools`,
      tools_intro: `You may use these tools for work:`,
      tools_rule: `Use only your work account. Do not use personal or free AI accounts for work.`,
      tools_signin: `Every AI account used for work has two-step sign-in turned on, and accounts are removed when someone leaves.`,
      tools_not_yet: `Being set up: {tool}. Do not use it for customer information until {date}.`,
      tools_other: `To use another AI tool, ask {decider} first.`,
      never_h: `Never put these into any AI tool`,
      never_after: `If you are not sure whether something is sensitive, treat it as sensitive.`,
      people_h: `Customer and staff information`,
      people_approved: `Customer and staff information may only go into {tools}, and only what the task requires.`,
      people_approved_none: `Customer and staff information must not go into any AI tool until we have an approved business account.`,
      people_removed: `Before putting anything about a customer or member of staff into an AI tool, remove names, contact details and anything else that identifies them.`,
      people_none: `Customer and staff information must not go into any AI tool.`,
      checking_h: `Checking AI output`,
      checking_intro: `AI tools can give confident answers that are wrong. A person must read and check the following before they are sent, published or used:`,
      checking_after: `If you send it, you are responsible for it, as if you had written it yourself.`,
      decisions_yes: `AI may help prepare information about {kinds}, but a person always makes the decision.`,
      decisions_no: `Do not use AI to help make decisions about people, such as hiring or pay, without asking {decider} first.`,
      acting_h: `AI that can act on its own`,
      acting_rule: `AI tools must not send, pay or delete anything without a person approving it.`,
      acting_connect: `Ask {decider} before connecting any AI tool to email, files or accounts.`,
      telling_h: `Telling customers`,
      telling_chatbot: `When customers communicate with an AI, it will say so, and they can always reach a person.`,
      telling_agreements: `Our client agreements explain how we use AI.`,
      telling_not_yet: `We tell customers when they are dealing with an AI, and they can always reach a person.`,
      telling_no_ai: `We do not use AI to deal with customers. If that changes, the AI will state that it is an AI, and people will always be able to reach a person.`,
      recording_h: `Recording and summarizing calls`,
      recording_yes: `Tell everyone at the start when a call or meeting is being recorded or summarized, and allow them to decline.`,
      recording_no: `Do not switch on AI recording or meeting summaries without asking {decider} first.`,
      wrong_h: `If something goes wrong`,
      wrong: `If you put the wrong information into an AI tool, or AI produces something incorrect that reaches a customer, tell {incident_who} {speed}. You will not be disciplined for reporting it. The sooner we know, the easier it is to correct.`,
      review_h: `Reviewing this policy`,
      review: `We will review this policy by {review}, and whenever we start using a new AI tool.`,
      sign: `I have read and understood this policy.`,
      footer: `Adopted {adopted}. Next review {review}. This policy states what we have decided. It is not a record of what has been checked.`,
    },
    solo: {
      title: `{business}: My AI rules and settings`,
      meta: `Version 1.0, adopted {adopted}.`,
      why_h: `Why I have these rules`,
      why: `AI tools save me time. My clients trust me with their information, and some AI tools store or reuse what is typed into them. These rules describe how I use AI while keeping that information safe.`,
      tools_h: `The AI tools I use for work`,
      tools_intro: `I use these tools for work:`,
      tools_rule: `I use only business accounts for work, never a personal or free account.`,
      tools_signin: `Every AI account I use for work has two-step sign-in turned on.`,
      tools_not_yet: `Moving to a business account: {tool}. I will not use it for client information until {date}.`,
      tools_other: `I check each new AI tool before I use it for work.`,
      never_h: `Never goes into any AI tool`,
      never_after: `If I am not sure whether something is sensitive, I treat it as sensitive.`,
      people_h: `Client information`,
      people_approved: `Client information goes only into {tools}, and only what the task requires.`,
      people_approved_none: `Client information does not go into any AI tool until I have a business account.`,
      people_removed: `Before putting anything about a client into an AI tool, I remove names, contact details and anything else that identifies them.`,
      people_none: `Client information does not go into any AI tool.`,
      checking_h: `Checking AI output`,
      checking_intro: `AI tools can give confident answers that are wrong. I read and check the following before they are sent, published or used:`,
      checking_after: `If I send it, I am responsible for it, however it was drafted.`,
      decisions_yes: `AI may help prepare information about {kinds}, but I always make the decision myself.`,
      decisions_no: ``,
      acting_h: `AI that can act on its own`,
      acting_rule: `I do not let AI tools send, pay or delete anything without my approval.`,
      acting_connect: `I check what a tool will be able to reach before connecting it to my email, files or accounts.`,
      telling_h: `Telling clients`,
      telling_chatbot: `When clients communicate with an AI, it says so, and they can always reach me.`,
      telling_agreements: `My client agreements explain how I use AI.`,
      telling_not_yet: `I tell clients when they are dealing with an AI, and they can always reach me.`,
      telling_no_ai: `I do not use AI to deal with clients. If that changes, the AI will state that it is an AI, and clients will always be able to reach me.`,
      recording_h: `Recording and summarizing calls`,
      recording_yes: `I tell everyone at the start when a call or meeting is being recorded or summarized, and allow them to decline.`,
      recording_no: ``,
      wrong_h: `If something goes wrong`,
      wrong: `If I put the wrong information into an AI tool, or AI produces something incorrect that reaches a client, I delete it where possible, change any password involved, and check whether anyone must be notified.`,
      review_h: `Reviewing these rules`,
      review: `I will review these rules by {review}, and whenever I start using a new AI tool.`,
      settings_h: `Settings to check on each tool`,
      settings: [
        `Signed in with my business account`,
        `Two-step sign-in: on`,
        `Training on my data: off (checked on ______)`,
        `Chat history: deleted after ______, or switched off`,
        `Shared links: none left open`,
      ],
      footer: `Adopted {adopted}. Next review {review}. These rules state what I have decided. They are not a record of what has been checked.`,
    },
  },

  never_sheet: {
    title_team: `{business}: never put these into any AI tool`,
    title_solo: `{business}: never put these into any AI tool`,
    after: `Not sure? Treat it as sensitive, and ask {decider}.`,
    after_solo: `Not sure? Treat it as sensitive.`,
  },

  /* who each to-do is for, as the owner reads it */
  owner_labels: {you: `You`, it_provider: `You or your IT provider`, supplier: `Ask your supplier`, advisor: `Ask your advisor or compliance consultant`},

  /* to-dos for anything answered not yet or not sure */
  todos: {
    not_yet_tools:  {text: `Move {tools} to a business account by {date}.`, owner: 'you'},
    no_business:    {text: `Choose a business-account AI tool before customer or staff information goes into AI.`, owner: 'you'},
    acts_not_sure:  {text: `Find out whether any AI tool can send, pay, book or delete on its own. Look in email and accounting software, and under connected apps in your Google or Microsoft account.`, owner: 'it_provider'},
    telling_not_yet: {text: `Decide how you will tell customers about AI: a line in your chatbot's greeting, your client agreements, or both.`, owner: 'you'},
    recording_not_sure: {text: `Check whether your video-call or phone apps record, transcribe or summarize calls.`, owner: 'you'},
    decisions_advice: {text: `If you hire in New York City or Colorado, or AI helps with credit decisions, get advice on the specific rules.`, owner: 'advisor'},
    share:          {text: `Go through the policy with the team, and keep a record of who has read it.`, owner: 'you', team_only: true},
    settings:       {text: `Go through the settings checklist on each tool you use.`, owner: 'you', solo_only: true},
  },
};
