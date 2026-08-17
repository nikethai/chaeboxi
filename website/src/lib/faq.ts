export type FaqItem = {
  question: string
  answer: string
}

export const FAQS: FaqItem[] = [
  {
    question: 'Is Chaeboxi the same as Chatbox AI?',
    answer:
      'No. Chaeboxi is an independent GPLv3 product. Parts of the codebase come from an earlier open-source client. It is not the Chatbox commercial app and is not affiliated with any AI license marketplace. See NOTICE in the repository.',
  },
  {
    question: 'Do you host models or sell an AI plan?',
    answer:
      'No. There is no first-party hosted Chaeboxi LLM and no bundled paid AI subscription. You bring your own provider keys, or run a local runtime such as Ollama or LM Studio.',
  },
  {
    question: 'Where do chats and settings live?',
    answer:
      'On the device or platform storage you choose. Chaeboxi does not run a hosted chat backend.',
  },
  {
    question: 'What works only on the desktop app?',
    answer:
      'MCP stdio, OS keychain, computer use, the browser agent, and the local E5 knowledge base ship on desktop. Web and mobile share chat and settings. They are not claimed to have those native tools.',
  },
  {
    question: 'How do I install Chaeboxi?',
    answer:
      'Download macOS, Windows, or Linux installers from GitHub Releases via the Download page. Unsigned Apple Silicon builds may need xattr -cr /Applications/Chaeboxi.app after install.',
  },
]
