import type { UpdaterFn } from 'src/shared/types'

// 原子性执行update操作，避免数据竞态
export class UpdateQueue<T> {
  private state: T
  private q: { updater: UpdaterFn<T>; resolve: (result: T) => void; reject: (error: unknown) => void }[] = []
  private scheduled = false
  private onChange?: (s: T) => void

  constructor(initial: T, onChange?: (s: T) => void) {
    this.state = initial
    this.onChange = onChange
  }

  set(update: UpdaterFn<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.q.push({ updater: update, resolve, reject })
      if (!this.scheduled) {
        this.scheduled = true
        queueMicrotask(() => {
          this.scheduled = false
          this.flush()
        })
      }
    })
  }

  /** 可供测试时手动触发；正常情况下由微任务自动触发 */
  flush(): void {
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
