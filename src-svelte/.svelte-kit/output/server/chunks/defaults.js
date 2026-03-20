import { v4 } from "uuid";
import { z } from "zod";
var ModelProviderEnum = /* @__PURE__ */ ((ModelProviderEnum2) => {
  ModelProviderEnum2["ChatboxAI"] = "chatbox-ai";
  ModelProviderEnum2["OpenAI"] = "openai";
  ModelProviderEnum2["OpenAIResponses"] = "openai-responses";
  ModelProviderEnum2["Azure"] = "azure";
  ModelProviderEnum2["ChatGLM6B"] = "chatglm-6b";
  ModelProviderEnum2["Claude"] = "claude";
  ModelProviderEnum2["Gemini"] = "gemini";
  ModelProviderEnum2["Ollama"] = "ollama";
  ModelProviderEnum2["Groq"] = "groq";
  ModelProviderEnum2["DeepSeek"] = "deepseek";
  ModelProviderEnum2["SiliconFlow"] = "siliconflow";
  ModelProviderEnum2["VolcEngine"] = "volcengine";
  ModelProviderEnum2["MistralAI"] = "mistral-ai";
  ModelProviderEnum2["LMStudio"] = "lm-studio";
  ModelProviderEnum2["Perplexity"] = "perplexity";
  ModelProviderEnum2["XAI"] = "xAI";
  ModelProviderEnum2["OpenRouter"] = "openrouter";
  ModelProviderEnum2["Custom"] = "custom";
  return ModelProviderEnum2;
})(ModelProviderEnum || {});
var ModelProviderType = /* @__PURE__ */ ((ModelProviderType2) => {
  ModelProviderType2["ChatboxAI"] = "chatbox-ai";
  ModelProviderType2["OpenAI"] = "openai";
  ModelProviderType2["Gemini"] = "gemini";
  ModelProviderType2["Claude"] = "claude";
  ModelProviderType2["OpenAIResponses"] = "openai-responses";
  return ModelProviderType2;
})(ModelProviderType || {});
const DocumentParserConfigSchema = z.object({
  type: z.enum(["none", "local", "chatbox-ai", "mineru"]),
  mineru: z.object({
    apiToken: z.string()
  }).optional()
});
const ProviderModelInfoSchema = z.object({
  modelId: z.string(),
  type: z.enum(["chat", "embedding", "rerank"]).optional().catch(void 0),
  apiStyle: z.enum(["google", "openai", "anthropic"]).optional().catch(void 0),
  nickname: z.string().optional().catch(void 0),
  labels: z.array(z.string()).optional().catch([]),
  capabilities: z.array(z.enum(["vision", "reasoning", "tool_use", "web_search"])).optional().catch([]),
  contextWindow: z.number().optional().catch(void 0),
  maxOutput: z.number().optional().catch(void 0)
});
const ProviderSettingsSchema = z.object({
  apiKey: z.string().optional().catch(void 0),
  apiHost: z.string().optional().catch(void 0),
  apiPath: z.string().optional().catch(void 0),
  cloudflareClientId: z.string().optional().catch(void 0),
  cloudflareClientSecret: z.string().optional().catch(void 0),
  models: z.array(ProviderModelInfoSchema).optional().catch(void 0),
  excludedModels: z.array(z.string()).optional().catch(void 0),
  useProxy: z.boolean().optional().catch(void 0),
  // azure
  endpoint: z.string().optional().catch(void 0),
  deploymentName: z.string().optional().catch(void 0),
  dalleDeploymentName: z.string().optional().catch(void 0),
  apiVersion: z.string().optional().catch(void 0)
});
const BuiltinProviderBaseInfoSchema = z.object({
  id: z.nativeEnum(ModelProviderEnum),
  name: z.string(),
  type: z.nativeEnum(ModelProviderType).catch(ModelProviderType.OpenAI),
  isCustom: z.literal(false).optional().catch(void 0),
  description: z.string().optional().catch(void 0),
  urls: z.object({
    website: z.string().nullish(),
    apiKey: z.string().nullish(),
    docs: z.string().nullish(),
    models: z.string().nullish()
  }).optional().catch(void 0),
  defaultSettings: ProviderSettingsSchema.optional().catch(void 0)
});
const CustomProviderBaseInfoSchema = BuiltinProviderBaseInfoSchema.extend({
  id: z.string(),
  iconUrl: z.string().optional().catch(void 0),
  isCustom: z.literal(true)
});
z.discriminatedUnion("isCustom", [
  BuiltinProviderBaseInfoSchema,
  CustomProviderBaseInfoSchema
]);
const ClaudeParamsSchema = z.object({
  thinking: z.object({
    type: z.enum(["enabled", "disabled"]).default("enabled"),
    budgetTokens: z.number().catch(1024)
  })
});
const OpenAIParamsSchema = z.object({
  reasoningEffort: z.enum(["low", "medium", "high"]).optional().catch(void 0)
});
const GoogleParamsSchema = z.object({
  thinkingConfig: z.object({
    thinkingBudget: z.number().catch(1024),
    includeThoughts: z.boolean().catch(true)
  })
});
const ProviderOptionsSchema = z.object({
  claude: ClaudeParamsSchema.optional(),
  openai: OpenAIParamsSchema.optional(),
  google: GoogleParamsSchema.optional()
});
const GlobalSessionSettingsSchema = z.object({
  maxContextMessageCount: z.number().optional().catch(void 0),
  temperature: z.number().optional().catch(void 0),
  topP: z.number().optional().catch(void 0),
  maxTokens: z.number().optional().catch(void 0),
  stream: z.boolean().optional().catch(true)
});
const SessionSettingsSchema = GlobalSessionSettingsSchema.extend({
  provider: z.string().optional().catch(void 0),
  modelId: z.string().optional().catch(void 0),
  dalleStyle: z.enum(["vivid", "natural"]).optional().catch("vivid"),
  imageGenerateNum: z.number().optional().catch(1),
  providerOptions: ProviderOptionsSchema.optional().catch(void 0),
  autoCompaction: z.boolean().optional().catch(void 0)
});
const UnifiedTokenUsageDetailSchema = z.object({
  type: z.string(),
  // "plan" | "trial" | ... (more types in future)
  token_usage: z.number(),
  token_limit: z.number()
});
const ChatboxAILicenseDetailSchema = z.object({
  type: z.enum(["chatboxai-3.5", "chatboxai-4"]).optional(),
  name: z.string(),
  status: z.string().optional(),
  defaultModel: z.enum(["chatboxai-3.5", "chatboxai-4"]).optional(),
  remaining_quota_35: z.number(),
  remaining_quota_4: z.number(),
  remaining_quota_image: z.number(),
  image_used_count: z.number(),
  image_total_quota: z.number(),
  plan_image_limit: z.number(),
  token_refreshed_time: z.string(),
  token_next_refresh_time: z.string().optional(),
  token_expire_time: z.string().nullish(),
  remaining_quota_unified: z.number(),
  expansion_pack_limit: z.number(),
  expansion_pack_usage: z.number(),
  unified_token_usage: z.number(),
  unified_token_limit: z.number(),
  unified_token_usage_details: z.array(UnifiedTokenUsageDetailSchema).default([]),
  key: z.string().optional(),
  price_type: z.string().optional(),
  order_type: z.string().optional(),
  utm_source: z.string().optional(),
  expires_at: z.string().optional(),
  recurring_canceled: z.boolean().nullish(),
  payment_type: z.string().optional()
});
const shortcutSendValues = [
  "",
  "Enter",
  "Ctrl+Enter",
  "Command+Enter",
  "Shift+Enter",
  "Ctrl+Shift+Enter",
  "CommandOrControl+Enter"
];
const ShortcutSendValueSchema = z.enum(shortcutSendValues);
const shortcutToggleWindowValues = ["", "Alt+`", "Alt+Space", "Ctrl+Alt+Space", "Ctrl+Space"];
const ShortcutToggleWindowValueSchema = z.enum(shortcutToggleWindowValues);
const ShortcutSettingSchema = z.object({
  quickToggle: ShortcutToggleWindowValueSchema,
  inputBoxFocus: z.string(),
  inputBoxWebBrowsingMode: z.string(),
  newChat: z.string(),
  newPictureChat: z.string(),
  sessionListNavNext: z.string(),
  sessionListNavPrev: z.string(),
  sessionListNavTargetIndex: z.string(),
  messageListRefreshContext: z.string(),
  dialogOpenSearch: z.string(),
  optionNavUp: z.string(),
  optionNavDown: z.string(),
  optionSelect: z.string(),
  inputBoxSendMessage: ShortcutSendValueSchema,
  inputBoxSendMessageWithoutResponse: ShortcutSendValueSchema
});
const HistorySyncConfigSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.string().optional().catch(void 0),
  token: z.string().optional().catch(void 0),
  autoSync: z.boolean().default(false),
  intervalSeconds: z.number().min(15).max(3600).default(60)
});
const ExtensionSettingsSchema = z.object({
  webSearch: z.object({
    provider: z.enum(["build-in", "bing", "duckduckgo", "serper", "google", "tavily"]),
    serperApiKey: z.string().optional(),
    googleApiKey: z.string().optional(),
    googleCseId: z.string().optional(),
    tavilyApiKey: z.string().optional(),
    tavilySearchDepth: z.string().optional(),
    tavilyMaxResults: z.number().optional(),
    tavilyTimeRange: z.string().optional(),
    tavilyIncludeRawContent: z.string().optional()
  }),
  knowledgeBase: z.object({
    models: z.object({
      embedding: z.object({
        modelId: z.string(),
        providerId: z.string()
      }).nullable().optional(),
      rerank: z.object({
        modelId: z.string(),
        providerId: z.string()
      }).nullable().optional()
    })
  }).optional(),
  // Document parser configuration for global default
  documentParser: DocumentParserConfigSchema.optional(),
  historySync: HistorySyncConfigSchema.optional().catch(void 0)
});
const MCPTransportConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stdio"),
    command: z.string(),
    args: z.array(z.string()),
    env: z.record(z.string(), z.string()).optional()
  }),
  z.object({
    type: z.literal("http"),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional()
  })
]);
const MCPServerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  transport: MCPTransportConfigSchema
});
const MCPSettingsSchema = z.object({
  servers: z.array(MCPServerConfigSchema),
  enabledBuiltinServers: z.array(z.string())
});
var Theme = /* @__PURE__ */ ((Theme2) => {
  Theme2[Theme2["Dark"] = 0] = "Dark";
  Theme2[Theme2["Light"] = 1] = "Light";
  Theme2[Theme2["System"] = 2] = "System";
  return Theme2;
})(Theme || {});
GlobalSessionSettingsSchema.extend({
  providers: z.record(z.string(), ProviderSettingsSchema).optional().catch(void 0),
  customProviders: z.array(CustomProviderBaseInfoSchema).optional().catch(void 0),
  favoritedModels: z.array(
    z.object({
      provider: z.string(),
      model: z.string()
    })
  ).optional().catch(void 0),
  // default models
  defaultChatModel: z.object({
    provider: z.string(),
    model: z.string()
  }).optional().catch(void 0),
  threadNamingModel: z.object({
    provider: z.string(),
    model: z.string()
  }).optional().catch(void 0),
  searchTermConstructionModel: z.object({
    provider: z.string(),
    model: z.string()
  }).optional().catch(void 0),
  ocrModel: z.object({
    provider: z.string(),
    model: z.string()
  }).optional().catch(void 0),
  // chatboxai
  licenseKey: z.string().optional(),
  licenseInstances: z.record(z.string(), z.string()).optional().catch(void 0),
  licenseDetail: ChatboxAILicenseDetailSchema.optional().catch(void 0),
  licenseActivationMethod: z.enum(["login", "manual"]).optional(),
  lastSelectedLicenseByUser: z.record(z.string(), z.string()).optional().catch(void 0),
  // 在 licensekeyview UI中显示/记忆的key，以免用户使用 login 方式后老 key 被清除，他也不记得
  memorizedManualLicenseKey: z.string().optional(),
  // chat settings
  showWordCount: z.boolean().optional().catch(void 0),
  showTokenCount: z.boolean().optional().catch(void 0),
  showTokenUsed: z.boolean().optional().catch(void 0),
  showModelName: z.boolean().optional().catch(void 0),
  showMessageTimestamp: z.boolean().optional().catch(void 0),
  showFirstTokenLatency: z.boolean().optional().catch(void 0),
  theme: z.nativeEnum(Theme),
  language: z.enum([
    "en",
    "zh-Hans",
    "zh-Hant",
    "ja",
    "ko",
    "ru",
    "de",
    "fr",
    "pt-PT",
    "es",
    "ar",
    "it-IT",
    "sv",
    "nb-NO"
  ]),
  languageInited: z.boolean().optional(),
  fontSize: z.number().catch(14),
  spellCheck: z.boolean().optional(),
  startupPage: z.enum(["home", "session"]).optional(),
  // disableQuickToggleShortcut?: boolean // 是否关闭快捷键切换窗口显隐（弃用，为了兼容历史数据，这个字段永远不要使用）
  defaultPrompt: z.string().optional(),
  // 新会话的默认 prompt
  proxy: z.string().optional(),
  // 代理地址
  allowReportingAndTracking: z.boolean().optional(),
  // 是否允许错误报告和事件追踪
  userAvatarKey: z.string().optional(),
  // 用户头像的 key
  defaultAssistantAvatarKey: z.string().optional(),
  // 默认助手头像的 key
  enableMarkdownRendering: z.boolean().default(true),
  enableMermaidRendering: z.boolean().default(true),
  enableLaTeXRendering: z.boolean().default(true),
  injectDefaultMetadata: z.boolean().default(true),
  // 是否注入默认附加元数据（如模型名称、当前日期）
  autoPreviewArtifacts: z.boolean().default(false),
  // 是否自动展开预览 artifacts
  autoCollapseCodeBlock: z.boolean().default(true),
  // 是否自动折叠代码块
  pasteLongTextAsAFile: z.boolean().default(true),
  // 是否将长文本粘贴为文件
  autoGenerateTitle: z.boolean().default(true),
  autoCompaction: z.boolean().default(true),
  compactionThreshold: z.number().min(0.4).max(0.9).default(0.6),
  autoLaunch: z.boolean().default(false),
  autoUpdate: z.boolean().default(true),
  // 是否自动检查更新
  betaUpdate: z.boolean().default(false),
  // 是否自动检查 beta 更新
  shortcuts: ShortcutSettingSchema,
  extension: ExtensionSettingsSchema,
  mcp: MCPSettingsSchema
});
const TokenCacheKeySchema = z.enum(["default", "deepseek", "default_preview", "deepseek_preview"]);
TokenCacheKeySchema.enum;
const TokenCountMapSchema = z.record(z.string(), z.number());
const TokenCalculatedAtSchema = z.object({
  default: z.number().optional(),
  deepseek: z.number().optional(),
  default_preview: z.number().optional(),
  deepseek_preview: z.number().optional()
}).optional();
const SearchResultItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string(),
  rawContent: z.string().nullable().optional()
});
z.object({
  items: z.array(SearchResultItemSchema)
});
const MessageFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  fileType: z.string(),
  url: z.string().optional(),
  storageKey: z.string().optional(),
  chatboxAIFileUUID: z.string().optional(),
  tokenCountMap: TokenCountMapSchema.optional().catch(void 0),
  tokenCalculatedAt: TokenCalculatedAtSchema,
  lineCount: z.number().optional(),
  byteLength: z.number().optional()
});
const MessageLinkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  storageKey: z.string().optional(),
  chatboxAILinkUUID: z.string().optional(),
  tokenCountMap: TokenCountMapSchema.optional(),
  tokenCalculatedAt: TokenCalculatedAtSchema,
  lineCount: z.number().optional(),
  byteLength: z.number().optional()
});
z.object({
  url: z.string().optional(),
  storageKey: z.string().optional(),
  loading: z.boolean().optional()
});
const MessageRoleEnum = {
  System: "system",
  User: "user",
  Assistant: "assistant",
  Tool: "tool"
};
const MessageTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string()
});
const MessageImagePartSchema = z.object({
  type: z.literal("image"),
  storageKey: z.string(),
  ocrResult: z.string().optional()
});
const MessageInfoPartSchema = z.object({
  type: z.literal("info"),
  text: z.string(),
  values: z.record(z.string(), z.unknown()).optional()
});
const MessageReasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
  startTime: z.number().optional(),
  duration: z.number().optional()
});
const MessageToolCallPartSchema = z.object({
  type: z.literal("tool-call"),
  state: z.enum(["call", "result", "error"]),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(),
  result: z.unknown().optional()
});
const MessageContentPartSchema = z.discriminatedUnion("type", [
  MessageTextPartSchema,
  MessageImagePartSchema,
  MessageInfoPartSchema,
  MessageReasoningPartSchema,
  MessageToolCallPartSchema
]);
const MessageContentPartsSchema = z.array(MessageContentPartSchema);
z.object({
  contentParts: MessageContentPartsSchema,
  reasoningContent: z.string().optional(),
  usage: z.custom().optional(),
  finishReason: z.string().optional()
});
z.enum(["web-browsing", "knowledge-base", "read-file"]);
const ModelProviderSchema = z.union([z.nativeEnum(ModelProviderEnum), z.string()]);
const MessageStatusSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("sending_file"),
    mode: z.enum(["local", "advanced"]).optional()
  }),
  z.object({
    type: z.literal("loading_webpage"),
    mode: z.enum(["local", "advanced"]).optional()
  }),
  z.object({
    type: z.literal("retrying"),
    attempt: z.number(),
    maxAttempts: z.number(),
    error: z.string().optional()
  })
]);
const CancelFunctionSchema = z.custom(
  (val) => val === void 0 || typeof val === "function",
  { message: "Must be a function or undefined" }
);
const MessageUsageSchema = z.object({
  inputTokens: z.number().optional().catch(void 0),
  /**
  The number of output (completion) tokens used.
     */
  outputTokens: z.number().optional().catch(void 0),
  /**
  The total number of tokens as reported by the provider.
  This number might be different from the sum of `inputTokens` and `outputTokens`
  and e.g. include reasoning tokens or other overhead.
     */
  totalTokens: z.number().optional().catch(void 0),
  /**
  The number of reasoning tokens used.
     */
  reasoningTokens: z.number().optional().catch(void 0),
  /**
  The number of cached input tokens.
     */
  cachedInputTokens: z.number().optional().catch(void 0)
});
const MessageSchema = z.object({
  id: z.string(),
  role: z.nativeEnum(MessageRoleEnum),
  name: z.string().optional(),
  cancel: CancelFunctionSchema.optional(),
  generating: z.boolean().optional(),
  aiProvider: z.union([ModelProviderSchema, z.string()]).optional(),
  model: z.string().optional(),
  style: z.string().optional(),
  files: z.array(MessageFileSchema).optional(),
  links: z.array(MessageLinkSchema).optional(),
  reasoningContent: z.string().optional().describe("deprecated, moved to contentParts"),
  contentParts: MessageContentPartsSchema,
  isStreamingMode: z.boolean().optional(),
  errorCode: z.number().optional(),
  error: z.string().optional(),
  errorExtra: z.record(z.string(), z.unknown()).optional(),
  status: z.array(MessageStatusSchema).optional(),
  wordCount: z.number().optional(),
  tokenCount: z.number().optional(),
  // output token count
  tokensUsed: z.number().optional(),
  // deprecated, use `usage` instead
  usage: MessageUsageSchema.optional().catch(void 0),
  timestamp: z.number().optional(),
  firstTokenLatency: z.number().optional(),
  finishReason: z.string().optional(),
  tokenCountMap: TokenCountMapSchema.optional(),
  // estimate token count as input
  tokenCalculatedAt: TokenCalculatedAtSchema,
  updatedAt: z.number().optional(),
  isSummary: z.boolean().optional()
  // Marks message as a compaction summary
});
const CompactionPointSchema = z.object({
  summaryMessageId: z.string(),
  boundaryMessageId: z.string(),
  createdAt: z.number()
});
const SessionTypeSchema = z.enum(["chat", "picture"]);
const MessageForkListSchema = z.object({
  id: z.string(),
  messages: z.array(MessageSchema)
});
const MessageForkSchema = z.object({
  position: z.number(),
  lists: z.array(MessageForkListSchema),
  createdAt: z.number()
});
const SessionThreadSchema = z.object({
  id: z.string(),
  name: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.number(),
  compactionPoints: z.array(CompactionPointSchema).optional()
});
const SessionSchema = z.object({
  id: z.string(),
  type: SessionTypeSchema.optional(),
  name: z.string(),
  picUrl: z.string().optional(),
  messages: z.array(MessageSchema),
  starred: z.boolean().optional(),
  hidden: z.boolean().optional(),
  // Hidden from session list (e.g., migrated picture sessions)
  copilotId: z.string().optional(),
  assistantAvatarKey: z.string().optional(),
  settings: SessionSettingsSchema.optional(),
  threads: z.array(SessionThreadSchema).optional(),
  threadName: z.string().optional(),
  messageForksHash: z.record(z.string(), MessageForkSchema).optional(),
  compactionPoints: z.array(CompactionPointSchema).optional()
});
SessionSchema.pick({
  id: true,
  name: true,
  starred: true,
  hidden: true,
  assistantAvatarKey: true,
  picUrl: true,
  type: true
});
z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number().optional(),
  createdAtLabel: z.string().optional(),
  firstMessageId: z.string(),
  messageCount: z.number()
});
const ImageGenerationStatusSchema = z.enum(["pending", "generating", "done", "error"]);
const ImageGenerationModelSchema = z.object({
  provider: z.string(),
  modelId: z.string()
});
z.object({
  id: z.string(),
  prompt: z.string(),
  referenceImages: z.array(z.string()),
  // storage keys
  generatedImages: z.array(z.string()),
  // storage keys
  createdAt: z.number(),
  model: ImageGenerationModelSchema,
  dalleStyle: z.enum(["vivid", "natural"]).optional(),
  imageGenerateNum: z.number().optional(),
  status: ImageGenerationStatusSchema,
  parentIds: z.array(z.string()).optional(),
  // for tracking iteration DAG (multiple parents possible)
  error: z.string().optional(),
  errorCode: z.number().optional()
  // ChatboxAI API error code
});
function settings() {
  return {
    // aiProvider: ModelProviderEnum.OpenAI,
    // openaiKey: '',
    // apiHost: 'https://api.openai.com',
    // dalleStyle: 'vivid',
    // imageGenerateNum: 3,
    // openaiUseProxy: false,
    // azureApikey: '',
    // azureDeploymentName: '',
    // azureDeploymentNameOptions: [],
    // azureDalleDeploymentName: 'dall-e-3',
    // azureEndpoint: '',
    // azureApiVersion: '2024-05-01-preview',
    // chatglm6bUrl: '', // deprecated
    // chatglmApiKey: '',
    // chatglmModel: '',
    // model: 'gpt-4o',
    // openaiCustomModelOptions: [],
    // temperature: 0.7,
    // topP: 1,
    // // openaiMaxTokens: 0,
    // // openaiMaxContextTokens: 4000,
    // openaiMaxContextMessageCount: 20,
    // // maxContextSize: "4000",
    // // maxTokens: "2048",
    // claudeApiKey: '',
    // claudeApiHost: 'https://api.anthropic.com/v1',
    // claudeModel: 'claude-3-5-sonnet-20241022',
    // claudeApiKey: '',
    // claudeApiHost: 'https://api.anthropic.com',
    // claudeModel: 'claude-3-5-sonnet-20241022',
    // chatboxAIModel: 'chatboxai-3.5',
    // geminiAPIKey: '',
    // geminiAPIHost: 'https://generativelanguage.googleapis.com',
    // geminiModel: 'gemini-1.5-pro-latest',
    // ollamaHost: 'http://127.0.0.1:11434',
    // ollamaModel: '',
    // groqAPIKey: '',
    // groqModel: 'llama3-70b-8192',
    // deepseekAPIKey: '',
    // deepseekModel: 'deepseek-chat',
    // siliconCloudKey: '',
    // siliconCloudModel: 'Qwen/Qwen2.5-7B-Instruct',
    // lmStudioHost: 'http://127.0.0.1:1234/v1',
    // lmStudioModel: '',
    // perplexityApiKey: '',
    // perplexityModel: 'llama-3.1-sonar-large-128k-online',
    // xAIKey: '',
    // xAIModel: 'grok-beta',
    // customProviders: [],
    showWordCount: false,
    showTokenCount: false,
    showTokenUsed: true,
    showModelName: true,
    showMessageTimestamp: false,
    showFirstTokenLatency: false,
    userAvatarKey: "",
    defaultAssistantAvatarKey: "",
    theme: Theme.System,
    language: "en",
    fontSize: 14,
    spellCheck: true,
    defaultPrompt: getDefaultPrompt(),
    allowReportingAndTracking: true,
    enableMarkdownRendering: true,
    enableLaTeXRendering: true,
    enableMermaidRendering: true,
    injectDefaultMetadata: true,
    autoPreviewArtifacts: false,
    autoCollapseCodeBlock: true,
    pasteLongTextAsAFile: true,
    autoGenerateTitle: true,
    autoCompaction: true,
    compactionThreshold: 0.6,
    autoLaunch: false,
    autoUpdate: true,
    betaUpdate: false,
    shortcuts: {
      quickToggle: "Alt+`",
      // 快速切换窗口显隐的快捷键
      inputBoxFocus: "mod+i",
      // 聚焦输入框的快捷键
      inputBoxWebBrowsingMode: "mod+e",
      // 切换输入框的 web 浏览模式的快捷键
      newChat: "mod+n",
      // 新建聊天的快捷键
      newPictureChat: "mod+shift+n",
      // 新建图片会话的快捷键
      sessionListNavNext: "mod+tab",
      // 切换到下一个会话的快捷键
      sessionListNavPrev: "mod+shift+tab",
      // 切换到上一个会话的快捷键
      sessionListNavTargetIndex: "mod",
      // 会话导航的快捷键
      messageListRefreshContext: "mod+r",
      // 刷新上下文的快捷键
      dialogOpenSearch: "mod+k",
      // 打开搜索对话框的快捷键
      inputBoxSendMessage: "Enter",
      // 发送消息的快捷键
      inputBoxSendMessageWithoutResponse: "Ctrl+Enter",
      // 发送但不生成回复的快捷键
      optionNavUp: "up",
      // 选项导航的快捷键
      optionNavDown: "down",
      // 选项导航的快捷键
      optionSelect: "enter"
      // 选项导航的快捷键
    },
    extension: {
      webSearch: {
        provider: "bing",
        serperApiKey: "",
        googleApiKey: "",
        googleCseId: "",
        tavilyApiKey: ""
      },
      knowledgeBase: {
        models: {
          embedding: void 0,
          rerank: void 0
        }
      },
      historySync: {
        enabled: false,
        endpoint: "",
        token: "",
        autoSync: false,
        intervalSeconds: 60
      },
      // documentParser is NOT set here - it uses platform-specific defaults
      // Desktop: 'local', Mobile/Web: 'none'
      // See settingsStore.ts for the platform-aware initialization logic
      documentParser: void 0
    },
    mcp: {
      servers: [],
      enabledBuiltinServers: []
    }
  };
}
function newConfigs() {
  return { uuid: v4() };
}
function getDefaultPrompt() {
  return "You are a helpful assistant.";
}
export {
  ModelProviderType as M,
  ProviderModelInfoSchema as P,
  Theme as T,
  ModelProviderEnum as a,
  MessageRoleEnum as b,
  newConfigs as n,
  settings as s
};
