/** ComfyUI API format workflow node */
export interface ComfyUINode {
  inputs: Record<string, unknown>
  class_type: string
  _meta?: { title: string }
}

/** Full API-format workflow (node IDs as string keys) */
export type ComfyUIWorkflow = Record<string, ComfyUINode>

export interface ComfyUILoraConfig {
  name: string
  strengthModel?: number
  strengthClip?: number
}

/** POST /prompt response */
export interface ComfyUIPromptResponse {
  prompt_id: string
  number: number
  node_errors: Record<string, unknown>
}

/** Image output entry from GET /history/{id} */
export interface ComfyUIOutputImage {
  filename: string
  subfolder: string
  type: string // "output" | "temp"
}

/** Single history entry from GET /history/{id} */
export interface ComfyUIHistoryEntry {
  outputs: Record<string, { images?: ComfyUIOutputImage[] }>
  status: { status_str: string; completed: boolean }
}

/** GET /object_info node type definition */
export interface ComfyUIObjectInfo {
  [nodeType: string]: {
    input: {
      required?: Record<string, [string[] | string, ...unknown[]]>
      optional?: Record<string, [string[] | string, ...unknown[]]>
    }
    output: string[]
    output_name: string[]
    name: string
    display_name: string
    category: string
  }
}

/** Parameters passed per-generation for ComfyUI */
export interface ComfyUIGenerationParams {
  checkpoint?: string
  loras?: ComfyUILoraConfig[]
  lora?: string
  loraStrength?: number
  negativePrompt?: string
  steps?: number
  cfg?: number
  samplerName?: string
  scheduler?: string
  orientation?: 'vertical' | 'horizontal'
  upscale?: boolean
  seed?: number
}

/** Cached info parsed from /object_info */
export interface ComfyUIServerInfo {
  checkpoints: string[]
  loras: string[]
  samplers: string[]
  schedulers: string[]
}
