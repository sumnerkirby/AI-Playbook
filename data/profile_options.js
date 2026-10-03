/* Business profile options. Data, not logic: the quick check and (later) the
   profile page both read this. US only for version 1, so there is no region
   question; rules carry applies_to.region so UK and EU can be added later.
   Design: exploratory/feature_concepts/01_profile_questions.md.
   Loaded as a .js file (not .json) so pages still work opened from disk. */

var PROFILE_OPTIONS = {
  profile_version: 2,
  last_reviewed: '2026-10-01',

  team_size: {
    label: `Who uses AI for work in your business?`,
    why: `If you work alone, the site leaves out the steps meant for a team.`,
    options: [
      {id: 'solo',   code: 's', label: `Just me`,                              summary: `Just me`},
      {id: 'small',  code: 't', label: `Me and a small team (2 to 10 people)`, summary: `Small team`},
      {id: 'medium', code: 'm', label: `A bigger team (11 to 50 people)`,      summary: `Team of 11 to 50`},
      {id: 'large',  code: 'l', label: `More than 50 people`,                  summary: `Over 50`},
    ],
  },

  ai_use: {
    label: `How does your business use AI?`,
    why: `Setting up your own assistants or writing code requires checks that ready-made tools do not.`,
    multiple: true,
    options: [
      {id: 'use',       code: 'u', label: `We use ready-made AI tools`,
       examples: `ChatGPT, Copilot, Gemini or Claude for writing; AI features in software you already pay for`},
      {id: 'configure', code: 'c', label: `We set up our own AI assistants or automations, without writing code`,
       examples: `Custom GPTs, Gemini Gems, Copilot Studio agents, Claude Projects; Zapier, Make or n8n with an AI step`},
      {id: 'build',     code: 'b', label: `We write code that uses AI`,
       examples: `Calling an AI company's API from your own software, or running a model yourself`},
      {id: 'none',      code: 'n', label: `We do not use AI`, examples: ``},
    ],
  },

  industry: {
    label: `What kind of business are you?`,
    why: `Some industries have extra rules about information that goes into AI tools.`,
    options: [
      {id: 'healthcare',   code: 'hc', label: `Healthcare and wellness`,
       examples: `Dental, therapy, clinics, physical therapy, pharmacy, veterinary`},
      {id: 'professional', code: 'pr', label: `Legal, accounting and professional services`,
       examples: `Law firms, bookkeepers, tax preparers, consultants, architects`},
      {id: 'finance',      code: 'fi', label: `Finance and insurance`,
       examples: `Brokers, insurance agents, small lenders, financial advisers`,
       /* walkthrough gap 1: finance is too broad without these */
       subtypes: [
         {id: 'advice',    label: `Financial advice or planning`},
         {id: 'insurance', label: `Insurance`},
         {id: 'lending',   label: `Lending or credit`},
       ],
       registration: {
         applies_to_subtype: 'advice',
         label: `How are you registered?`,
         options: [
           {id: 'sec',      label: `With the SEC`},
           {id: 'state',    label: `With my state`},
           {id: 'not_sure', label: `Not sure`},
         ],
       }},
      {id: 'retail',       code: 're', label: `Retail, e-commerce and hospitality`,
       examples: `Shops, online sellers, restaurants, hotels`},
      {id: 'hiring',       code: 'hi', label: `Hiring and staffing`,
       examples: `Recruiters, staffing agencies`},
      {id: 'education',    code: 'ed', label: `Education and childcare`,
       examples: `Tutoring, training providers, childcare`},
      {id: 'defense',      code: 'de', label: `Defense or government contractor`,
       examples: `Suppliers handling government contract information`},
      {id: 'trades',       code: 'tr', label: `Trades, construction and manufacturing`,
       examples: `Builders, electricians, HVAC, small manufacturers`},
      {id: 'creative',     code: 'cr', label: `Creative, marketing and media`,
       examples: `Agencies, designers, photographers, writers`},
      {id: 'other',        code: 'ot', label: `Something else`, examples: ``},
    ],
  },

  it_support: {
    label: `Who looks after your IT?`,
    why: `Each to-do then names who does it: you, your IT provider, or your supplier.`,
    optional: true,
    options: [
      {id: 'none',     code: 'n', label: `No one`},
      {id: 'internal', code: 'i', label: `Someone in the business, part-time`},
      {id: 'provider', code: 'p', label: `An outside IT company`},
    ],
  },

  /* short words for the summary bar ("Just me · Ready-made tools · Healthcare") */
  path_summary: {use: `Ready-made tools`, configure: `Tools you set up`, build: `Code you write`, none: `No AI yet`},
  industry_summary: {
    healthcare: `Healthcare`, professional: `Professional services`, finance: `Finance`, retail: `Retail`,
    hiring: `Hiring`, education: `Education`, defense: `Defense contractor`, trades: `Trades`,
    creative: `Creative`, other: `Other`,
  },

  /* Industry overlays: what's different, as things to check with an advisor,
     never legal conclusions. Each needs verifying before publication. */
  overlays_verified: false,
  overlays: {
    healthcare: {
      last_reviewed: '2026-10-03',
      summary: `Patient information needs extra care.`,
      points: [
        `Under HIPAA, a covered entity generally needs a business associate agreement (BAA) with a vendor before patient information goes in. Most consumer AI plans do not offer one.`,
        `A BAA for your main software may not cover a new AI feature inside it. Ask the supplier.`,
        `Team-tier AI plans usually do not include a BAA. It is usually part of an enterprise or healthcare plan, so ask which plan, and which features, the BAA covers.`,
      ],
      red_line: `Patient information in a tool without a BAA.`,
      advice: `Ask your compliance advisor which of your tools count as business associates.`,
    },
    professional: {
      last_reviewed: '2026-10-01',
      summary: `Client confidentiality comes first.`,
      points: [
        `Lawyers: ABA Formal Opinion 512 (2024) covers competence, confidentiality and when client consent is needed for generative AI.`,
        `Tax preparers: rules on using and disclosing tax return information (IRC section 7216) and the FTC Safeguards Rule may apply.`,
      ],
      red_line: `Client-confidential material on a plan that may train on it.`,
      advice: `Check your professional association's guidance on AI, and your engagement letters.`,
    },
    finance: {
      last_reviewed: '2026-10-01',
      summary: `Customer financial information is regulated.`,
      points: [
        `Customer financial information is covered by the Gramm-Leach-Bliley Act. Non-bank firms are generally subject to the FTC Safeguards Rule.`,
        `If AI helps with credit decisions, adverse-action notices still need specific reasons (Equal Credit Opportunity Act and Regulation B). The CFPB withdrew its 2022 guidance on AI and adverse action in May 2025; the requirement in Regulation B did not change.`,
        `AI outputs such as meeting notes and client summaries may count as business records you have to keep.`,
      ],
      red_line: `AI helping decide credit or cover with no person deciding.`,
      advice: `Ask your compliance consultant which rules apply to how you are registered.`,
      subtype_points: {
        advice: `Advisers: check how AI-drafted client communications and meeting notes fit your record-keeping duties.`,
        insurance: `Insurance: some states have rules or bulletins on AI in underwriting and claims.`,
        lending: `Lending: fair-lending and adverse-action rules apply whether or not AI is involved.`,
      },
      registration_points: {
        sec: `SEC-registered advisers: Regulation S-P (as amended in 2024) covers safeguarding customer information and incident notice.`,
        state: `State-registered advisers: your state regulator's rules apply, and the FTC Safeguards Rule may too.`,
        not_sure: `Find out how you are registered. It decides which privacy and record-keeping rules apply.`,
      },
    },
    retail: {
      last_reviewed: '2026-10-01',
      summary: `Customer data, card payments and customer-facing chatbots.`,
      points: [
        `Card numbers never go into AI tools (PCI DSS).`,
        `Claims you make about AI-powered products must be truthful (FTC).`,
      ],
      red_line: `Payment card numbers in any AI tool.`,
      advice: `If a chatbot takes orders or answers questions about orders, check what it can see.`,
    },
    hiring: {
      last_reviewed: '2026-10-01',
      summary: `Decisions about people.`,
      points: [
        `New York City Local Law 144 requires a bias audit and notices for automated employment decision tools.`,
        `Colorado SB 26-189 (from January 1, 2027) requires notice, an explanation after an adverse decision, and human review on request, for automated decisions such as hiring.`,
        `Federal anti-discrimination law applies whether or not AI is involved.`,
      ],
      red_line: `AI screening or ranking candidates with no person deciding.`,
      advice: `If you hire in New York City or Colorado, get advice before using AI in hiring.`,
    },
    education: {
      last_reviewed: '2026-10-01',
      summary: `Children's information.`,
      points: [
        `COPPA covers online services directed at children under 13.`,
        `FERPA applies where school records are involved.`,
      ],
      red_line: `Information about a named child on a free or personal plan.`,
      advice: `Check what your agreements with schools or parents say about sharing information.`,
    },
    defense: {
      last_reviewed: '2026-10-01',
      summary: `Controlled Unclassified Information (CUI) stays in approved systems.`,
      points: [
        `DFARS 252.204-7012 and CMMC require CUI to stay in environments approved for it. General commercial AI plans usually are not.`,
      ],
      red_line: `CUI in any tool not approved for CUI.`,
      advice: `Your contract may require you to report incidents quickly. Ask your contracting officer or advisor.`,
    },
    trades: {
      last_reviewed: '2026-10-01',
      summary: `Customer drawings, and outputs that affect safety.`,
      points: [
        `Customer drawings and specifications belong to the customer.`,
        `Estimates, load calculations and safety checks must be checked by a qualified person.`,
      ],
      red_line: `Safety-relevant output with no qualified check.`,
      advice: `Check what your contracts say about sharing customer documents.`,
    },
    creative: {
      last_reviewed: '2026-10-01',
      summary: `Client work, ownership and telling clients.`,
      points: [
        `Unreleased or embargoed client work should not go into a plan that may train on it.`,
        `Agree with clients in advance on who owns AI-generated work, and whether you will tell them when AI was used.`,
      ],
      red_line: `Embargoed client material on a plan that may train on it.`,
      advice: `Check your client contracts for rules on AI and confidentiality.`,
    },
  },
};
