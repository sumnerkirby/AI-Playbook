/* What the business profile changes on the site, as data.
   Design: exploratory/feature_concepts/01_profile_questions.md ("What it
   changes" tables) and walkthrough gap 9 (steps react to the AI list, not
   just the profile).

   The profile adds and highlights; it never removes the basics. The nine
   playbook steps can't be hidden (tests/profile_test.js checks). Anything
   hidden stays one click away, with the reason shown.

   Each effect:
     id      stable
     when    condition over profile facts: team_size, path (the highest of
             use, configure, build, or none), ai_use, industry, it_support,
             and acts (yes | no | unknown, from a saved quick check and
             monthly check-ins)
     page    file the effect applies to
     target  CSS selector on that page. A playbook step (#step-N) gets the
             note inside the step; anything else gets it just after.
     kind    note | hide | tag | banner | overlay
     title, text, list, links   what the reader sees
     reason  for hide: shown on the stub, with "Show anyway" */

var PROFILE_EFFECTS = {
  version: '2026.09.1-profile',
  last_reviewed: '2026-09-29',
  /* never hidden, whatever the answers */
  core: ['#step-1', '#step-2', '#step-3', '#step-4', '#step-5', '#step-6', '#step-7', '#step-8', '#step-9'],

  /* how the "what changes for you" list names each place */
  pages: {'playbook.html': `Playbook`, 'policies.html': `Templates`, 'guide-ai-policy.html': `Policy guide`, '*': `Every page`},
  targets: {
    '#step-1': `Step 1, the AI lead`, '#step-2': `Step 2, the list of AI tools`, '#step-3': `Step 3, the AI policy`,
    '#step-4': `Step 4, sensitive information`, '#step-5': `Step 5, suppliers`, '#step-6': `Step 6, checking AI output`,
    '#step-7': `Step 7, AI that can act`, '#step-8': `Step 8, incidents`, '#step-9': `Step 9, the quarterly review`,
    'a[href="policy-ai-lead.html"]': `The AI lead role description`,
    'a[href="policy-tool-approval.html"]': `Approving new AI tools`,
    '#starter': `The starter policy`,
  },

  effects: [
    /* ---------- team size ---------- */
    {id: 'solo.step1', when: {q: 'team_size', in: ['solo']}, page: 'playbook.html', target: '#step-1', kind: 'note',
     title: `Just you`,
     text: `You are the AI lead. Write one line saying so, and how much time you will give the role each month. The parts about informing a team do not apply.`},
    {id: 'solo.step2', when: {q: 'team_size', in: ['solo']}, page: 'playbook.html', target: '#step-2', kind: 'note',
     title: `Just you`,
     text: `Instead of asking a team, check your own devices: phone apps and browser add-ons as well as your computer, and the AI features in the software you pay for.`},
    {id: 'solo.step3', when: {q: 'team_size', in: ['solo']}, page: 'playbook.html', target: '#step-3', kind: 'note',
     title: `Just you`,
     text: `Instead of a team policy, keep a one-page set of your own rules, with a settings checklist for each tool.`,
     links: [{href: 'quick_policy.html', label: `Build yours in about 8 minutes`}]},
    {id: 'solo.step6', when: {q: 'team_size', in: ['solo']}, page: 'playbook.html', target: '#step-6', kind: 'note',
     title: `Just you`,
     text: `Clients of sole practitioners often ask directly how AI is used in their work. Decide now what you will tell them, and include it in your client agreement.`},
    {id: 'solo.step8', when: {q: 'team_size', in: ['solo']}, page: 'playbook.html', target: '#step-8', kind: 'note',
     title: `Just you`,
     text: `A single card is sufficient: what to do first, whom to call (clients, insurer, anyone you report to), and how to switch off each tool.`},
    {id: 'solo.policy', when: {q: 'team_size', in: ['solo']}, page: 'guide-ai-policy.html', target: '#starter', kind: 'note',
     title: `Just you`,
     text: `This starter policy is written for a team. For a business of one, a rules and settings sheet written in the first person is more suitable.`,
     links: [{href: 'quick_policy.html', label: `Build your rules and settings sheet`}]},
    {id: 'solo.hide.lead', when: {q: 'team_size', in: ['solo']}, page: 'policies.html', target: 'a[href="policy-ai-lead.html"]', kind: 'hide',
     reason: `For teams. In a business of one, you are the AI lead.`},
    {id: 'solo.hide.approval', when: {q: 'team_size', in: ['solo']}, page: 'policies.html', target: 'a[href="policy-tool-approval.html"]', kind: 'hide',
     reason: `For teams. You approve your own tools; the supplier questions below still apply.`},

    {id: 'small.tag.lead', when: {q: 'team_size', in: ['small']}, page: 'policies.html', target: 'a[href="policy-ai-lead.html"]', kind: 'tag',
     text: `Optional for a team your size`},
    {id: 'small.tag.approval', when: {q: 'team_size', in: ['small']}, page: 'policies.html', target: 'a[href="policy-tool-approval.html"]', kind: 'tag',
     text: `Light version for you: new tools go to the owner`},
    {id: 'medium.tag.lead', when: {q: 'team_size', in: ['medium']}, page: 'policies.html', target: 'a[href="policy-ai-lead.html"]', kind: 'tag',
     text: `Recommended for a team your size`},
    {id: 'medium.tag.approval', when: {q: 'team_size', in: ['medium']}, page: 'policies.html', target: 'a[href="policy-tool-approval.html"]', kind: 'tag',
     text: `Recommended: use the full request form`},
    {id: 'large.banner', when: {q: 'team_size', in: ['large']}, page: '*', target: null, kind: 'banner',
     title: `More than 50 people`,
     text: `This playbook still applies, but a business of your size may be better served by a more complete framework.`,
     links: [{href: 'ai-rmf-1-0.html', label: `The NIST AI Risk Management Framework`}]},

    /* ---------- how the business uses AI ---------- */
    {id: 'none.step2', when: {q: 'path', in: ['none']}, page: 'playbook.html', target: '#step-2', kind: 'note',
     title: `You said you do not use AI`,
     text: `Confirm this. AI is often added without anyone choosing it:`,
     list: [
       `AI features in your email or documents`,
       `Meeting summaries in your video-call app`,
       `Browser add-ons that help with writing or spelling`,
       `New AI features in booking, accounting or customer software`,
       `Staff using AI on their own phones or personal accounts`,
     ],
     links: [{href: 'quick_check.html', label: `The quick check takes 5 minutes`}]},
    {id: 'configure.step7', when: {q: 'path', in: ['configure', 'build']}, page: 'playbook.html', target: '#step-7', kind: 'note',
     title: `Tools you have set up yourself`,
     text: `Custom assistants and automations carry risks that ready-made tools do not. For each one, record:`,
     list: [
       `What you gave it to read, and whether any of it is personal or confidential`,
       `Who can use it: only you, your team, or anyone with the link`,
       `What it is connected to, and what it can do there`,
       `Whether you tested it before sharing it, by asking it to reveal its instructions, ignore its rules, or show other people's information`,
       `How to switch it off quickly`,
       `Who owns it, and what happens to it when they leave`,
     ]},
    {id: 'configure.review', when: {q: 'path', in: ['configure']}, page: 'playbook.html', target: '#step-6', kind: 'note',
     title: `Before customers use anything you have set up`,
     text: `If customers will use an assistant or automation you built, have it reviewed by a professional before launch.`},
    {id: 'build.step5', when: {q: 'path', in: ['build']}, page: 'playbook.html', target: '#step-5', kind: 'note',
     title: `Writing code that uses AI`,
     text: `This playbook covers the basics. For code you write, also do the following:`,
     list: [
       `Keep API keys out of web pages, apps and shared code`,
       `Treat what the model returns as untrusted input, never as instructions`,
       `Plan for prompt injection: text in emails, documents or web pages that tries to steer the model`,
       `Have the code reviewed by a professional before launching it to customers`,
     ],
     links: [
       {href: 'owasp-llm-top-10-2026.html', label: `OWASP Top 10 for LLM Applications`},
       {href: 'ai-rmf-genai-profile.html', label: `NIST Generative AI Profile`},
     ]},

    /* ---------- industry ---------- */
    {id: 'industry.overlay', when: {q: 'industry', in: ['healthcare', 'professional', 'finance', 'retail', 'hiring', 'education', 'defense', 'trades', 'creative']},
     page: 'playbook.html', target: '#step-4', kind: 'overlay'},

    /* ---------- who looks after IT ---------- */
    {id: 'it.provider.step7', when: {q: 'it_support', in: ['provider']}, page: 'playbook.html', target: '#step-7', kind: 'note',
     title: `Your IT company`,
     text: `Ask them to list what each AI tool can reach, and to set up approval for anything that sends, pays or deletes.`},
    {id: 'it.none.step7', when: {q: 'it_support', in: ['none']}, page: 'playbook.html', target: '#step-7', kind: 'note',
     title: `No one looks after IT`,
     text: `Do not connect AI tools to email, files or payments unless you can check exactly what they can reach.`},

    /* ---------- the AI list, not just the profile (walkthrough gap 9) ---------- */
    {id: 'acts.no.step7', when: {q: 'acts', in: ['no']}, page: 'playbook.html', target: '#step-7', kind: 'note',
     title: `From your quick check`,
     text: `None of the tools you described can act on its own. Confirm this, and then mark this step done.`},
    {id: 'acts.yes.step7', when: {q: 'acts', in: ['yes']}, page: 'playbook.html', target: '#step-7', kind: 'note',
     title: `From your quick check`,
     text: `At least one tool you use can, or might, act on its own. Begin with this step.`},
  ],
};
