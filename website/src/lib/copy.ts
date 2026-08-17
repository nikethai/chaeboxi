export const HERO_SUB =
  'Paste a key you already pay for. The thread stays on this machine. Independent GPLv3 — not Chatbox AI, not a hosted LLM.'

export const HERO_PROOF = 'Desktop-primary. No Chaeboxi cloud. No bundled AI plan.'

export type CopyCard = {
  meta: string
  title: string
  body: string
}

export const AUDIENCE: CopyCard[] = [
  {
    meta: 'BYOK',
    title: 'You already have keys',
    body: 'OpenAI, Anthropic, Gemini, OpenRouter, Azure, and more. Chaeboxi never sells you a model seat.',
  },
  {
    meta: 'Local',
    title: 'Or skip the API bill',
    body: 'Point the studio at Ollama or LM Studio. Same chat surface. Still no Chaeboxi account.',
  },
  {
    meta: 'Desktop',
    title: 'You want a shell with tools',
    body: 'Agents, MCP, a local knowledge base, browser agent, and computer use ship on the desktop app.',
  },
]

export const AUDIENCE_NOT: CopyCard = {
  meta: 'Skip this',
  title: 'Not a ChatGPT subscription',
  body: 'If you want a hosted LLM plan or a commercial Chatbox client, this is the wrong download. Chaeboxi is the local shell.',
}

export const DESKTOP_TOOLS: CopyCard[] = [
  {
    meta: 'Rooms',
    title: 'Up to three agents',
    body: 'Discuss, Work, or Swarm in one thread. Desktop rooms. Not claimed on web or mobile.',
  },
  {
    meta: 'MCP',
    title: 'Local MCP servers',
    body: 'The desktop app talks to MCP servers on your machine. Web and mobile do not get that path.',
  },
  {
    meta: 'Knowledge',
    title: 'Private files, local search',
    body: 'Desktop KB is SQLite plus on-device E5. First run may download the embedder (~180MB). It is not in the installer.',
  },
  {
    meta: 'Computer',
    title: 'Screen observe and act',
    body: 'Computer use ships on desktop only. It is not the web or mobile product.',
  },
  {
    meta: 'Browser',
    title: 'Isolated browser agent',
    body: 'Desktop browser tools run in an isolated session. Not claimed on web or mobile.',
  },
  {
    meta: 'Skills',
    title: 'Commands and hooks',
    body: 'Skill packs, slash commands, and lifecycle hooks extend the desktop studio without a Chaeboxi marketplace.',
  },
]

export const FIRST_MINUTES: CopyCard[] = [
  {
    meta: '01',
    title: 'Install the desktop app',
    body: 'macOS, Windows, or Linux from GitHub Releases. No Chaeboxi account.',
  },
  {
    meta: '02',
    title: 'Add a key — or a local runtime',
    body: 'Paste a provider key, or point at Ollama or LM Studio. Chaeboxi does not sell model access.',
  },
  {
    meta: '03',
    title: 'Start a thread',
    body: 'The conversation stays in local storage on the machine you chose.',
  },
]

export const WHY_SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: 'The last copilot already kept the thread',
    paragraphs: [
      'Most chat apps are a seat on someone else’s service. The model, the history, and the upsell live there. That is fine if you want ChatGPT-the-product.',
      'Chaeboxi is the other shape: a local-first shell. You bring the keys. The thread stays on the device or platform storage you choose. There is no hosted Chaeboxi chat backend.',
    ],
  },
  {
    title: 'BYOK is the whole offer',
    paragraphs: [
      'There is no Chaeboxi AI plan and no first-party hosted LLM. OpenAI, Anthropic, Gemini, OpenRouter, Azure, xAI, Groq, and the rest are providers you already have.',
      'If you do not want an API bill, run Ollama or LM Studio. Same studio. Still no Chaeboxi account.',
    ],
  },
  {
    title: 'Desktop is richer on purpose',
    paragraphs: [
      'Web and mobile share chat and settings. They are real targets. They are not the full shell.',
      'MCP stdio, OS keychain, computer use, the isolated browser agent, and the local E5 knowledge base ship on desktop. We do not pretend otherwise.',
    ],
  },
  {
    title: 'Independent of Chatbox',
    paragraphs: [
      'Parts of the codebase come from an earlier open-source GPLv3 client. Chaeboxi is not the Chatbox commercial app and is not affiliated with any AI license marketplace. See NOTICE in the repository.',
      'The license is GNU GPLv3. The source is public. That is the product, not a landing-page slogan.',
    ],
  },
]
