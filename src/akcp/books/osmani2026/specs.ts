import type { AkcpChecklistActivity, AkcpOrderActivity, AkcpOrderStep, AkcpSection, AkcpTranscriptActivity } from '../../types'

const CONSTRAINTS = 'Technical decision. 5 attempts.'

const ORDER_STEPS: AkcpOrderStep[] = [
  { id: 'ask', label: 'Ask until requirements and edge cases are filled in' },
  { id: 'spec', label: 'Write spec.md with requirements, architecture, data models, and a testing strategy' },
  { id: 'plan', label: 'Have a reasoning-capable model draft a bite-sized plan, then edit the plan until it is coherent' },
  { id: 'code', label: 'Start codegen on step 1 of that plan' },
]

const ORDER_CORRECT = ['ask', 'spec', 'plan', 'code']

function orderActivity(
  id: string,
  title: string,
  goal: string,
  nextAction: string,
  tip: string,
  covers: string[],
): AkcpOrderActivity {
  return {
    id,
    kind: 'order',
    title,
    goal,
    constraints: CONSTRAINTS,
    nextAction,
    tip,
    covers,
    stat: 'planning',
    maxAttempts: 5,
    steps: ORDER_STEPS.map((step) => ({ ...step })),
    correct: [...ORDER_CORRECT],
  }
}

const TRANSCRIPT_LINES = [
  { id: 'wish', speaker: 'user' as const, text: 'Build the payments module. Make it cool.', mark: 'keep' as const },
  { id: 'skip', speaker: 'agent' as const, text: 'Skipping questions. Generating the full module now.', mark: 'stop' as const },
  { id: 'later', speaker: 'agent' as const, text: 'spec.md can wait until after the code compiles.', mark: 'stop' as const },
]

function transcriptActivity(
  id: string,
  title: string,
  goal: string,
  nextAction: string,
  tip: string,
  covers: string[],
  lines: AkcpTranscriptActivity['lines'],
): AkcpTranscriptActivity {
  return {
    id,
    kind: 'transcript',
    title,
    goal,
    constraints: CONSTRAINTS,
    nextAction,
    tip,
    covers,
    stat: 'planning',
    maxAttempts: 5,
    lines,
  }
}

function checklistActivity(
  id: string,
  title: string,
  goal: string,
  nextAction: string,
  tip: string,
  covers: string[],
  options: AkcpChecklistActivity['options'],
  correct: string[],
): AkcpChecklistActivity {
  return {
    id,
    kind: 'checklist',
    title,
    goal,
    constraints: CONSTRAINTS,
    nextAction,
    tip,
    covers,
    stat: 'planning',
    maxAttempts: 5,
    options,
    correct,
  }
}

const ORDER_TIP = 'A spec and a plan come before the first implementation prompt.'
const TRANSCRIPT_TIP = 'Vague wishes get questions, a spec, and a plan. They do not get a full-module generation.'
const CHECKLIST_TIP = "A plan is ready when the spec's testing strategy exists and the first task is one slice."
const BOSS_TIP = 'Planning first means a spec, then a plan you edited, then codegen. A giant prompt is not a plan.'

export const SPECS_SECTION: AkcpSection = {
  id: 'specs',
  title: 'Start with a clear plan',
  stat: 'planning',
  status: 'playable',
  questRequired: true,
  paragraphs: [
    {
      id: 'specs.p1',
      text: "Don't just throw wishes at the LLM - begin by defining the problem and planning a solution.",
    },
    {
      id: 'specs.p2',
      text: "One common mistake is diving straight into code generation with a vague prompt. In my workflow, and in many others', the first step is brainstorming a detailed specification with the AI, then outlining a step-by-step plan, before writing any actual code. For a new project, I'll describe the idea and ask the LLM to iteratively ask me questions until we've fleshed out requirements and edge cases. By the end, we compile this into a comprehensive spec.md - containing requirements, architecture decisions, data models, and even a testing strategy. This spec forms the foundation for development.",
    },
    {
      id: 'specs.p3',
      text: 'Next, I feed the spec into a reasoning-capable model and prompt it to generate a project plan: break the implementation into logical, bite-sized tasks or milestones. The AI essentially helps me do a mini "design doc" or project plan. I often iterate on this plan - editing and asking the AI to critique or refine it - until it\'s coherent and complete. Only then do I proceed to coding. This upfront investment might feel slow, but it pays off enormously. As Les Orchard put it, it\'s like doing a "waterfall in 15 minutes" - a rapid structured planning phase that makes the subsequent coding much smoother.',
    },
    {
      id: 'specs.p4',
      text: "Having a clear spec and plan means when we unleash the codegen, both the human and the LLM know exactly what we're building and why. In short, planning first forces you and the AI onto the same page and prevents wasted cycles. It's a step many people are tempted to skip, but experienced LLM developers now treat a robust spec/plan as the cornerstone of the workflow.",
    },
  ],
  pages: [
    { id: 'specs.page.1', paragraphId: 'specs.p1' },
    { id: 'specs.page.2', paragraphId: 'specs.p2' },
    { id: 'specs.page.3', paragraphId: 'specs.p3' },
    { id: 'specs.page.4', paragraphId: 'specs.p4' },
  ],
  steps: [
    orderActivity(
      'specs-order',
      'Order the workflow',
      'Order the workflow before codegen.',
      'Submit the order',
      ORDER_TIP,
      ['specs.p1', 'specs.p2'],
    ),
    transcriptActivity(
      'specs-transcript',
      'Mark the transcript',
      'Mark each transcript line keep or stop.',
      'Submit the marks',
      TRANSCRIPT_TIP,
      ['specs.p2', 'specs.p3'],
      TRANSCRIPT_LINES,
    ),
    checklistActivity(
      'specs-checklist',
      'Flag the broken plan',
      'Flag every real problem in the plan.',
      'Submit the flags',
      CHECKLIST_TIP,
      ['specs.p3', 'specs.p4'],
      [
        { id: 'has-reqs', label: 'Requirements section is present' },
        { id: 'has-arch', label: 'Architecture section is present' },
        { id: 'has-data', label: 'Data model section is present' },
        { id: 'no-tests', label: 'Testing strategy is missing' },
        { id: 'monolith', label: 'Task 1 says "generate the entire app"' },
      ],
      ['no-tests', 'monolith'],
    ),
  ],
  boss: {
    id: 'specs-boss',
    title: 'Clear plan before codegen',
    stat: 'planning',
    covers: ['specs.p1', 'specs.p2', 'specs.p3', 'specs.p4'],
    maxAttempts: 5,
    beats: [
      orderActivity(
        'specs-boss-order',
        'Order the workflow',
        'Order the workflow before codegen.',
        'Submit this beat',
        BOSS_TIP,
        ['specs.p1', 'specs.p2'],
      ),
      transcriptActivity(
        'specs-boss-transcript',
        'Mark the transcript',
        'Mark each transcript line keep or stop.',
        'Submit this beat',
        BOSS_TIP,
        ['specs.p2', 'specs.p3'],
        [
          { id: 'rush', speaker: 'agent', text: "I'll start coding; the spec can wait.", mark: 'stop' },
          { id: 'hold', speaker: 'agent', text: 'I will ask clarifying questions and write spec.md first.', mark: 'keep' },
        ],
      ),
      checklistActivity(
        'specs-boss-artifacts',
        'Choose the artifacts',
        'Pick the artifacts that must exist before codegen.',
        'Submit this beat',
        BOSS_TIP,
        ['specs.p3', 'specs.p4'],
        [
          { id: 'spec', label: 'spec.md' },
          { id: 'plan', label: 'the edited plan' },
          { id: 'giant', label: 'one giant prompt' },
          { id: 'merge', label: 'merge first' },
        ],
        ['spec', 'plan'],
      ),
    ],
  },
}
