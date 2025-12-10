import vm from "node:vm";

import { unreachable } from "@std/assert";

import { fetchLehmerPayload, fetchTilesPuzzle } from "./fetch.ts";
import { isBase64Array } from "./util.ts";

async function solveJavascriptPuzzle(javascriptPuzzle: string) {
   const { promise, resolve } = Promise.withResolvers<string>();

   const sandbox = vm.createContext({
      createRequest: () => {
         return {
            open(method: string, url: string, async: boolean) {
               // `/lib/mason/puzzles/30.ajax.html?q=${getTimestampSeconds()}${/\w{8}\.\d{3}/}`
               resolve(url);
            },
            send() { }
         };
      }
   });

   const keys = new Set(Object.keys(sandbox));

   vm.runInContext(javascriptPuzzle, sandbox);

   const lehmerPayloadUrl = await promise;

   function extractTileDataUrls(sandbox: vm.Context) {
      for (const key of Object.keys(sandbox)) {
         if (!keys.has(key)) {
            const value = (sandbox as any)[key];
            if (Array.isArray(value) && value.length > 0) {
               if (isBase64Array(value)) {
                  return value;
               }
            }
         }
      }

      unreachable("Tile data URLs not found in sandbox");
   }

   const tileDataUrls = extractTileDataUrls(sandbox);

   return { lehmerPayloadUrl, tileDataUrls };
}



export async function solvePuzzleChallenge(questionId: string, md5Hash: string) {
   const tilesPuzzle = await fetchTilesPuzzle(questionId, md5Hash);

   const { lehmerPayloadUrl, tileDataUrls } = await solveJavascriptPuzzle(tilesPuzzle);

   const lehmerPayload = await fetchLehmerPayload(questionId, md5Hash, lehmerPayloadUrl);

   const tileMap = generateMap(lehmerPayload);

   const orderedTileDataUrls = tileMap.map(i => tileDataUrls[i]);

   return orderedTileDataUrls;
}


// Decodes a Lehmer code (factoradic) into a permutation
function decodeLehmer(lehmerCode: number[]) {
   const result = new Array<number>();
   let counter = 0;

   // Tracks which positions in the output are already filled
   const filledSlots = new Array(lehmerCode.length);
   for (let i = 0; i < lehmerCode.length; i++) {
      filledSlots[i] = 0;
   }

   for (let i = 0; i < lehmerCode.length; i++) {
      const skipsNeeded = lehmerCode[i];
      let emptySlotsFound = 0;
      let currentIdx = 0;

      // Find the N-th empty slot
      while ((emptySlotsFound != skipsNeeded + 1) && (emptySlotsFound < lehmerCode.length)) {
         // increment count if slot is 0 (empty)
         emptySlotsFound += 1 - filledSlots[currentIdx++];
      }

      // We overshot by one in the loop, step back
      --currentIdx;

      // Mark slot as filled and assign the sequential ID
      filledSlots[currentIdx] = 1;
      result[currentIdx] = counter++;
   }
   return result;
}

function invertPermutation(arr: Array<number>) {
   const inverted = new Array<number>(arr.length);
   for (let i = 0; i < arr.length; i++) {
      inverted[arr[i]] = i;
   }
   return inverted;
}

function generateMap(payload: string) {
   // Extract all digits 0-9
   const matchedDigits = payload.match(/[0-9]/g);
   if (matchedDigits === null || matchedDigits.length <= 1) {
      throw new Error("Malformed payload");
   }

   const digits = matchedDigits.map(d => parseInt(d, 10));

   // The first digit defines how many digits make up one number
   const codeLength = digits.shift()!;

   const codes = new Array<number>(Math.floor(digits.length / codeLength)).fill(0);

   // Convert digit chunks into codes
   for (let i = 0; i < digits.length; i++) {
      const targetIndex = Math.floor(i / codeLength);
      const powerOfTen = (codeLength - 1) - (i % codeLength);
      codes[targetIndex] += digits[i] * Math.pow(10, powerOfTen);
   }

   const permutation = decodeLehmer(codes);
   const invertedMap = invertPermutation(permutation);

   return invertedMap;
}
