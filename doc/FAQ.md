# Frequently Asked Questions

If you still have questions, open an [issue](https://github.com/nikethai/chaeboxi/issues).

### Message sending failed (`Failed to fetch`)?

Chaeboxi cannot reach the AI provider endpoint you configured. Check your network and the **API Host** for that provider (for OpenAI the default is `https://api.openai.com`).

### Quota / billing errors from the provider?

Errors like `insufficient_quota` or “exceeded your current quota” come from the **provider account** (OpenAI, Anthropic, etc.), not from Chaeboxi. Check that provider’s billing dashboard and API key limits.

### Model not found (e.g. GPT-4)?

Your API key or account may not have access to that model, or the model id is wrong. Pick a model your account supports, or use a local provider such as Ollama.

### How do I use Chaeboxi?

Chaeboxi is **BYOK** (bring your own keys). Open **Settings → Provider**, add a provider, paste your API key, and select a model. There is no built-in paid hosted LLM subscription.

### Privacy

Conversation data stays on your device (platform storage). See the [README](../README.md#privacy) privacy section.
