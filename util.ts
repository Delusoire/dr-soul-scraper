import { assert } from "@std/assert";

export function generateRandomId(length = 8): string {
   const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let result = "";
   for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return result;
}

const BASE_64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function isBase64Array(arr: any[]): arr is string[] {
   return arr.every(v => typeof v === "string" && BASE_64.test(v));
};

export function parseYearFromCorrigeId(corrigeId: string): number {
   const yearStr = corrigeId.slice(-4);
   const year = parseInt(yearStr, 10);
   assert(!isNaN(year), "Invalid year in corrige ID");
   return year;
}

export function checkStringBoolean(string?: string | null | undefined) {
   return string === "true" || string === "false";
}

export type Task<T = void> = () => Promise<T>;

export function wrapTask<T>(sink: Task<T>) {
   const { promise, resolve, reject } = Promise.withResolvers<T>();

   const source = async () => {
      try {
         const result = await sink();
         resolve(result);
      } catch (error) {
         reject(error);
      }
   };

   return { task: source, future: promise };
}

export function lerp(a: number, b: number, t: number) {
   return a * (1 - t) + b * t;
}

export const TAU = Math.PI * 2;

export function delayGeneratorMs() {
   const t = Date.now();
   const T = 1500;
   const theta = t * TAU / T;

   const t1 = theta / 30;
   const t2 = theta / 2.5;
   const t3 = theta / 0.208;

   const a1 = 650;
   const a2 = 450;
   const a3 = 250;

   const e = 1850;

   return a1 * Math.sin(t1) + a2 * Math.sin(t2) + a3 * Math.sin(t3) + e;
}

export function getTimestampSeconds() {
   return Math.floor(Date.now() / 1000);
}
