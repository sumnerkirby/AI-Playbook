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

  steps: [`What is it?`, `What goes in?`, `The supplier`, `Where the output goes`, `What it can do`, `Tools you set up`, `What has already happened`],

  questions: [
    /* ---------- 1. what is it ---------- */
    {id: 'mode', step: 0, kind: 'one',
     text: `Is this a tool you want to start using, or one that is already in use?`,
     options: [
       {id: 'new',        label: `We want to start using it`, detail: `Check it before anyone starts`},
       {id: 'discovered', label: `We found it already in use`, detail: `No blame. The aim is to make it safe to keep using`},
     ]},
    {id: 'tool', step: 0, kind: 'text', text: `What is the tool called?`,
     placeholder: `For example: ChatGPT, or the AI notes in our booking software`},
    {id: 'plan', step: 0, kind: 'one', text: `Which plan or account is it on?`,
     hint: `The type of plan matters, not who pays for it. A personal plan paid for by the business is still a personal plan.`,
     options: [
       {id: 'free_personal', label: `A free personal account`},
       {id: 'paid_personal', label: `A paid personal account`},
       {id: 'business',      label: `A business or team plan`},
       {id: 'enterprise',    label: `An enterprise plan`},
       {id: 'built_in',      label: `It came built into software we already pay for`},
       {id: 'own',           label: `Something we set up ourselves`, detail: `A custom assistant, or an automation with an AI step`,
        show_if: {q: '_path', in: ['configure', 'build']}},
       {id: 'dont_know',     label: `Not sure`},
     ]},
    {id: 'extension', step: 0, kind: 'one', text: `Is it a browser add-on, extension or plugin?`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}]},
    {id: 'use', step: 0, kind: 'one', text: `What is it used for?`,
     hint: `If it is used for more than one task, choose one now. You can add another use afterward.`,
     options: [
       {id: 'writing',     label: `Writing and editing`},
       {id: 'research',    label: `Research and searching`},
       {id: 'summarizing', label: `Summarizing documents`},
       {id: 'meetings',    label: `Meeting notes, transcripts or calls`},
       {id: 'customers',   label: `Answering customers`, detail: `Chat, email or phone`},
       {id: 'marketing',   label: `Marketing images or content`},
       {id: 'finance',     label: `Bookkeeping or finance`},
       {id: 'scheduling',  label: `Scheduling or handling email`},
       {id: 'data',        label: `Analyzing data or spreadsheets`},
       {id: 'coding',      label: `Coding or building a website`},
       {id: 'hiring',      label: `Helping make a decision about a person`, detail: `Hiring, credit, eligibility`},
       {id: 'other',       label: `Something else`},
     ]},
    {id: 'direct', step: 0, kind: 'one', text: `Do customers communicate with the AI directly?`,
     hint: `A chatbot, or a voice assistant that answers the phone.`,
     show_if: {q: 'use', in: ['customers']},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No, it drafts and a person sends`}]},
    {id: 'records', step: 0, kind: 'one', text: `Does it record, transcribe or summarize people talking?`,
     show_if: {any: [{q: 'direct', in: ['yes']}, {q: 'use', in: ['other', 'scheduling']}]},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},

    /* ---------- 2. what goes in ---------- */
    {id: 'data', step: 1, kind: 'many', text: `What goes into it?`, hint: `Check everything that goes in, even occasionally.`,
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
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},

    /* ---------- 3. the supplier ---------- */
    {id: 'training', step: 2, kind: 'one', evidence: true,
     show_if: {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']},
     text: `Does your plan use what you put in to train its AI?`,
     options: [
       {id: 'no_checked', label: `No, and we have checked the setting or the terms`},
       {id: 'yes',        label: `Yes`},
       {id: 'dont_know',  label: `Not sure`},
     ]},
    {id: 'deletion', step: 2, kind: 'one', evidence: true,
     show_if: {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']},
     text: `Can you delete what you have put in?`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},
    {id: 'agreement', step: 2, kind: 'one', evidence: true,
     show_if: {any: [{q: 'data', in: ['personal', 'sensitive', 'regulated']}, {q: 'special', in: ['yes']}]},
     text: `Is there a data agreement with the supplier that covers this?`,
     text_by_industry: {healthcare: `Is there a business associate agreement (BAA) that covers this AI feature?`},
     hint: `A data processing addendum or confidentiality agreement. A BAA for healthcare.`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},
    {id: 'published', step: 2, kind: 'one', evidence: true,
     show_if: {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']},
     text: `Does the supplier publish how it handles your data?`,
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},

    /* ---------- 4. where the output goes ---------- */
    {id: 'output', step: 3, kind: 'many', text: `Where does what it produces go?`,
     options: [
       {id: 'internal',  label: `Only us, inside the business`},
       {id: 'customers', label: `Customers or the public`},
       {id: 'person',    label: `It helps make a decision about a person`, detail: `A job, money, housing, health, education`},
     ]},
    {id: 'person_decides', step: 3, kind: 'one', text: `Does a person make the final decision, every time?`,
     show_if: {any: [{q: 'output', in: ['person']}, {q: 'use', in: ['hiring']}]},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},
    {id: 'nyc_co', step: 3, kind: 'one', text: `Do you hire in New York City or Colorado?`,
     hint: `Both have their own rules for AI used in hiring and other decisions about people.`,
     show_if: {any: [{q: 'output', in: ['person']}, {q: 'use', in: ['hiring']}]},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},
    {id: 'safety', step: 3, kind: 'one', text: `Is any of its output safety-relevant?`,
     hint: `Estimates, load calculations, safety checks, specifications.`,
     show_if: {q: '_industry', in: ['trades']},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}]},
    {id: 'qualified', step: 3, kind: 'one', text: `Does a qualified person check it before it is used?`,
     show_if: {q: 'safety', in: ['yes']},
     options: [{id: 'yes', label: `Yes`}, {id: 'no', label: `No`}, {id: 'dont_know', label: `Not sure`}]},

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
       {id: 'dont_know', label: `Not sure`},
     ]},

    /* ---------- 6. things you set up yourself ---------- */
    {id: 'own_access', step: 5, kind: 'one', text: `Who can use it?`, show_if: {q: 'plan', in: ['own']},
     options: [
       {id: 'me',     label: `Only me`},
       {id: 'team',   label: `Our team`},
       {id: 'public', label: `Anyone with the link, or the public`},
     ]},
    {id: 'own_docs', step: 5, kind: 'one', text: `What did you give it to read?`, show_if: {q: 'plan', in: ['own']},
     options: [
       {id: 'none',         label: `Nothing`},
       {id: 'internal',     label: `Public or internal documents`},
       {id: 'confidential', label: `Documents with personal or confidential information`},
     ]},
    {id: 'own_tested', step: 5, kind: 'one', text: `Did you test it for misuse before sharing it?`,
     hint: `For example, by asking it to reveal its instructions, ignore its rules, or show other people's information.`,
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
       {id: 'dont_know',         label: `Not sure`},
     ]},
  ],

  /* Where supplier settings usually live. `general` applies to any tool.
     `tools` gives directions for five common tools, each taken from the
     vendor's own pages on the date in `checked`; settings change, so check
     them again before that date is a quarter old. A tool is recognized when
     its name matches one of `match` (case-insensitive regular expressions).
     `plans` is keyed by plan group: personal (free or paid personal),
     business (business or enterprise), or any (shown for every plan). */
  where_to_look: {
    general: [
      `In the tool's own settings, under Data, Privacy or Data controls.`,
      `On a business plan, in the administration console rather than your own settings.`,
      `On the supplier's trust, privacy or security page, and in the terms for your plan.`,
      `If you still cannot tell, ask the supplier in writing and keep the reply.`,
    ],
    tools: {
      chatgpt: {
        name: `ChatGPT`, match: ['\\bchat ?gpt\\b', '\\bopenai\\b'], checked: '2026-10-01',
        plans: {
          personal: {label: `Free, Go, Plus or Pro`, steps: [
            `To stop new chats from being used for training, open Settings, select Data controls, and turn off Improve the model for everyone. In the phone app, open the sidebar and select your profile icon to reach Settings.`,
            `Turning off training does not delete saved chats. Delete chats separately.`,
            `If you rate a response with thumbs up or down, the whole conversation may be used for training, even with the setting off.`,
            `A temporary chat is not used for training and does not appear in your history, but OpenAI may keep it for up to 30 days.`,
          ]},
          business: {label: `Business, Enterprise or Edu`, steps: [
            `OpenAI does not train on content from Business, Enterprise or Edu workspaces by default.`,
            `Retention and other data settings are set for the whole workspace by its owner, not in your own settings.`,
          ]},
        },
        sources: [{title: `OpenAI Help Center: Data controls in ChatGPT`, href: `https://help.openai.com/en/articles/7730893-data-controls-in-chatgpt`}],
      },
      copilot: {
        name: `Microsoft Copilot`, match: ['^(?!.*github).*\\bcopilot\\b'], checked: '2026-10-01',
        plans: {
          personal: {label: `Signed in with a personal Microsoft account`, steps: [
            `Microsoft states that prompts, responses and file contents in the Copilot app are not used to train its foundation models. This applies to the version of the app released on August 18, 2026; update the app if you have an older version.`,
            `Your chats can still be used to personalize Copilot, other Microsoft services and ads. To stop this, open Settings, select Personalization, and turn off Saved memories, One shared experience and Allow ads personalization.`,
            `To delete a chat, select it in the Chats list, then select More and Delete. To delete all of your Copilot history, use the Microsoft privacy dashboard.`,
          ]},
          business: {label: `Signed in with a work or school account`, steps: [
            `With a work or school (Microsoft Entra) account, Copilot Chat has enterprise data protection: prompts and responses are not used to train foundation models. Your IT administrator can see a log of them.`,
            `The protection applies only when you are signed in with the work or school account. Check which account Copilot shows before you put in business information.`,
            `Microsoft 365 Copilot is now named Microsoft Copilot, and Microsoft 365 Copilot Chat is now Microsoft Copilot Chat. The data protection did not change.`,
            `Web searches that Copilot makes for you are handled by Bing under separate terms.`,
          ]},
        },
        sources: [
          {title: `Microsoft Support: Microsoft Copilot for individuals, your activity history`, href: `https://support.microsoft.com/en-us/privacy/microsoft-copilot/activity-history`},
          {title: `Microsoft Support: Microsoft Copilot for individuals, your privacy controls and choices`, href: `https://support.microsoft.com/en-us/privacy/microsoft-copilot/privacy-controls`},
          {title: `Microsoft Support: Data protection when using Microsoft Copilot Chat for work or school`, href: `https://support.microsoft.com/en-us/privacy/data-protection-when-using-microsoft-365-copilot-chat-for-work-or-school`},
        ],
      },
      gemini: {
        name: `Google Gemini`, match: ['\\bgemini\\b', '\\bbard\\b'], checked: '2026-10-01',
        plans: {
          personal: {label: `Signed in with a personal Google account`, steps: [
            `To stop future chats from being used to train Google's AI models, go to myactivity.google.com/product/gemini (Gemini Apps Activity) and turn off Keep Activity. Chats are still kept for 72 hours, and sending feedback allows that chat to be used.`,
            `While Keep Activity is on, human reviewers read some chats, and reviewed chats are kept for up to three years even if you delete your activity. Google advises not entering confidential information.`,
            `A temporary chat is not used to train Google's AI models.`,
            `Delete chats on the same Gemini Apps Activity page. Activity is deleted automatically after 18 months unless you change the period.`,
          ]},
          business: {label: `Signed in with a Google Workspace account`, steps: [
            `Google states that with a Workspace account, your content is not reviewed by people or used to train generative AI models outside your organization without permission.`,
            `Your Workspace administrator decides in the Admin console whether Gemini conversations are saved and for how long.`,
            `Gemini in Workspace follows the Cloud Data Processing Addendum, which is part of your Workspace agreement.`,
          ]},
        },
        sources: [
          {title: `Gemini Apps Privacy Hub (last updated September 24, 2026)`, href: `https://support.google.com/gemini/answer/13594961`},
          {title: `Generative AI in Google Workspace Privacy Hub`, href: `https://support.google.com/a/answer/15706919`},
        ],
      },
      claude: {
        name: `Claude`, match: ['\\bclaude\\b', '\\banthropic\\b'], checked: '2026-10-01',
        plans: {
          personal: {label: `Free, Pro or Max`, steps: [
            `To stop new chats and coding sessions from being used for training, open Settings, select Privacy, and turn off Help Improve our AI models.`,
            `Chats that Anthropic's safety systems flag may still be used for safety work.`,
            `To delete a chat on the web, hover over it in the sidebar, select the three-dot button, and select Delete. To delete several, open Chats and tasks and use Select.`,
          ]},
          business: {label: `Team, Enterprise or API`, steps: [
            `Anthropic does not use inputs or outputs from commercial plans to train its models by default.`,
            `If someone rates a response with thumbs up or down, the whole conversation is kept for up to five years and may be used for training. An owner can turn off rating for the organization under Organization settings, Data and Privacy, Rate chats.`,
          ]},
        },
        sources: [
          {title: `Anthropic Privacy Center: How do I change my model improvement privacy settings?`, href: `https://privacy.claude.com/en/articles/12109829-how-do-i-change-my-model-improvement-privacy-settings`},
          {title: `Anthropic Privacy Center: Is my data used for model training? (commercial products)`, href: `https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training`},
          {title: `Claude Help Center: Delete or rename a conversation`, href: `https://support.claude.com/en/articles/8230524-delete-or-rename-a-conversation`},
        ],
      },
      meta_ai: {
        name: `Meta AI`, match: ['\\bmeta ai\\b', '\\bmeta\\.ai\\b'], checked: '2026-10-01',
        plans: {
          any: {label: `All accounts`, steps: [
            `Meta states that it uses your conversations with Meta AI to improve its AI, and that it may share your messages with selected partners when Meta AI cannot answer. Meta's pages describe no setting that stops this.`,
            `Meta's pages describe no business plan for Meta AI. Treat it as a personal tool and put in only information that is already public.`,
            `To delete all chats, in the Meta AI app open Menu, then Settings, Data and privacy, Manage your information, and select Delete all chats and media.`,
          ]},
        },
        sources: [
          {title: `Meta Help Center: Remove posts, chats and media from Meta AI and Vibes`, href: `https://www.meta.com/help/artificial-intelligence/2457110494637611/`},
          {title: `Meta Privacy Center: How Meta uses information for generative AI models and features`, href: `https://www.facebook.com/privacy/genai/`},
        ],
      },
    },
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
    `Remove shared links and anything you set up in it, such as custom assistants and automations.`,
    `Mark it retired on the AI list, with the date.`,
  ],
};
