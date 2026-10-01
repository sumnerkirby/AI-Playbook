/* The playbook's "You're done when you can answer" questions, each with a
   short answer field, and the record section each answer feeds. Data only;
   answers_engine.js keeps the answers, done_when.js draws the fields.
   Design: exploratory/feature_concepts/07_ai_use_and_risk_record.md

   The wording must match playbook.html exactly (a terminal test checks it), so
   the fields always sit under the question they answer. Typed answers are
   for what only the owner knows: names, contacts, decisions. Where a tool
   already answers a question, `from` points to it. */

var DONE_WHEN = {
  version: '2026.09.1-done-when',
  last_reviewed: '2026-09-29',
  /* a control is Confirmed while its last re-confirmation is this recent */
  confirm_days: 92,
  steps: [
    {step: '1', control: `One person is in charge of AI`, questions: [
      {id: 's1.decides', record: 'responsibility', role: 'decides', text: `Who decides whether a new AI tool can be used?`, placeholder: `Name or role`},
      {id: 's1.ask', record: 'responsibility', role: 'ask', text: `If someone isn’t sure whether something is allowed, who do they ask?`, placeholder: `Name or role, and how to reach them`},
      {id: 's1.saturday', record: 'responsibility', role: 'out_of_hours', text: `Who would you call if an AI tool caused a problem on a Saturday?`, placeholder: `Name and phone`},
    ]},
    {step: '2', control: `We know what AI we use`, from: {href: 'tool_check.html', text: `Your AI list answers much of this.`}, questions: [
      {id: 's2.count', record: 'discovery', text: `How many AI tools are in use, and which of them are on personal accounts?`},
      {id: 's2.people', record: 'discovery', text: `Which ones receive information about customers or staff?`},
      {id: 's2.features', record: 'discovery', text: `Which AI features are switched on in software you already pay for?`},
    ]},
    {step: '3', control: `Our AI rules are written down`, from: {href: 'quick_policy.html', text: `A saved policy answers the first question.`}, questions: [
      {id: 's3.find', record: 'rules', text: `Could a new employee find out in five minutes which AI tools they can use, and what they must not put into them?`, placeholder: `Where they would look`},
      {id: 's3.read', record: 'rules', text: `Has everyone read the current version?`, placeholder: `Who has, and when`},
      {id: 's3.updated', record: 'rules', kind: 'date', text: `When was it last updated?`},
    ]},
    {step: '4', control: `Sensitive information stays out`, questions: [
      {id: 's4.training', record: 'suppliers', text: `For each tool that receives customer information, do you know whether it’s used for training, and where the terms say so?`},
      {id: 's4.never', record: 'rules', text: `Does everyone know what must never be pasted into an AI tool?`},
      {id: 's4.leaver', record: 'rules', text: `If someone left tomorrow, would their AI conversations about customers leave with them?`},
    ]},
    {step: '5', control: `Suppliers are checked`, from: {href: 'tool_check.html', text: `The tool check keeps each supplier’s answers.`}, questions: [
      {id: 's5.show', record: 'suppliers', text: `For each important tool, could you show someone the supplier’s answers?`},
      {id: 's5.exit', record: 'suppliers', text: `What would you do if the supplier shut down, or changed its terms, tomorrow?`},
    ]},
    {step: '6', control: `AI’s work is checked`, questions: [
      {id: 's6.human', record: 'rules', text: `Which kinds of work always get a human check, and does everyone know?`},
      {id: 's6.decisions', record: 'rules', text: `Is AI involved in any decision about a customer or an employee? If so, who makes the final call?`},
    ]},
    {step: '7', control: `What AI can do is limited`, from: {href: 'tool_check.html', text: `Your AI list shows which tools can act.`}, questions: [
      {id: 's7.acts', record: 'controls', text: `Which AI tools can act on your behalf rather than just answer, and what can each one reach?`},
      {id: 's7.limit', record: 'controls', text: `What’s the most an AI tool could spend, or send, without a person approving it?`},
    ]},
    {step: '8', control: `We’re ready when it goes wrong`, questions: [
      {id: 's8.pasted', record: 'incidents', text: `If someone pasted customer data into the wrong tool this afternoon, what would they do next?`},
      {id: 's8.off', record: 'controls', text: `Who can switch off each important tool, and do they know how?`},
      {id: 's8.notify', record: 'incidents', text: `Who would you have to notify, and by when?`},
    ]},
    {step: '9', control: `We review regularly`, questions: [
      {id: 's9.when', record: 'reviews', text: `When was the last review, and when is the next one?`,
       parts: [{id: 'last', label: `Last review`, kind: 'date'}, {id: 'next', label: `Next review`, kind: 'date'}]},
      {id: 's9.changed', record: 'reviews', text: `What has changed since the last one?`},
    ]},
  ],
  /* one optional note per step: how the owner knows it's in place */
  evidence: {label: `How do you know? (optional)`, placeholder: `For example: checked and wrote it down on June 5`},
  max_length: 600,
};
