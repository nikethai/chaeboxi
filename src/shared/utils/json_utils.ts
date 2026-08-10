/**
 * (legacy comment)
 * @param json JSON
 * (legacy comment)
 */
export function parseJsonOrEmpty(json: string): any {
  try {
    return JSON.parse(json)
  } catch (e) {
    return {}
  }
} 