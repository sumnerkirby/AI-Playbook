/* Questions for the quick check: A, the red-flag screener, and B, tap what
   you do. Data only; quick_engine.js decides what is shown and rules.js
   decides what each answer means.
   Designs: exploratory/quick_questionnaires/01_red_flag_screener.md and
   02_tap_what_you_do.md.

   Conditions (show_if, applies_to) use the same small language as the rules:
     {q: 'id', in: ['answer', ...]}   {all: [...]}   {any: [...]}
   Every question and answer has a one-character code, used to write answers
   into the link (after the #) so a result can be reopened without saving. */

var YES_NO_NOT_SURE = [
  {id: 'yes',      code: 'y', label: `Yes`},
  {id: 'no',       code: 'n', label: `No`},
  {id: 'not_sure', code: 'u', label: `Not sure`},
];

var SCREENER = {
  title: `Red-flag screener`,
  minutes: `2 minutes`,
  questions: [
    {id: 'q1', code: '1',
     text: `Do you or anyone in the business put **customer, client or staff details** into an AI tool on a **personal or free account**?`,
     example: `Pasting a customer's email into the free version of ChatGPT to draft a reply.`,
     hint: `The type of account matters, not who pays for it. A personal plan paid for by the business is still a personal account.`,
     answers: YES_NO_NOT_SURE},
    {id: 'q2', code: '2',
     text: `Has anyone put **passwords, card numbers, Social Security numbers or bank account numbers** into an AI tool?`,
     example: `Asking AI to fill in a form with someone's card details.`,
     answers: YES_NO_NOT_SURE},
    {id: 'q3', code: '3',
     text: `Can any AI tool **send, post, pay, book or delete** things **without a person clicking to approve**?`,
     example: `An assistant that replies to email for you, or an automation that pays invoices.`,
     answers: YES_NO_NOT_SURE},
    {id: 'q4', code: '4',
     text: `Does AI help decide **who gets hired, approved, or turned down**?`,
     example: `A tool that ranks job applicants, or scores people for credit, housing, insurance or services.`,
     answers: YES_NO_NOT_SURE},
    {id: 'q4b', code: 'd', follow_up_of: 'q4',
     show_if: {q: 'q4', in: ['yes']},
     text: `Does **a person make the final decision** every time?`,
     example: `A person reads the application and makes the decision. The AI only prepares information.`,
     answers: YES_NO_NOT_SURE},
    /* Worded to match the tool check's red line (public or link-shared AND
       given personal or confidential documents), so a flag here means the
       same thing as a red there. The design note's wording flagged any of
       your own documents, including a public price list. */
    {id: 'q5', code: '5',
     text: `Can people outside your business use an AI chatbot or assistant that **has access to non-public documents**?`,
     example: `A website chatbot that answers visitors' questions using client files or internal notes.`,
     answers: YES_NO_NOT_SURE},
    {id: 'q6', code: '6',
     text: `Does anything **record or transcribe** calls or meetings **without people being told**?`,
     example: `Meeting summaries switched on in your video-call app.`,
     hint: `Many video-call apps now summarize meetings automatically.`,
     answers: YES_NO_NOT_SURE},

    /* Optional seventh question, one per industry. Only shown if the visitor
       picked that industry on the first screen. */
    {id: 'q7_healthcare', code: '7',
     applies_to: {industry: ['healthcare']},
     text: `Does **patient information** go into an AI tool **without a business associate agreement (BAA)** that covers it?`,
     example: `Dictating patient notes into a general AI assistant.`,
     answers: YES_NO_NOT_SURE},
    {id: 'q7_finance', code: '7',
     applies_to: {industry: ['finance']},
     text: `Does **client financial information** go into an AI tool **without a data agreement** with the supplier?`,
     example: `Pasting a client's statements into an AI tool to summarize them.`,
     answers: YES_NO_NOT_SURE},
    {id: 'q7_defense', code: '7',
     applies_to: {industry: ['defense']},
     text: `Does **government contract information (CUI)** go into an AI tool **not approved for it**?`,
     example: `Summarizing a contract specification in a general AI assistant.`,
     answers: YES_NO_NOT_SURE},
  ],
};

/* ---------- B. tap what you do ---------- */

var CARD_QUESTIONS = {
  data: {code: 'd', short: `What goes in`,
    text: `What goes in?`,
    answers: [
      {id: 'none',      code: 'n', label: `Nothing personal`,          detail: `Public or general business information`},
      {id: 'customer',  code: 'c', label: `Customer or staff details`, detail: `Names, emails, notes about people`},
      {id: 'sensitive', code: 's', label: `Sensitive details`,         detail: `Money, health, ID numbers, anything about children`},
      {id: 'not_sure',  code: 'u', label: `Not sure`},
    ]},
  account: {code: 'a', short: `Account`,
    show_if: {q: 'data', in: ['customer', 'sensitive', 'not_sure']},
    text: `Which kind of account is it on?`,
    hint: `What matters is the type of plan, not who pays for it.`,
    answers: [
      {id: 'business', code: 'b', label: `A business or team plan`,    detail: `Including AI built into business software the business pays for`},
      {id: 'personal', code: 'p', label: `A personal or free account`, detail: `Even if the business pays for it`},
      {id: 'not_sure', code: 'u', label: `Not sure`},
    ]},
  acts: {code: 'x', short: `Acts on its own`,
    text: `Can it act on its own?`,
    answers: [
      {id: 'suggests',       code: 's', label: `It only suggests`,        detail: `A person does the sending, paying or booking`},
      {id: 'after_approval', code: 'a', label: `It acts after I approve`, detail: `It asks each time before it does something`},
      {id: 'without_asking', code: 'w', label: `It acts without asking`,  detail: `It sends, pays, books or deletes by itself`},
      {id: 'not_sure',       code: 'u', label: `Not sure`},
    ]},
  person_decides: {code: 'p', short: `A person decides`,
    text: `Does a person make the final decision?`,
    answers: YES_NO_NOT_SURE},
  nyc_co: {code: 'l', short: `Hires in NYC or Colorado`,
    text: `Do you hire in New York City or Colorado?`,
    hint: `Both have their own rules for AI used in hiring.`,
    answers: YES_NO_NOT_SURE},
  told: {code: 't', short: `People told`,
    text: `Are people told that it is happening?`,
    hint: `Told at the start, with a way to decline.`,
    answers: YES_NO_NOT_SURE},
  says_ai: {code: 'i', short: `Says it is an AI`,
    text: `Does it say that it is an AI, and can people reach a person?`,
    answers: YES_NO_NOT_SURE},
};

var CARDS = {
  title: `Everyday tasks`,
  minutes: `5 to 8 minutes`,
  cards: [
    {id: 'writing',      code: 'wr', label: `Writing emails, letters or documents`, hint: `Including Copilot or Gemini features in your email`,           questions: ['data', 'account']},
    {id: 'summarizing',  code: 'su', label: `Summarizing long documents`,           hint: `Contracts, statements, reports`,                              questions: ['data', 'account']},
    {id: 'meetings',     code: 'mt', label: `Meeting notes or call transcripts`,    hint: `Many video-call apps now do this automatically`,              questions: ['told', 'data', 'account']},
    {id: 'customers',    code: 'cu', label: `Answering customers (chat or email)`,  hint: `A chatbot on your website or booking page`,                   questions: ['says_ai', 'data', 'account']},
    {id: 'marketing',    code: 'mk', label: `Marketing: posts, images, ads`,        hint: `Including AI features in design apps`,                        questions: ['data', 'account']},
    {id: 'bookkeeping',  code: 'bk', label: `Bookkeeping, invoices or receipts`,    hint: `Reading receipts, categorizing spending`,                     questions: ['acts', 'data', 'account']},
    {id: 'inbox',        code: 'ib', label: `Handling your inbox or calendar`,      hint: `Assistants that sort, reply or schedule`,                     questions: ['acts', 'data', 'account']},
    {id: 'hiring',       code: 'hi', label: `Hiring or managing staff`,             hint: `Screening applicants, writing job ads, scheduling shifts`,    questions: ['person_decides', 'nyc_co']},
    {id: 'research',     code: 'rs', label: `Research and searching`,               hint: `Asking an AI tool instead of using a search engine`,                           questions: ['data', 'account']},
    {id: 'spreadsheets', code: 'sp', label: `Spreadsheets and numbers`,             hint: `Formulas, analysis, forecasts`,                               questions: ['data', 'account']},
    {id: 'website',      code: 'wb', label: `Building or editing your website or code`, hint: `Website builders with AI, coding assistants`,            questions: ['data', 'account']},
    {id: 'phone',        code: 'ph', label: `Answering the phone`,                  hint: `AI receptionists or voice assistants`,                        questions: ['told', 'acts', 'data', 'account']},

    /* Trial card from the design note's trade-offs: browser add-ons are the
       AI the walkthrough's owner missed. Test whether it earns its place. */
    {id: 'extensions',   code: 'ex', label: `Browser add-ons that help you write or check spelling`, hint: `They can often read every page you open`, questions: ['data', 'account'], trial: true},

    /* Industry cards, shown only for that industry */
    {id: 'patient_notes',   code: 'pn', label: `Patient notes or letters`,    hint: `Clinical notes, referral letters, appointment summaries`, questions: ['data', 'account'], applies_to: {industry: ['healthcare']}},
    {id: 'client_planning', code: 'cp', label: `Client reviews and planning`, hint: `Portfolio reviews, financial plans, meeting prep`,        questions: ['data', 'account'], applies_to: {industry: ['finance']}},
  ],

  /* on the results, when the chosen industry has no question or card of its own */
  industry_general: `No extra questions for this industry yet; the general rules apply.`,
  /* shown on the result instead of industry_general; a flag to check with an
     advisor, not a conclusion (log item 49; pending in notes/verification_log.md) */
  industry_advice: {
    professional: `Client confidentiality rules apply to client files in AI tools: your professional body's guidance, and for tax preparers the IRS rules on using taxpayer information. Check with an advisor.`,
  },

  none_nudge: {
    text: `AI is often added without anyone choosing it. Do any of these apply to your business?`,
    places: [
      `AI features in your email or documents (Copilot, Gemini)`,
      `Meeting summaries in your video-call app`,
      `Browser add-ons that help with writing or spelling`,
      `New AI features in booking, accounting or customer software`,
      `Staff using AI on their own phones or personal accounts`,
    ],
  },
};
