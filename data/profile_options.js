/* Business profile options. Data, not logic: the quick check and (later) the
   profile page both read this. US only for version 1, so there is no region
   question; rules carry applies_to.region so UK and EU can be added later.
   Design: exploratory/feature_concepts/01_profile_questions.md.
   Loaded as a .js file (not .json) so pages still work opened from disk. */

var PROFILE_OPTIONS = {
  profile_version: 3,
  last_reviewed: '2026-10-01',

  /* answers saved before version 3 that are no longer offered (Oct 4, 2026:
     the site covers up to 50 people, and no longer covers healthcare,
     education or defense contracting) */
  retired: {team_size: {large: 'medium'}, industry: {healthcare: 'other', education: 'other', defense: 'other'}},

  team_size: {
    label: `Who uses AI for work in your business?`,
    why: `The site is written for businesses of up to 50 people. If you work alone, it leaves out the steps meant for a team.`,
    options: [
      {id: 'solo',   code: 's', label: `Just me`,                              summary: `Just me`},
      {id: 'small',  code: 't', label: `Me and a small team (2 to 10 people)`, summary: `Small team`},
      {id: 'medium', code: 'm', label: `A bigger team (11 to 50 people)`,      summary: `Team of 11 to 50`},
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
    why: `Some industries have extra rules about information that goes into AI tools. The site does not cover the rules for healthcare, education or government contracting.`,
    options: [
      {id: 'professional', code: 'pr', label: `Legal, accounting and professional services`,
       examples: `Law firms, bookkeepers, tax preparers, consultants, architects`},
      {id: 'finance',      code: 'fi', label: `Finance and insurance`,
       examples: `Brokers, insurance agents, small lenders, financial advisers`},
      {id: 'retail',       code: 're', label: `Retail, e-commerce and hospitality`,
       examples: `Shops, online sellers, restaurants, hotels`},
      {id: 'hiring',       code: 'hi', label: `Hiring and staffing`,
       examples: `Recruiters, staffing agencies`},
      {id: 'trades',       code: 'tr', label: `Trades, construction and manufacturing`,
       examples: `Builders, electricians, HVAC, small manufacturers`},
      {id: 'creative',     code: 'cr', label: `Creative, marketing and media`,
       examples: `Agencies, designers, photographers, writers`},
      {id: 'other',        code: 'ot', label: `Something else`,
       examples: `The general guidance, with no industry notes`},
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

  /* short words for the summary bar ("Just me · Ready-made tools · Finance") */
  path_summary: {use: `Ready-made tools`, configure: `Tools you set up`, build: `Code you write`, none: `No AI yet`},
  industry_summary: {
    professional: `Professional services`, finance: `Finance`, retail: `Retail`,
    hiring: `Hiring`, trades: `Trades`, creative: `Creative`, other: `Other`,
  },

  /* Industry overlays: what's different, as things to check with an advisor,
     never legal conclusions. Each needs verifying before publication.
     seek_advice and links: the Get advice banner for a regulated industry,
     shown on step 0 of the playbook, the quick check result and the tool
     check result (FIXES 1.4). Links go to government or standards bodies,
     each opened and checked on the date in links_checked. */
  overlays_verified: false,
  links_checked: '2026-10-03',
  general_help: {
    text: `Free help for any small business: the SBA's cybersecurity guidance, and the Small Business Development Center in your state.`,
    links: [
      {title: `SBA: Strengthen your cybersecurity`, href: `https://www.sba.gov/counseling/manage-your-business/#strengthen-your-cybersecurity`},
      {title: `Oklahoma Small Business Development Centers`, href: `https://www.oksbdc.org/`},
    ],
  },
  overlays: {
    professional: {
      last_reviewed: '2026-10-01',
      summary: `Client confidentiality comes first.`,
      points: [
        `Lawyers: ABA Formal Opinion 512 (2024) covers competence, confidentiality and when client consent is needed for generative AI.`,
        `Tax preparers: rules on using and disclosing tax return information (IRC section 7216) and the FTC Safeguards Rule may apply.`,
      ],
      red_line: `Client-confidential material on a plan that may train on it.`,
      advice: `Check your professional association's guidance on AI, and your engagement letters.`,
      seek_advice: `Client confidentiality rules apply to client files in AI tools. Check your professional body's guidance before using AI with client work.`,
      links: [
        {title: `American Bar Association: Formal Opinion 512, its first ethics guidance on AI tools`, href: `https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/`},
        {title: `IRS: Publication 4557, Safeguarding taxpayer data (PDF)`, href: `https://www.irs.gov/pub/irs-pdf/p4557.pdf`},
      ],
    },
    finance: {
      last_reviewed: '2026-10-01',
      summary: `Customer financial information is regulated.`,
      points: [
        `Customer financial information is covered by the Gramm-Leach-Bliley Act. Non-bank firms are generally subject to the FTC Safeguards Rule.`,
        `If AI helps with credit decisions, adverse-action notices still need specific reasons (Equal Credit Opportunity Act and Regulation B). The CFPB withdrew its 2022 guidance on AI and adverse action in May 2025; the requirement in Regulation B did not change.`,
        `AI outputs such as meeting notes and client summaries may count as business records you have to keep.`,
        `Investment advisers registered with the SEC: Regulation S-P (as amended in 2024) covers safeguarding customer information and notice of incidents. State-registered advisers follow their state regulator's rules.`,
      ],
      red_line: `AI helping decide credit or cover with no person deciding.`,
      advice: `Ask your compliance consultant which rules apply to your business.`,
      seek_advice: `Customer financial information is covered by federal rules. Check your AI tools against the FTC Safeguards Rule, or your regulator's rules, with your compliance consultant.`,
      links: [
        {title: `FTC: Safeguards Rule, what your business needs to know`, href: `https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know`},
      ],
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
      seek_advice: `AI that screens or ranks people is regulated in some places. Get advice before using it in hiring, especially in New York City, Illinois or Colorado.`,
      links: [
        {title: `New York City: Automated employment decision tools`, href: `https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page`},
        {title: `Illinois General Assembly: Public Act 103-0804, AI in employment decisions`, href: `https://www.ilga.gov/Legislation/publicacts/view/103-0804`},
      ],
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
