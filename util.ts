import { assert, assertExists } from "@std/assert";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";

export function generateRandomId( length = 8 ): string {
   const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let result = "";
   for ( let i = 0; i < length; i++ ) {
      result += chars.charAt( Math.floor( Math.random() * chars.length ) );
   }
   return result;
}

const BASE_64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function isBase64Array( arr: unknown[] ): arr is string[] {
   return arr.every( v => typeof v === "string" && BASE_64.test( v ) );
};

export function parseYearFromCorrigeId( corrigeId: string ): number {
   const yearStr = corrigeId.slice( -4 );
   const year = parseInt( yearStr, 10 );
   assert( !isNaN( year ), "Invalid year in corrige ID" );
   return year;
}

export function checkStringBoolean( string?: string | null | undefined ) {
   return string === "true" || string === "false";
}

export type Task<T = void> = () => Promise<T>;

export function wrapTask<T>( sink: Task<T> ) {
   const { promise, resolve, reject } = Promise.withResolvers<T>();

   const source = async () => {
      try {
         const result = await sink();
         resolve( result );
      } catch ( error ) {
         reject( error );
      }
   };

   return { task: source, future: promise };
}

export function lerp( a: number, b: number, t: number ) {
   return a * ( 1 - t ) + b * t;
}

export const TAU = Math.PI * 2;

export function slowDelayGeneratorMs() {
   const t = Date.now();

   const t1 = t * TAU / 3000;
   const t2 = t * TAU / 30000;
   const t3 = t * TAU / 300000;

   const a1 = 3000;
   const a2 = 8000;
   const a3 = 13000;

   const e = 30000;

   return a1 * Math.sin( t1 ) + a2 * Math.sin( t2 ) + a3 * Math.sin( t3 ) + e;
}

export function getTimestampSeconds() {
   return Math.floor( Date.now() / 1000 );
}

export function parseFixedWidthIntegers( digitStream: string, chunkSize: number ) {
   const chunkCount = Math.floor( digitStream.length / chunkSize );

   const integerSegments = new Array<number>( chunkCount );

   for ( let i = 0; i < chunkCount; i++ ) {
      const start = chunkSize * i;
      const segmentString = digitStream.slice( start, start + chunkSize );
      integerSegments[ i ] = parseInt( segmentString, 10 );;
   }

   return integerSegments;
}

export async function downloadFile( url: string, directory: string, filename: string ) {
   const response = await fetch( url );

   assert( response.ok, `Failed to download file: ${ response.status } ${ response.statusText }` );
   assertExists( response.body, "Failed to download file: no body" );

   await ensureDir( directory );
   const path = join( directory, filename );
   const file = await Deno.create( path );

   await response.body.pipeTo( file.writable );
}

export function wrapSignal( signal: AbortSignal, reason?: unknown ): AbortSignal {
   const controller = new AbortController();

   if ( signal.aborted ) {
      controller.abort( reason );
      return controller.signal;
   }

   signal.addEventListener( "abort", () => {
      controller.abort( reason );
   }, { once: true } );

   return controller.signal;
}
