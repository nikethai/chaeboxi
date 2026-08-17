export const COMPARE_COLUMNS = ['Chaeboxi', 'Chatbox AI', 'Hosted ChatGPT'] as const

export const COMPARE_ROWS: { label: string; values: [string, string, string] }[] = [
  {
    label: 'What it is',
    values: ['Independent GPLv3 copilot', 'Separate commercial product', 'OpenAI hosted app'],
  },
  {
    label: 'Vendor-hosted LLM',
    values: ['None', 'Their cloud product', 'Yes'],
  },
  {
    label: 'API keys',
    values: ['You bring them (BYOK)', 'Separate product', 'Subscription'],
  },
  {
    label: 'Where chats live',
    values: ['On your device', 'Their product', 'Their service'],
  },
  {
    label: 'Desktop MCP, computer use, local KB',
    values: ['Yes, on desktop', 'Not Chaeboxi', 'Not Chaeboxi'],
  },
  {
    label: 'License',
    values: ['GNU GPLv3', 'Proprietary', 'Proprietary'],
  },
]
