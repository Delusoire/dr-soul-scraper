import vm from "node:vm";

import { getLogger } from "@logtape/logtape";
import { unreachable } from "@std/assert";

import { fetchLehmerPayload, fetchTilesPuzzle } from "./fetch.ts";
import { isBase64Array, parseFixedWidthIntegers } from "./util.ts";

const l = getLogger( [ "dss", "solver" ] );

async function runJavascriptPuzzle( javascriptPuzzle: string ) {
   const { promise, resolve } = Promise.withResolvers<string>();

   const sandbox = vm.createContext( {
      createRequest: () => {
         return {
            open( method: string, url: string, async: boolean ) {
               // `/lib/mason/puzzles/30.ajax.html?q=${getTimestampSeconds()}${/\w{8}\.\d{3}/}`
               resolve( url );
            },
            send() { }
         };
      }
   } );

   const keys = new Set( Object.keys( sandbox ) );

   l.trace`Running javascript puzzle in sandbox...`;
   vm.runInContext( javascriptPuzzle, sandbox );

   const lehmerPayloadUrl = await promise;
   l.trace`Extracted Lehmer payload URL: ${ lehmerPayloadUrl }`;

   const tileDataUrls = extractTileDataUrls( sandbox );
   l.trace`Extracted ${ tileDataUrls.length } tile data URLs`;

   return { lehmerPayloadUrl, tileDataUrls };

   function extractTileDataUrls( sandbox: vm.Context ) {
      for ( const key of Object.keys( sandbox ) ) {
         if ( !keys.has( key ) ) {
            const value = ( sandbox as any )[ key ];
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
