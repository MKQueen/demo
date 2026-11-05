/**
 * 键盘输入封装（基于 Node 自带的 readline）。
 *
 * 这个版本比"直接 rl.question"多了一个**行队列**，原因很实际：
 *
 *   Agent 跑一轮可能要几秒到几十秒。这期间如果输入是管道（`printf 'a\nb' | ...`）
 *   或者用户手快多敲了几行，readline 会立刻把后续行以 `line` 事件发出来。
 *   如果没人监听，这些行就被静默丢掉了 —— 表现为"管道里第二条斜杠命令不生效"。
 *
 * 所以我们统一监听 `line` 事件：
 *   - 有人在等（ask 返回的 Promise 还没 resolve）→ 直接给他
 *   - 没人在等 → 放进队列，等下一次 ask 取走
 *
 * 交互式终端下 readline 自己负责回显和行编辑；非 TTY 下没有回显，
 * main.ts 会把用户输入补打到屏幕上。
 */
import readline from "node:readline";

export class Input {
  private rl: readline.Interface;
  private queue: string[] = [];
  private waiter: ((value: string | null) => void) | null = null;
  private closed = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      // terminal: true 时 readline 接管光标、支持行编辑与回显
      terminal: process.stdin.isTTY === true,
    });

    this.rl.on("line", (line) => {
      if (this.waiter) {
        const resolve = this.waiter;
        this.waiter = null;
        resolve(line);
      } else {
        this.queue.push(line);
      }
    });

    // Ctrl+D / 输入流结束：让正在等待的 ask() 返回 null
    this.rl.on("close", () => {
      this.closed = true;
      const resolve = this.waiter;
      this.waiter = null;
      resolve?.(null);
    });
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** 显示提示语并等待一行输入。返回 null 表示输入结束（EOF）。 */
  ask(question: string): Promise<string | null> {
    if (question) process.stdout.write(question);

    // 先消费队列里已经到达的行（Agent 运行期间攒下的）
    if (this.queue.length > 0) {
      return Promise.resolve(this.queue.shift()!);
    }
    if (this.closed) return Promise.resolve(null);

    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  close(): void {
    if (!this.closed) this.rl.close();
  }
}
