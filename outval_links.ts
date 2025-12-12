
import { getLogger } from "@logtape/logtape";
import { unreachable } from "@std/assert/unreachable";

import { EVAL_STRATEGY } from "./config.ts";
import { importNodeVm, importQuickJS } from "./deps.ts";
import { parseFixedWidthIntegers } from "./util.ts";

const LINK_FN_CALL_SIG = /link\("[a-zA-Z0-9]{8}","(?<id>[^"]+)","(?<short>[^"]+)","(?<preHash>[a-f0-9]{77})"\);/g;
type MATCHED_LINK = { id: string; short: string; hash: string; };

const l = getLogger( [ "dss", "outval" ] );

async function outvalJavascriptLinks_QuickJS( mangledScript: string ) {
   const QUICKJS = importQuickJS();

   const { promise, resolve } = Promise.withResolvers<string>();

   const QuickJS = await QUICKJS.getQuickJS();
   const vm = QuickJS.newContext();

   const evalFn = vm.newFunction( "eval", ( handle ) => {
      const injectedScript = vm.getString( handle );
      resolve( injectedScript );
   } );
   vm.setProp( vm.global, "eval", evalFn );
   evalFn.dispose();

   l.trace`Scraping links from javascript...`;
   const result = vm.evalCode( mangledScript );

   if ( result.error ) {
      const error = vm.dump( result.error );
      result.error.dispose();
      l.warn`Script execution error: ${ error }`;
   } else {
      result.value.dispose();
   }

   const injectedScript = await promise;
   vm.dispose();

   return injectedScript;
}

async function outvalJavascriptLinks_NodeVm( mangledScript: string ) {
   const NodeVM = importNodeVm();

   const { promise, resolve } = Promise.withResolvers<string>();

   const sandbox = NodeVM.createContext( {
      eval: ( injectedScript: string ) => {
         resolve( injectedScript );
      }
   } );

   l.trace`Scraping links from javascript...`;
   NodeVM.runInContext( mangledScript, sandbox );

   const injectedScript = await promise;

   return injectedScript;
}

export async function outvalJavascriptLinks( mangledScript: string ) {
   let injectedScript: string;

   if ( EVAL_STRATEGY === "quickjs" ) {
      injectedScript = await outvalJavascriptLinks_QuickJS( mangledScript );
   } else if ( EVAL_STRATEGY === "node_vm" ) {
      injectedScript = await outvalJavascriptLinks_NodeVm( mangledScript );
   } else {
      unreachable( `Unsupported EVAL_STRATEGY: ${ EVAL_STRATEGY }` );
   }

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
