const modules = import.meta.glob('../../../../src/renderer/stores/uiStore.ts')

export async function loadUIRuntime() {
	return await modules['../../../../src/renderer/stores/uiStore.ts']()
}
