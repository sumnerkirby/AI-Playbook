/* The AI use and risk record: section titles, fixed statements, and what an
   empty section says. Data only; record_engine.js assembles the record from
   everything else the site keeps.
   Design: exploratory/feature_concepts/07_ai_use_and_risk_record.md

   Principles: it only states what was recorded; gaps are shown, not hidden;
   claims carry evidence and dates; it says it's self-attested; the owner
   changes the answers, never the document. Version 1 is the full record
   only (the shareable summary waits for testing, decided 2026-09-29). */

var RECORD = {
  version: '2026.09.1-record',
  last_reviewed: '2026-09-29',
  title: `AI use and risk record`,

  statement: `This record is a self-assessment made with a free online playbook. It is not a certification, an audit or legal advice. It states only what {business} recorded, and {business} is responsible for its accuracy. Anything not yet completed is marked as such.`,
  scope: `It covers AI tools used by staff for work, and AI features in software the business pays for.`,
  not_covered: `It does not cover the business’s wider IT security, and it does not show compliance with any law, contract or framework.`,
  business_fallback: `This business`,

  /* a record stays a Draft until these sections have enough */
  minimum: ['responsibility', 'discovery', 'ai_in_use', 'rules'],
  /* a record older than this, or past a re-check date, should be generated again */
  stale_after_months: 3,

  sections: [
    {id: 'about',          n: '1',  title: `About this record`},
    {id: 'summary',        n: '2',  title: `Summary`},
    {id: 'responsibility', n: '3',  title: `Who is responsible`,
     empty: `Not yet completed. Answer the questions in step 1 of the playbook.`, fix: 'playbook.html#step-1'},
    {id: 'discovery',      n: '4',  title: `How we found our AI`,
     empty: `Not yet completed. Save a quick check, or answer the questions in step 2 of the playbook.`, fix: 'quick_check.html',
     limit: `No full discovery sweep has been done. The entries listed here came from the quick check, the monthly check-ins and the owner’s own answers.`},
    {id: 'ai_in_use',      n: '5',  title: `AI in use`,
     empty: `Not yet completed. Check at least one tool in the tool check.`, fix: 'tool_check.html'},
    {id: 'rules',          n: '6',  title: `Rules we follow`,
     empty: `Not yet completed. Create and save a policy with the AI policy tool.`, fix: 'quick_policy.html'},
    {id: 'suppliers',      n: '7',  title: `Suppliers`,
     empty: `Not yet completed. The tool check asks the supplier questions for any tool that receives more than public information.`, fix: 'tool_check.html'},
    {id: 'risk',           n: '8',  title: `Risk assessment`,
     empty: `Not yet completed. Check a tool, or add a business-wide risk on the risk overview.`, fix: 'risk_matrix.html'},
    {id: 'controls',       n: '9',  title: `Controls in place`},
    {id: 'actions',        n: '10', title: `Open actions`,
     none: `No open actions.`},
    {id: 'incidents',      n: '11', title: `Incidents and changes`,
     none: `Nothing recorded as going wrong, and no changes logged against a tool.`},
    {id: 'reviews',        n: '12', title: `Reviews and sign-off`},
    {id: 'framework',      n: 'A',  title: `Where each control comes from`, appendix: true},
    {id: 'industry',       n: 'B',  title: `Industry notes`, appendix: true,
     none: `No industry notes for the industry in the business profile.`},
    {id: 'policy_text',    n: 'C',  title: `Our AI policy in full`, appendix: true,
     none: `No policy saved yet.`},
  ],

  levels: {
    recorded:  {label: `Recorded`,  detail: `Marked done, with every question answered`},
    supported: {label: `Supported`, detail: `Recorded, with a note on how we know`},
    confirmed: {label: `Confirmed`, detail: `Re-confirmed at a review in the last three months`},
    none:      {label: `Not yet`,   detail: `Not marked done, or not every question answered`},
  },
  roles: {decides: `Decides on new AI tools`, ask: `Whom to ask if unsure`, out_of_hours: `Out of hours`},

  /* what a saved file can hold, as the import message names it */
  parts: {profile: `business profile`, answers: `playbook answers`, done: `steps marked done`, ai_list: `AI list`, risk: `risk overview`,
    policy: `AI policy`, quick: `quick check`, pulse: `monthly check-ins`, record: `record name, copies and sign-off`},

  signoff: `I confirm that this record reflects how {business} uses AI as of {date}, to the best of my knowledge.`,
  signoff_stale: `Signed for an earlier version. Something has changed since then, so it must be signed again.`,
  word_stamp: `Generated {date} from the AI playbook (record {record_version}, tool rules {rules_version}). Edits made in this Word file do not update the record.`,

  /* Appendix A: the sources each playbook step quotes (playbook.html, Where
     this comes from). A terminal test keeps this list matched to the page. */
  framework: {
    '1': [`AI RMF Playbook: GOVERN 2.3`],
    '2': [`AI RMF Playbook: GOVERN 1.6`, `Generative AI Profile: GOVERN 1.6`, `AI RMF Playbook: MAP 1.1`],
    '3': [`AI RMF Playbook: GOVERN 1.4`, `AI RMF Playbook: GOVERN 2.2`],
    '4': [`Generative AI Profile: 2.4 Data Privacy`, `OWASP Top 10: LLM02:2026`],
    '5': [`AI RMF Playbook: GOVERN 6.1`, `Generative AI Profile: 2.12 Value Chain and Component Integration`, `AI RMF Playbook: MAP 4.1`],
    '6': [`Generative AI Profile: 2.2 Confabulation`, `Generative AI Profile: 2.7 Human-AI Configuration`, `OWASP Top 10: LLM07:2026`, `AI RMF Playbook: MAP 3.5`],
    '7': [`OWASP Top 10: LLM01:2026`, `OWASP Top 10: LLM03:2026`, `OWASP Top 10: LLM06:2026`],
    '8': [`AI RMF Playbook: GOVERN 1.5`, `AI RMF Playbook: MANAGE 2.4`, `AI RMF Playbook: MANAGE 4.3`],
    '9': [`AI RMF Playbook: GOVERN 1.5`, `AI RMF 1.0: Section 5.3`, `AI RMF Playbook: MEASURE 3.1`, `AI RMF 1.0: Section 5`],
  },
};
