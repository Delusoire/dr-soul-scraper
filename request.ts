import { delay } from "@std/async/delay";

import { lerp, wrapTask, type Task } from "./util.ts";

export class FutureQueue {
   #queue = new Array<Task>();
   #isProcessing = false;

   #minDelayMs: number;
   #maxDelayMs: number;

   constructor(minDelayMs: number, maxDelayMs: number) {
      this.#minDelayMs = minDelayMs;
      this.#maxDelayMs = maxDelayMs;
   }

   add<T>(fn: Task<T>): Promise<T> {
      const { task, future } = wrapTask(fn);

      this.#queue.push(task);
      this.#process();

      return future;
   }

   async #process() {
      if (this.#isProcessing) return;
      this.#isProcessing = true;

      while (this.#queue.length > 0) {
         const task = this.#queue.shift();
         if (task) await task();

         // Wait for delay ONLY if there are more items pending
         if (this.#queue.length > 0) {
            await delay(this.#getDelayMs());
         }
      }

      this.#isProcessing = false;
   }

   #getDelayMs() {
      return lerp(this.#minDelayMs, this.#maxDelayMs, Math.random());
   }
}
