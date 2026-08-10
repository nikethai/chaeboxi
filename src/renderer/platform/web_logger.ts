import dayjs from 'dayjs'
import localforage from 'localforage'

const LOG_STORAGE_KEY = 'chatbox-app-logs'
const MAX_LOG_ENTRIES = 1000 // (legacy)
const MAX_LOG_AGE_DAYS = 30 // (legacy)

interface LogEntry {
  timestamp: string
  level: string
  message: string
}

/**
 * (legacy comment)
 *  localforage (IndexedDB)
 */
export class WebLogger {
  private static instance: WebLogger
  private logBuffer: LogEntry[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  private constructor() {}

  public static getInstance(): WebLogger {
    if (!WebLogger.instance) {
      WebLogger.instance = new WebLogger()
    }
    return WebLogger.instance
  }

  /**
   * (legacy comment removed)
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return

    try {
      // (legacy comment removed)
      await this.cleanupOldLogs()
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize web logger:', error)
    }
  }

  /**
   * (legacy comment removed)
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const logs = await this.getStoredLogs()
      if (logs.length === 0) return

      const cutoffDate = dayjs().subtract(MAX_LOG_AGE_DAYS, 'day')
      const filteredLogs = logs.filter((log) => {
        const logDate = dayjs(log.timestamp)
        return logDate.isAfter(cutoffDate)
      })

      // MAX_LOG_ENTRIES
      const trimmedLogs = filteredLogs.slice(-MAX_LOG_ENTRIES)

      if (trimmedLogs.length !== logs.length) {
        await localforage.setItem(LOG_STORAGE_KEY, trimmedLogs)
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
    }
  }

  /**
   * (legacy comment removed)
   */
  private async getStoredLogs(): Promise<LogEntry[]> {
    try {
      const logs = await localforage.getItem<LogEntry[]>(LOG_STORAGE_KEY)
      return logs || []
    } catch (error) {
      return []
    }
  }

  /**
   * (legacy comment removed)
   */
  public log(level: string, message: string): void {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')

    // (legacy comment removed)
    console.log(`APP_LOG: [${level}] ${message}`)

    // (legacy comment removed)
    this.logBuffer.push({ timestamp, level: level.toUpperCase(), message })

    // (legacy comment removed)
    this.scheduleFlush()
  }

  /**
   * (legacy comment removed)
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return

    // (legacy comment removed)
    this.flushTimer = setTimeout(() => {
      this.flush()
    }, 1000)
  }

  /**
   * (legacy comment removed)
   */
  private async flush(): Promise<void> {
    this.flushTimer = null

    if (this.logBuffer.length === 0) return

    const newLogs = [...this.logBuffer]
    this.logBuffer = []

    try {
      const existingLogs = await this.getStoredLogs()
      const allLogs = [...existingLogs, ...newLogs]

      // (legacy comment removed)
      const trimmedLogs = allLogs.slice(-MAX_LOG_ENTRIES)

      await localforage.setItem(LOG_STORAGE_KEY, trimmedLogs)
    } catch (error) {
      console.error('Failed to save logs:', error)
    }
  }

  /**
   * (legacy comment removed)
   */
  public async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }

  /**
   * (legacy comment removed)
   * (legacy comment)
   */
  public async exportLogs(): Promise<string> {
    // (legacy comment removed)
    await this.flushNow()

    try {
      const logs = await this.getStoredLogs()
      return logs.map((log) => `[${log.timestamp}] [${log.level}] ${log.message}`).join('\n')
    } catch (error) {
      console.error('Failed to export logs:', error)
      return ''
    }
  }

  /**
   * (legacy comment removed)
   */
  public async clearLogs(): Promise<void> {
    this.logBuffer = []
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    try {
      await localforage.removeItem(LOG_STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }
}

export default WebLogger.getInstance()
