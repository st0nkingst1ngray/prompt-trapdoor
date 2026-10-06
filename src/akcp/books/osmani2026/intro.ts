import type { AkcpSection } from '../../types'

export const INTRO_SECTION: AkcpSection = {
  id: 'intro',
  title: 'Introduction',
  stat: null,
  status: 'playable',
  questRequired: false,
  paragraphs: [
    {
      id: 'intro.p1',
      text: 'AI coding assistants became game-changers in 2025, but harnessing them effectively takes skill and structure. These tools dramatically increased what LLMs can do for real-world coding, and many developers (myself included) embraced them.',
    },
    {
      id: 'intro.p2',
      text: 'At Anthropic, for example, engineers adopted Claude Code so heavily that today ~90% of the code for Claude Code is written by Claude Code itself. Yet, using LLMs for programming is not a push-button magic experience - it\'s "difficult and unintuitive" and getting great results requires learning new patterns. Critical thinking remains key. Over a year of projects, I\'ve converged on a workflow similar to what many experienced devs are discovering: treat the LLM as a powerful pair programmer that requires clear direction, context and oversight rather than autonomous judgment.',
    },
    {
      id: 'intro.p3',
      text: 'In this article, I\'ll share how I plan, code, and collaborate with AI going into 2026, distilling tips and best practices from my experience and the community\'s collective learning. It\'s a more disciplined "AI-assisted engineering" approach - leveraging AI aggressively while staying proudly accountable for the software produced.',
    },
    {
      id: 'intro.p4',
      text: 'If you\'re interested in more on my workflow, see "The AI-Native Software Engineer", otherwise let\'s dive straight into some of the lessons I learned.',
    },
  ],
  pages: [
    { id: 'intro.page.1', paragraphId: 'intro.p1' },
    { id: 'intro.page.2', paragraphId: 'intro.p2' },
    { id: 'intro.page.3', paragraphId: 'intro.p3' },
    { id: 'intro.page.4', paragraphId: 'intro.p4' },
  ],
  steps: [],
  boss: null,
}
