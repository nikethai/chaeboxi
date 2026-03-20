import "clsx";
import { v4 } from "uuid";
import { b as MessageRoleEnum } from "./defaults.js";
function createMessage(role = MessageRoleEnum.User, content = "") {
  return {
    id: v4(),
    contentParts: content ? [{ type: "text", text: content }] : [],
    role,
    timestamp: Date.now()
  };
}
class ConversationStore {
  ready = false;
  sessions = [];
  currentSessionId = null;
  currentSession = null;
  draftChatModel = null;
  chatModule = null;
  helpersModule = null;
  messagesModule = null;
  lastUsedModelModule = null;
  queryClientModule = null;
  initializing = null;
  unsubscribeQueryCache = null;
  constructor() {
  }
  get messages() {
    if (!this.currentSession || !this.helpersModule) {
      return [];
    }
    return this.helpersModule.getAllMessageList(this.currentSession);
  }
  get lastGeneratingMessage() {
    const messages = this.messages;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.generating) {
        return messages[index];
      }
    }
    return null;
  }
  get currentDisplayTitle() {
    if (!this.currentSession) {
      return "New chat";
    }
    return this.currentSession.threadName || this.currentSession.name || "Untitled";
  }
  get currentDisplaySubtitle() {
    if (!this.currentSession) {
      return this.sessions.length > 0 ? `${this.sessions.length} conversations available` : "Start a real conversation";
    }
    if (this.currentSession.threadName && this.currentSession.threadName !== this.currentSession.name) {
      return this.currentSession.name;
    }
    const messageCount = this.messages.length;
    return messageCount === 0 ? "No messages yet" : `${messageCount} message${messageCount === 1 ? "" : "s"}`;
  }
  syncSessionsFromCache() {
    if (!this.queryClientModule) {
      return;
    }
    const cachedSessions = this.queryClientModule.queryClient.getQueryData(["chat-sessions-list"]);
    if (cachedSessions) {
      this.sessions = cachedSessions.filter((session) => !session.hidden);
    }
    if (this.currentSessionId) {
      const cachedSession = this.queryClientModule.queryClient.getQueryData(["chat-session", this.currentSessionId]);
      if (cachedSession !== void 0) {
        this.currentSession = cachedSession;
      }
    }
  }
  syncDraftModelFromSession() {
    if (!this.helpersModule || !this.lastUsedModelModule) {
      return;
    }
    const initialSession = this.helpersModule.initEmptyChatSession();
    const provider = initialSession.settings?.provider;
    const modelId = initialSession.settings?.modelId;
    if (provider && modelId) {
      this.draftChatModel = { provider, modelId };
      this.lastUsedModelModule.lastUsedModelStore.getState().setChatModel(provider, modelId);
    }
  }
  async init() {
    {
      return;
    }
  }
  async loadSession(sessionId) {
    await this.init();
    if (!this.chatModule) {
      return null;
    }
    this.currentSessionId = sessionId;
    this.currentSession = await this.chatModule.getSession(sessionId);
    const provider = this.currentSession?.settings?.provider;
    const modelId = this.currentSession?.settings?.modelId;
    if (provider && modelId && this.lastUsedModelModule) {
      this.lastUsedModelModule.lastUsedModelStore.getState().setChatModel(provider, modelId);
    }
    return this.currentSession;
  }
  clearCurrentSession() {
    this.currentSessionId = null;
    this.currentSession = null;
  }
  setDraftChatModel(model) {
    this.draftChatModel = model;
    if (this.lastUsedModelModule) {
      this.lastUsedModelModule.lastUsedModelStore.getState().setChatModel(model.provider, model.modelId);
    }
  }
  async updateSessionModel(sessionId, model) {
    await this.init();
    if (!this.chatModule) {
      return;
    }
    const session = this.currentSessionId === sessionId ? this.currentSession : await this.chatModule.getSession(sessionId);
    if (!session) {
      return;
    }
    await this.chatModule.updateSession(sessionId, {
      settings: {
        ...session.settings || {},
        provider: model.provider,
        modelId: model.modelId
      }
    });
    this.lastUsedModelModule?.lastUsedModelStore.getState().setChatModel(model.provider, model.modelId);
  }
  async renameSession(sessionId, name) {
    await this.init();
    if (!this.chatModule) {
      return;
    }
    const trimmedName = name.trim() || "Untitled";
    await this.chatModule.updateSession(sessionId, { name: trimmedName, threadName: trimmedName });
    this.sessions = this.sessions.map((session) => session.id === sessionId ? { ...session, name: trimmedName } : session);
    if (this.currentSession?.id === sessionId) {
      this.currentSession = {
        ...this.currentSession,
        name: trimmedName,
        threadName: trimmedName
      };
    }
  }
  async createSessionAndSubmit(messageText, model) {
    await this.init();
    if (!this.chatModule || !this.helpersModule || !this.messagesModule) {
      return null;
    }
    const newSession = this.helpersModule.initEmptyChatSession();
    const selectedModel = model || this.draftChatModel;
    if (selectedModel) {
      newSession.settings = {
        ...newSession.settings || {},
        provider: selectedModel.provider,
        modelId: selectedModel.modelId
      };
      this.lastUsedModelModule?.lastUsedModelStore.getState().setChatModel(selectedModel.provider, selectedModel.modelId);
    }
    const createdSession = await this.chatModule.createSession(newSession);
    this.currentSessionId = createdSession.id;
    this.currentSession = createdSession;
    void this.messagesModule.submitNewUserMessage(createdSession.id, {
      newUserMsg: createMessage("user", messageText),
      needGenerating: true
    });
    return createdSession;
  }
  async submitToSession(sessionId, messageText) {
    await this.init();
    if (!this.messagesModule) {
      return;
    }
    void this.messagesModule.submitNewUserMessage(sessionId, {
      newUserMsg: createMessage("user", messageText),
      needGenerating: true
    });
  }
  async stopGenerating(sessionId) {
    await this.init();
    if (!this.messagesModule) {
      return false;
    }
    const session = this.currentSessionId === sessionId ? this.currentSession : await this.loadSession(sessionId);
    if (!session || !this.helpersModule) {
      return false;
    }
    const messageList = this.helpersModule.getAllMessageList(session);
    let generatingMessage;
    for (let index = messageList.length - 1; index >= 0; index -= 1) {
      if (messageList[index]?.generating) {
        generatingMessage = messageList[index];
        break;
      }
    }
    if (!generatingMessage) {
      return false;
    }
    generatingMessage.cancel?.();
    await this.messagesModule.modifyMessage(sessionId, { ...generatingMessage, generating: false }, true);
    return true;
  }
}
const conversationStore = new ConversationStore();
export {
  conversationStore as c
};
