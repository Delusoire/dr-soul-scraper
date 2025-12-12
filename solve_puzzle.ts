import type { Context } from "node:vm";

import { getLogger } from "@logtape/logtape";
import { unreachable } from "@std/assert/unreachable";
import { abortable } from "@std/async/abortable";
import type { QuickJSContext } from "quickjs-emscripten";

import { EVAL_STRATEGY, EVAL_TIMEOUT_MS } from "./config.ts";
import { importNodeVm, importQuickJS } from "./deps.ts";
import { fetchLehmerPayload, fetchTilesPuzzle } from "./fetch.ts";
import { isBase64Array, parseFixedWidthIntegers, wrapSignal } from "./util.ts";

const l = getLogger( [ "dss", "solver" ] );

async function runJavascriptPuzzle_QuickJS( javascriptPuzzle: string ) {
   const QUICKJS = importQuickJS();

   const { promise, resolve } = Promise.withResolvers<string>();

   const QuickJS = await QUICKJS.getQuickJS();
   const vm = QuickJS.newContext();

   const createRequestFn = vm.newFunction( "createRequest", () => {
      const requestObj = vm.newObject();
      const openFn = vm.newFunction( "open", ( _methodHandle, urlHandle, _asyncHandle ) => {
         const url = vm.getString( urlHandle );
         resolve( url );
      } );
      vm.setProp( requestObj, "open", openFn );
      openFn.dispose();

      const sendFn = vm.newFunction( "send", () => { } );
      vm.setProp( requestObj, "send", sendFn );
      sendFn.dispose();

      return requestObj;
   } );
   vm.setProp( vm.global, "createRequest", createRequestFn );
   createRequestFn.dispose();

   const keys = new Set( Object.keys( vm.dump( vm.global ) ) );

   l.trace`Running javascript puzzle in sandbox...`;
   const result = vm.evalCode( javascriptPuzzle );

   if ( result.error ) {
      const error = vm.dump( result.error );
      result.error.dispose();
      l.warn`Script execution error: ${ error }`;
   } else {
      result.value.dispose();
   }

   const lehmerPayloadUrl = await abortable(
      promise,
      wrapSignal( AbortSignal.timeout( EVAL_TIMEOUT_MS ), "Timed out waiting for Lehmer payload URL" )
   );
   l.trace`Extracted Lehmer payload URL: ${ lehmerPayloadUrl }`;

   const tileDataUrls = extractTileDataUrls( vm );
   l.trace`Extracted ${ tileDataUrls.length } tile data URLs`;

   vm.dispose();

   return { lehmerPayloadUrl, tileDataUrls };



   function extractTileDataUrls( vm: QuickJSContext ) {
      const globalDump = vm.dump( vm.global );
      for ( const key of Object.keys( globalDump ) ) {
         if ( !keys.has( key ) ) {
            const value = globalDump[ key ];
            if ( Array.isArray( value ) && value.length > 0 ) {
               if ( isBase64Array( value ) ) {
                  return value;
               }
            }
         }
      }

      unreachable( "Tile data URLs not found in sandbox" );
   }
}

async function runJavascriptPuzzle_NodeVm( javascriptPuzzle: string ) {
   const vm = importNodeVm();

   const { promise, resolve } = Promise.withResolvers<string>();

   const sandbox = vm.createContext( {
      createRequest: () => {
         return {
            open( _method: string, url: string, _async: boolean ) {
               resolve( url );
            },
            send() { }
         };
      }
   } );

   const keys = new Set( Object.keys( sandbox ) );

   l.trace`Running javascript puzzle in sandbox...`;
   vm.runInContext( javascriptPuzzle, sandbox );

   const lehmerPayloadUrl = await abortable(
      promise,
      wrapSignal( AbortSignal.timeout( EVAL_TIMEOUT_MS ), "Timed out waiting for Lehmer payload URL" )
   );
   l.trace`Extracted Lehmer payload URL: ${ lehmerPayloadUrl }`;

   const tileDataUrls = extractTileDataUrls( sandbox );
   l.trace`Extracted ${ tileDataUrls.length } tile data URLs`;

   return { lehmerPayloadUrl, tileDataUrls };



   function extractTileDataUrls( sandbox: Context ) {
      for ( const key of Object.keys( sandbox ) ) {
         if ( !keys.has( key ) ) {
            const value = sandbox[ key ];
            if ( Array.isArray( value ) && value.length > 0 ) {
               if ( isBase64Array( value ) ) {
                  return value;
               }
            }
         }
      }

      unreachable( "Tile data URLs not found in sandbox" );
   }
}

async function runJavascriptPuzzle( javascriptPuzzle: string ) {
   let result: { lehmerPayloadUrl: string; tileDataUrls: string[]; };

   if ( EVAL_STRATEGY === "quickjs" ) {
      result = await runJavascriptPuzzle_QuickJS( javascriptPuzzle );
   } else if ( EVAL_STRATEGY === "node_vm" ) {
      result = await runJavascriptPuzzle_NodeVm( javascriptPuzzle );
   } else {
      unreachable( `Unsupported EVAL_STRATEGY: ${ EVAL_STRATEGY }` );
   }

   return result;
}

export async function solvePuzzleChallenge( questionId: string, md5Hash: string ) {
   const tilesPuzzle = await fetchTilesPuzzle( questionId, md5Hash );
   const { lehmerPayloadUrl, tileDataUrls } = await runJavascriptPuzzle( tilesPuzzle );

   const { payload } = await fetchLehmerPayload( questionId, md5Hash, lehmerPayloadUrl );
   const tileMap = generateChallengeMap( payload );

   const orderedTileDataUrls = tileMap.map( i => tileDataUrls[ i ] );

   l.trace`Solved puzzle with ${ orderedTileDataUrls.length } tiles`;
   return orderedTileDataUrls;
}


// Decodes a Lehmer code (factoradic) into a permutation
function decodeLehmer0( lehmerCode: number[] ) {
   const result = new Array<number>();
   let counter = 0;

   // Tracks which positions in the output are already filled
   const filledSlots = new Array( lehmerCode.length ).fill( 0 );

   for ( let i = 0; i < lehmerCode.length; i++ ) {
      const skipsNeeded = lehmerCode[ i ];

      let emptySlotsFound = 0;
      let currentIdx = 0;

      // Find the N-th empty slot
      while ( ( emptySlotsFound < skipsNeeded + 1 ) && ( emptySlotsFound < lehmerCode.length ) ) { // probably (currentIndex < lehmerCode.length) but oh well

         const isSlotEmpty = 1 - filledSlots[ currentIdx ];
         emptySlotsFound += isSlotEmpty;

         currentIdx++;
      }

      // We overshot by one in the loop, step back
      --currentIdx;

      // Mark slot as filled and assign the sequential ID
      filledSlots[ currentIdx ] = 1;
      result[ currentIdx ] = counter++;
   }
   return result;
}

function invertPermutation0( arr: Array<number> ) {
   const inverted = new Array<number>( arr.length );
   for ( let i = 0; i < arr.length; i++ ) {
      inverted[ arr[ i ] ] = i;
   }
   return inverted;
}

function generateChallengeMap( payload: string ) {
   l.trace`Generating tile map from Lehmer payload...`;

   // Extract all digits 0-9
   const matchedDigits = payload.match( /\d/g );
   if ( matchedDigits === null ) {
      unreachable( "Payload does not contain any digits." );
   }

   // The first digit defines how many digits make up one number
   const chunkLength = parseInt( matchedDigits.shift()!, 10 );
   const keyDigits = matchedDigits.join( "" );
   // TODO: improve heuristic
   if ( keyDigits.length < chunkLength ) {
      unreachable( "Payload does not contain enough digits." );
   }

   const lehmerChunks = parseFixedWidthIntegers( keyDigits, chunkLength );

   // const chunks = new Array<number>(Math.floor(digits.length / codeLength)).fill(0);
   // for (let i = 0; i < digits.length; i++) {
   //    const targetIndex = Math.floor(i / codeLength);
   //    const powerOfTen = (codeLength - 1) - (i % codeLength);
   //    chunks[targetIndex] += digits[i] * Math.pow(10, powerOfTen);
   // }

   const permutation = decodeLehmer0( lehmerChunks );
   const invertedMap = invertPermutation0( permutation );

   return invertedMap;
}
