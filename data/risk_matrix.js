/* The risk matrix: levels, zones, and the rules that suggest a position
   from the tool-check answers. Data only; risk_engine.js applies them.
   Design: exploratory/feature_concepts/06_risk_matrix.md

   3 x 3, Low / Moderate / High, named zones, no multiplied score.
   Positions are suggested from facts; the owner can move one, with a
   reason. The likelihood thresholds are a starting point to calibrate in a
   pilot, not validated values. */

var RISK = {
  version: '2026.10.1-risk',
  last_reviewed: '2026-10-03',
  levels: ['low', 'moderate', 'high'],
  level_labels: {low: `Low`, moderate: `Moderate`, high: `High`},

  /* zone by impact (rows) and likelihood (columns) */
  zones: {
    high:     {low: 'plan',  moderate: 'act',   high: 'act'},
    moderate: {low: 'watch', moderate: 'plan',  high: 'act'},
    low:      {low: 'watch', moderate: 'watch', high: 'plan'},
  },
  zone_labels: {act: `Act now`, plan: `Plan`, watch: `Watch`},
  zone_order: ['act', 'plan', 'watch'],

  /* impact: the highest level any answer reaches. Conditions read the
     tool-check answers (list answers match if any item does). */
  impact: [
    {level: 'high', why: `Sensitive or regulated information`, when: {any: [{q: 'data', in: ['sensitive', 'regulated', 'secrets']}, {q: 'special', in: ['yes', 'dont_know']}]}, types: ['leak', 'supplier']},
    {level: 'high', why: `Helps make a decision about a person`, when: {any: [{q: 'output', in: ['person']}, {q: 'use', in: ['hiring']}]}, types: ['wrong_output', 'unfair']},
    {level: 'high', why: `Can send, pay or delete`, when: {q: 'acts', in: ['acts']}, types: ['unwanted_action']},
    {level: 'high', why: `Safety-relevant output`, when: {q: 'safety', in: ['yes']}, types: ['wrong_output']},
    {level: 'moderate', why: `Customer or staff details`, when: {q: 'data', in: ['personal']}, types: ['leak', 'supplier']},
    {level: 'moderate', why: `Output reaches customers or the public`, when: {q: 'output', in: ['customers']}, types: ['wrong_output']},
    {level: 'moderate', why: `Can read email, files or accounts`, when: {q: 'acts', in: ['reads']}, types: ['unwanted_action', 'leak']},
    {level: 'moderate', why: `Internal business information`, when: {q: 'data', in: ['internal', 'dont_know']}, types: ['leak', 'supplier']},
  ],

  /* likelihood factors. `now: false` means the factor only counts before
     the to-dos: a done to-do (done) or a standing rule removes it now.
     Facts available: the answers, _team, _mode, _done (to-do ids done),
     _sourced (supplier questions with a source noted), _unsourced. */
  /* A personal account only raises likelihood when something private goes
     in: with public information only, the account's data handling doesn't
     matter (calibrated with the user, 2026-09-29, for Dana's public writing). */
  raises: [
    {id: 'personal_plan', why: `Personal or free account, and something private goes in`,
     when: {all: [{q: 'plan', in: ['free_personal', 'paid_personal']}, {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']}]}},
    {id: 'dont_know', why: `A Not sure answer to a supplier or plan question`, when: {any: [
      {q: 'plan', in: ['dont_know']}, {q: 'training', in: ['dont_know']}, {q: 'deletion', in: ['dont_know']},
      {q: 'agreement', in: ['dont_know']}, {q: 'published', in: ['dont_know']}, {q: 'location', in: ['dont_know']}]}},
    {id: 'acts_unapproved', why: `Can act, and not every risky action needs approval`, when: {all: [{q: 'acts', in: ['acts']}, {q: 'approval', in: ['some', 'none', 'dont_know']}]}},
    {id: 'public', why: `Public-facing, or shared by a public link`, when: {any: [{q: 'direct', in: ['yes']}, {q: 'own_access', in: ['public']}]}},
    {id: 'unpublished', why: `Browser add-on, or a supplier that does not publish its data handling`, when: {any: [{q: 'access', in: ['extension']}, {q: 'published', in: ['no']}]}},
    {id: 'discovered', why: `Found already in use, with no rules yet`, when: {q: '_mode', in: ['discovered']}, cleared_by_standing: true},
    {id: 'team_no_rules', why: `Several people use it with no written rules`, when: {q: '_team', in: ['small', 'medium', 'large']}, cleared_by: 't.team.tell'},
  ],
  lowers: [
    /* lowers likelihood only. Impact comes from what goes in, never from
       the plan, so a business plan does not make patient, client-confidential
       or government contract information less serious (FIXES 1.3; tested) */
    {id: 'business_training_off', why: `Business plan, training off, with a source noted`,
     when: {all: [{q: 'plan', in: ['business', 'enterprise', 'built_in', 'own']}, {q: 'training', in: ['no_checked']}, {q: '_sourced', in: ['training']}]}},
    {id: 'human_check', why: `A person checks output before it leaves`, when: {q: '_done', in: ['t.output.customers']}},
    {id: 'all_approved', why: `Every risky action needs approval`, when: {q: 'approval', in: ['all']}},
    {id: 'least_access', why: `Access limited to what it needs`, when: {any: [{q: '_done', in: ['t.reads']}, {q: 'own_access', in: ['me']}]}},
    {id: 'sourced', why: `Supplier answers recorded with sources`, when: {all: [{q: '_sourced_any', in: ['yes']}, {q: '_unsourced_any', in: ['no']}]}},
    {id: 'only_public', why: `Nothing personal or confidential goes in`,
     when: {all: [{q: 'data', in: ['public']}, {not: {q: 'data', in: ['internal', 'personal', 'sensitive', 'regulated', 'secrets', 'dont_know']}}]}},
    {id: 'team_told', why: `The team has been told the rules`, when: {all: [{q: '_team', in: ['small', 'medium', 'large']}, {q: '_done', in: ['t.team.tell']}]}},
  ],
  /* High if two or more raise it; Low if none raise it and two or more
     lower it; otherwise Moderate */
  thresholds: {high_raises: 2, low_lowers: 2},

  types: [
    {id: 'leak',            label: `Information leaks out`},
    {id: 'wrong_output',    label: `Wrong output reaches someone`},
    {id: 'unwanted_action', label: `AI takes an action nobody wanted`},
    {id: 'supplier',        label: `Supplier problem (terms change, breach, shutdown)`},
    {id: 'unfair',          label: `Unfair or unlawful decision about a person`},
    {id: 'used_against',    label: `AI used against us`},
    {id: 'other',           label: `Something else`},
  ],

  responses: [
    {id: 'mitigate', label: `Reduce it`, detail: `Do the to-dos and keep the standing rules`},
    {id: 'avoid',    label: `Stop or change the use`, detail: `For example, stop putting patient details in`},
    {id: 'transfer', label: `Share it`, detail: `Contract terms or insurance. This is only partly possible, because reputational harm cannot be shared`},
    {id: 'accept',   label: `Accept it`, detail: `You approve it, with a reason and a review date. Not available where a red line is crossed`},
  ],

  /* for risks not tied to a tool: the only place the owner rates directly */
  describe: {
    impact: {low: `An inconvenience, fixed within a day, with nobody outside the business affected`,
             moderate: `Costs significant time or money, affects a customer, or causes embarrassment`,
             high: `Legal liability, serious harm to someone, loss of important data, or a threat to the business`},
    likelihood: {low: `Unlikely to happen this year`, moderate: `Could happen this year`, high: `Likely to happen this year, or has already happened`},
  },

  /* suggestions for business-wide risks; the owner picks and rates */
  suggestions: [
    {id: 'payment_change', type: 'used_against', industry: '*',
     title: `Someone impersonates a supplier or the owner (voice or email) to change bank details`,
     control: `Confirm any change to bank details by calling back on a number you already have, never one in the message.`},
    {id: 'client_money', type: 'used_against', industry: ['finance'],
     title: `Someone impersonates a client (voice or email) to request a money movement`,
     control: `Confirm any request to move money by calling the client back on the number already on file.`},
    {id: 'patient_info', type: 'used_against', industry: ['healthcare'],
     title: `Someone uses a cloned voice or fake email to get patient information`,
     control: `Verify identity using details already on file before sharing anything.`},
    {id: 'cant_answer', type: 'other', industry: '*',
     title: `Customers ask how we use AI and we cannot answer`,
     control: `Keep a short, honest answer ready, taken from your AI policy.`},
    {id: 'key_person', type: 'other', industry: '*',
     title: `The one person who understands our automations leaves`,
     control: `Write down what each automation does, who owns it, and how to switch it off.`},
  ],
};
