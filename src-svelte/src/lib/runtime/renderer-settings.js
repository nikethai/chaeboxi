const modules = import.meta.glob('../../../../src/renderer/stores/settingsStore.ts')

export async function loadSettingsRuntime() {
	return await modules['../../../../src/renderer/stores/settingsStore.ts']()
}
