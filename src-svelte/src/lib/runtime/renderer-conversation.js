const modules = import.meta.glob([
	'../../../../src/renderer/stores/chatStore.ts',
	'../../../../src/renderer/stores/sessionHelpers.ts',
	'../../../../src/renderer/stores/session/messages.ts',
	'../../../../src/renderer/stores/lastUsedModelStore.ts',
	'../../../../src/renderer/stores/queryClient.ts',
])

export async function loadConversationRuntime() {
	const [chatStore, sessionHelpers, sessionMessages, lastUsedModelModule, queryClientModule] = await Promise.all([
		modules['../../../../src/renderer/stores/chatStore.ts'](),
		modules['../../../../src/renderer/stores/sessionHelpers.ts'](),
		modules['../../../../src/renderer/stores/session/messages.ts'](),
		modules['../../../../src/renderer/stores/lastUsedModelStore.ts'](),
		modules['../../../../src/renderer/stores/queryClient.ts'](),
	])

	return {
		chatStore,
		sessionHelpers,
		sessionMessages,
		initLastUsedModelStore: lastUsedModelModule.initLastUsedModelStore,
		lastUsedModelStore: lastUsedModelModule.lastUsedModelStore,
		queryClient: queryClientModule.queryClient,
	}
}
