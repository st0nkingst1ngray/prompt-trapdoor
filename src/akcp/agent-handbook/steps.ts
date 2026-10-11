import type { AkcpActivity } from '../types'

/** The article stays on freeCodeCamp. These drills use original prompts. */
export const AGENT_HANDBOOK_URL =
  'https://www.freecodecamp.org/news/how-to-build-optimal-ai-agents-that-actually-work-a-handbook-for-devs/'

export const AGENT_HANDBOOK_CREDIT =
  'Tiago Capelo Monteiro, freeCodeCamp, 11 May 2026. The handbook stays on their site.'

export interface HandbookStep {
  id: string
  title: string
  briefing: string
  activity: AkcpActivity
}

const CONSTRAINTS = 'One decision. A wrong team shape costs more than a wrong sentence.'

export const HANDBOOK_STEPS: HandbookStep[] = [
  {
    id: 'budget',
    title: 'Check the bill first',
    briefing:
      'An agent spends tokens, and tokens are a bill. Before you design a team, decide where the first model runs and whether every extra call is allowed to cost money.',
    activity: {
      id: 'budget',
      kind: 'checklist',
      title: 'Check the bill first',
      goal: 'Pick the setup that fits a tight first demo.',
      constraints: CONSTRAINTS,
      nextAction: 'Flag the two choices that keep the first run cheap and visible.',
      tip: 'Start where the model is already paid for by the machine you have, and count every extra call. A paid frontier API and a four-agent team can wait until you have a score.',
      covers: ['budget'],
      stat: 'planning',
      maxAttempts: 5,
      options: [
        { id: 'local', label: 'Run the first model on hardware you already have' },
        { id: 'cost', label: 'Treat every extra model call as money' },
        { id: 'frontier', label: 'Send every draft to a paid frontier API before any score exists' },
        { id: 'team', label: 'Staff four agents before the first measurement' },
      ],
      correct: ['local', 'cost'],
    },
  },
  {
    id: 'one',
    title: 'Start with one agent',
    briefing:
      'The first build is one agent doing the whole job. You measure it, you try to improve that same agent, and only then do you ask whether a team is even the right shape.',
    activity: {
      id: 'one',
      kind: 'order',
      title: 'Start with one agent',
      goal: 'Put the decision in the order that keeps you from hiring a team too early.',
      constraints: CONSTRAINTS,
      nextAction: 'Move the steps until the single agent is scored before anyone talks about a team.',
      tip: 'One agent, then a score, then an attempt to fix that agent. Splitting the job is the last question, and a weak score is not by itself a reason to split.',
      covers: ['one'],
      stat: 'planning',
      maxAttempts: 5,
      steps: [
        { id: 'split', label: 'Split the job across a team' },
        { id: 'fix', label: 'Improve that agent’s prompt, tools, or model' },
        { id: 'single', label: 'Give the whole job to one agent' },
        { id: 'score', label: 'Score it on tasks you held out' },
      ],
      correct: ['single', 'score', 'fix', 'split'],
    },
  },
  {
    id: 'measure',
    title: 'Measure before you multiply',
    briefing:
      'A single agent that already clears a bar you wrote down does not need a team. A score under that bar means you fix the agent. It does not mean another agent will help.',
    activity: {
      id: 'measure',
      kind: 'transcript',
      title: 'Measure before you multiply',
      goal: 'Keep the lines that respect the measurement. Stop the ones that skip it.',
      constraints: CONSTRAINTS,
      nextAction: 'Mark each line keep or stop.',
      tip: 'About seventy wins out of a hundred held-out tasks is a reason to stay with one agent. A score under the bar is a reason to fix prompts, tools, or the model. Two tries on a laptop are not a measurement.',
      covers: ['measure'],
      stat: 'verification',
      maxAttempts: 5,
      lines: [
        {
          id: 'high',
          speaker: 'agent',
          text: 'Right on 70 of 100 held-out tasks. Keep this as one agent.',
          mark: 'keep',
        },
        {
          id: 'auto',
          speaker: 'agent',
          text: 'It is under the bar, so two more agents will fix it.',
          mark: 'stop',
        },
        {
          id: 'sample',
          speaker: 'user',
          text: 'I tried it twice on my laptop and it felt slow. Add a team.',
          mark: 'stop',
        },
        {
          id: 'bar',
          speaker: 'agent',
          text: 'The bar was written first: known-good answers, fifty tasks.',
          mark: 'keep',
        },
      ],
    },
  },
  {
    id: 'parallel',
    title: 'Only split independent work',
    briefing:
      'Several agents help when the job breaks into pieces that do not wait on each other. A chain, where step two cannot start until step one finishes, stays with one agent.',
    activity: {
      id: 'parallel',
      kind: 'checklist',
      title: 'Only split independent work',
      goal: 'Flag only the jobs that are independent pieces.',
      constraints: CONSTRAINTS,
      nextAction: 'Leave the chains unchecked.',
      tip: 'Searching five sites, or summarizing ten separate articles, can run side by side. A trip plan and a bank transfer are chains: the next step needs the previous result.',
      covers: ['parallel'],
      stat: 'planning',
      maxAttempts: 5,
      options: [
        { id: 'flights', label: 'Search five sites for the same flight' },
        { id: 'articles', label: 'Summarize ten separate articles at once' },
        { id: 'trip', label: 'Plan a whole trip, destination before hotel' },
        { id: 'transfer', label: 'Move money only after the balance is verified' },
      ],
      correct: ['flights', 'articles'],
    },
  },
  {
    id: 'topology',
    title: 'Match the shape to the job',
    briefing:
      'Once a team is justified, the shape follows the work. A structured pipeline wants a coordinator. An open look at the same material wants peers.',
    activity: {
      id: 'topology',
      kind: 'checklist',
      title: 'Match the shape to the job',
      goal: 'Pick the two pairings that fit the job.',
      constraints: CONSTRAINTS,
      nextAction: 'Leave the mismatched shapes unchecked.',
      tip: 'A financial report is a pipeline: one coordinator and specialists. An open audit is peers reading the same material from different angles. Swapping those shapes fights the work.',
      covers: ['topology'],
      stat: 'context',
      maxAttempts: 5,
      options: [
        { id: 'report-central', label: 'Financial report pipeline → one coordinator and specialists' },
        { id: 'audit-peers', label: 'Open audit of the same files → peers, no single boss' },
        { id: 'report-peers', label: 'Financial report pipeline → peers with nobody coordinating' },
        { id: 'audit-boss', label: 'Open audit → one boss rewriting every draft' },
      ],
      correct: ['report-central', 'audit-peers'],
    },
  },
  {
    id: 'cap',
    title: 'Cap the team and the tools',
    briefing:
      'A team that is already past a handful of agents, or an agent holding a drawer of tools, gets worse. Flag the plan that is too wide. Leave the small plan alone.',
    activity: {
      id: 'cap',
      kind: 'checklist',
      title: 'Cap the team and the tools',
      goal: 'Flag only what is already too wide.',
      constraints: CONSTRAINTS,
      nextAction: 'Leave the small team and the small tool set unchecked.',
      tip: 'Success drops once the team grows past about three or four agents. Each agent should hold the few tools the job needs, on the order of one to three, not a dozen.',
      covers: ['cap'],
      stat: 'adaptation',
      maxAttempts: 5,
      options: [
        { id: 'three', label: 'Three specialists and one coordinator' },
        { id: 'two', label: 'Two tools on the search agent' },
        { id: 'eight', label: 'Eight agents on one report' },
        { id: 'dozen', label: 'Twelve tools on every agent' },
      ],
      correct: ['eight', 'dozen'],
    },
  },
  {
    id: 'evals',
    title: 'Evals before the org',
    briefing:
      'A demo that works on your machine is not a system the rest of the org can trust. Write the bar, run your own tasks, score accuracy, cost, and the tool path, and only then widen who uses it.',
    activity: {
      id: 'evals',
      kind: 'order',
      title: 'Evals before the org',
      goal: 'Put measurement before rollout.',
      constraints: CONSTRAINTS,
      nextAction: 'The org does not get the agent until the score exists.',
      tip: 'The pass bar comes first, then tasks from your own work, then accuracy, cost, and whether the tool path was the right one. Scaling is the last step. If you cannot measure it, you cannot trust it.',
      covers: ['evals'],
      stat: 'testing',
      maxAttempts: 5,
      steps: [
        { id: 'scale', label: 'Let the rest of the org use it' },
        { id: 'metrics', label: 'Score accuracy, cost, and whether the tool path was right' },
        { id: 'bar', label: 'Write the pass bar before the run' },
        { id: 'tasks', label: 'Run a set of real tasks from your own work' },
      ],
      correct: ['bar', 'tasks', 'metrics', 'scale'],
    },
  },
]

export function stepById(id: string): HandbookStep {
  const found = HANDBOOK_STEPS.find((step) => step.id === id)
  if (!found) throw new Error(id)
  return found
}
