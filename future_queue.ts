import { getLogger } from "@logtape/logtape";
import { delay } from "@std/async/delay";

import { wrapTask, type Task } from "./util.ts";

const l = getLogger( [ "dss", "queue" ] );

export class FutureQueue {
   #queue = new Array<[ number, Task ]>();
   #isProcessing = false;
   #delayGenerator: () => number;

   constructor( delayGenerator: () => number ) {
      this.#delayGenerator = delayGenerator;
   }

   add<T>( fn: Task<T>, delayMs?: number ): Promise<T> {
      const { task, future } = wrapTask( fn );

      this.#queue.push( [ delayMs ?? this.#delayGenerator(), task ] );
      this.#process();

      return future;
   }

   async #process() {
      if ( this.#isProcessing ) return;
      this.#isProcessing = true;

      while ( this.#queue.length > 0 ) {
         const [ delayMs, task ] = this.#queue.shift()!;
         l.trace`Delaying next task by ${ delayMs } ms`;
         await delay( delayMs );
         await task();
      }

      this.#isProcessing = false;
   }
}
