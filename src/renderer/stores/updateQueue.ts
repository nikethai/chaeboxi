import type { UpdaterFn } from 'src/shared/types'

// 原子性执行update操作，避免数据竞态
export class UpdateQueue<T extends object> {
  private state: T | null = null
  private q: { updater: UpdaterFn<T>; resolve: (result: T) => void; reject: (error: unknown) => void }[] = []
  private scheduled = false

  constructor(
    private initial: T | (() => Promise<T | null>),
    private onChange?: (s: T | null) => void
  ) {}

  set(update: UpdaterFn<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.q.push({ updater: update, resolve, reject })
      if (!this.scheduled) {
        this.scheduled = true
        queueMicrotask(async () => {
          await this.flush().finally(() => {
            this.scheduled = false
          })
        })
      }
    })
  }

  /** 可供测试时手动触发；正常情况下由微任务自动触发 */
  async flush(): Promise<void> {
    if (this.state === null) {
      if (typeof this.initial === 'function') {
        this.state = await (this.initial as () => Promise<T | null>)()
      } else {
        this.state = this.initial
      }
    }
    if (this.q.length === 0) return
    let s = this.state
    for (const u of this.q) {
      try {
        s = u.updater(s)
        u.resolve(s)
      } catch (e) {
        u.reject(e)
      }
    }
    this.q.length = 0
    if (s !== this.state) {
      this.state = s
      this.onChange?.(s)
    }
  }
}
