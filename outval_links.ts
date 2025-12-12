import vm from "node:vm";

import { getLogger } from "@logtape/logtape";
import { unreachable } from "@std/assert";

import { parseFixedWidthIntegers } from "./util.ts";

const LINK_FN_CALL_SIG = /link\("[a-zA-Z0-9]{8}","(?<id>[^"]+)","(?<short>[^"]+)","(?<preHash>[a-f0-9]{77})"\);/g;
type MATCHED_LINK = { id: string; short: string; hash: string; };

const l = getLogger( [ "dss", "outval" ] );

export async function outvalJavascriptLinks( mangledScript: string ) {
   const { promise, resolve } = Promise.withResolvers<string>();

   const sandbox = vm.createContext( {
      eval: ( injectedScript: string ) => {
         resolve( injectedScript );
      }
   } );

   l.trace`Scraping links from javascript...`;
   vm.runInContext( mangledScript, sandbox );

   const injectedScript = await promise;

   const matches = injectedScript.matchAll( LINK_FN_CALL_SIG );
   const links = matches
      .map( match => ( {
         id: match.groups!.id,
         short: match.groups!.short,
         hash: generateChallengeHash( match.groups!.preHash )
      } as MATCHED_LINK ) )
      .toArray();
   l.trace`Extracted ${ links.length } links from javascript.`;

   return links;
}

// Calculates the shuffle order (permutation) based on the key digits.
function decodeLehmer1( keyDigits: number[] ): number[] {
   const result = new Array<number>( keyDigits.length );
   let counter = 0;

   // Tracks which positions in the output are already filled
   const filledSlots = new Array( keyDigits.length ).fill( 0 );

   for ( let i = 0; i < keyDigits.length; i++ ) {
      const skipsRequired = keyDigits[ i ];

      let emptySlotsFound = 0;
      let currentIndex = 0;

      // Search for the (skipsRequired + 1)th empty slot
      while ( ( emptySlotsFound < skipsRequired + 1 ) && ( currentIndex < keyDigits.length ) ) {

         const isSlotEmpty = 1 - filledSlots[ currentIndex ];
         emptySlotsFound += isSlotEmpty;

         currentIndex++;
      }

      // We overshot by one in the loop, step back
      --currentIndex;

      // Mark slot as filled and assign the sequential ID
      filledSlots[ currentIndex ] = 1;
      result[ currentIndex ] = ++counter;
   }

   return result;
}

function invertPermutation1( arr: Array<number> ) {
   const inverted = new Array<number>( arr.length );
   for ( let i = 0; i < arr.length; i++ ) {
      inverted[ arr[ i ] - 1 ] = i;
   }
   return inverted;
}

function generateChallengeHash( payload: string ): string {
   l.trace`Generating challenge token from raw input: ${ payload }...`;

   // Extract all digits 0-9
   const matchedDigits = payload.match( /\d/g );
   if ( matchedDigits === null || matchedDigits.length < 48 ) {
      unreachable( "Input string does not contain enough digits." );
   }

   // The last 8 digits form the key for the Lehmer code
   const keyDigits = matchedDigits
      .slice( 40, 48 )
      .map( d => parseInt( d, 10 ) );

   const permutation = decodeLehmer1( keyDigits );
   const invertedMap = invertPermutation1( permutation );

   // The first 40 digits form the mangled hash
   const mangledHash = matchedDigits.slice( 0, 40 ).join( "" );

   const mangledHashChunks = parseFixedWidthIntegers( mangledHash, 5 );

   const hashChunks = invertedMap.map( i => mangledHashChunks[ i ] );
   const hash = hashChunks
      .map( v => v.toString( 16 ).padStart( 4, "0" ) )
      .join( "" );

   return hash;
}
