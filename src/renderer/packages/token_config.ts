// import { ModelProvider, SessionSettings } from '../../shared/types'
// import { openaiModelConfigs } from '../packages/models/openai'
// import * as defaults from '../../shared/defaults'

/**
 * 、， maxTokens、maxContextTokens
 */
// export function resetTokenConfig(settings: SessionSettings): SessionSettings {
//     switch (settings.aiProvider) {
//         case ModelProviderEnum.OpenAI:
//             const model = getTokenLimits(settings)
// settings.openaiMaxTokens = model.maxTokens //
// settings.openaiMaxContextTokens = model.maxContextTokens //
//             if (settings.model.startsWith('gpt-4')) {
//                 settings.openaiMaxContextMessageCount = 6
//             } else {
//                 settings.openaiMaxContextMessageCount = 999
//             }
//             break
//         case ModelProviderEnum.Azure:
//             settings.openaiMaxTokens = defaults.settings().openaiMaxTokens
//             settings.openaiMaxContextTokens = defaults.settings().openaiMaxContextTokens
//             settings.openaiMaxContextMessageCount = 8
//             break
//         case ModelProviderEnum.ChatboxAI:
//             settings.openaiMaxTokens = 0
//             settings.openaiMaxContextTokens = 128_000
//             settings.openaiMaxContextMessageCount = 8
//             break
//         case ModelProviderEnum.ChatGLM6B:
//             settings.openaiMaxTokens = 0
//             settings.openaiMaxContextTokens = 2000
//             settings.openaiMaxContextMessageCount = 4
//             break
//         case ModelProviderEnum.Claude:
//             settings.openaiMaxContextMessageCount = 10
//             break
//         default:
//             break
//     }
//     return settings
// }

/**
 *  maxTokens、maxContextTokens
 * @param settings
 * @returns
 */
// export function getTokenLimits(settings: SessionSettings) {
//     if (settings.aiProvider === ModelProviderEnum.OpenAI && settings.model !== 'custom-model') {
//         return openaiModelConfigs[settings.model]
//     }
//     return {
//         maxTokens: 4_096,
//         maxContextTokens: 128_000,
//     }
// }
