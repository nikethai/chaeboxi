/**
 * Shared instruction so models emit mermaid fences the UI can render
 * (with zoom), instead of ASCII art in ```text blocks.
 */

export const MERMAID_DIAGRAM_GUIDANCE = [
  '## Diagrams (required format)',
  'When you show architecture, sequences, flows, state machines, data models, or process loops:',
  '- Use a fenced code block with language tag **mermaid** (```mermaid … ```).',
  '- Do **not** draw diagrams as ASCII art or as ```text / ```plaintext blocks — those do not render in the app.',
  '- Prefer: sequenceDiagram, flowchart TB or LR, stateDiagram-v2, classDiagram, erDiagram, journey, gantt, or mindmap.',
  '- Keep node IDs simple (letters/numbers/underscores); put human labels in brackets or quotes.',
  '- Keep node labels short (≤ ~4 words or use <br/> for multi-line). Long single-line labels get clipped.',
  '- Prefer flowchart TB for tall stacks; LR only for few columns so text stays readable.',
  '- Only use ASCII if the user explicitly asks for plain-text art or mermaid cannot express the idea.',
].join('\n')

/** One-line reminder for continue bridges / short turns */
export const MERMAID_DIAGRAM_REMINDER =
  'For any diagram, use a ```mermaid fence (not ```text ASCII).'
