import { delay } from "@std/async/delay";

import { lerp, wrapTask, type Task } from "./util.ts";

export class FutureQueue {
   #queue = new Array<Task>();
   #isProcessing = false;
   #delayGenerator: () => number;

   constructor(delayGenerator: () => number) {
      this.#delayGenerator = delayGenerator;
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

         if (this.#queue.length > 0) {
            await delay(this.#delayGenerator());
         }
      }

      this.#isProcessing = false;
   }
}
