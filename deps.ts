

import { assertExists } from "@std/assert/exists";

import { EVAL_STRATEGY } from "./config.ts";

let NODE_VM: typeof import( "node:vm" ) | null = null;

if ( EVAL_STRATEGY === "node_vm" ) {
   NODE_VM = await import( "node:vm" );
}

let QUICKJS: typeof import( "quickjs-emscripten" ) | null = null;

if ( EVAL_STRATEGY === "quickjs" ) {
   QUICKJS = await import( "quickjs-emscripten" );
}

export function importNodeVm() {
   assertExists( NODE_VM, "Node VM is not enabled" );
   return NODE_VM;
}

export function importQuickJS() {
   assertExists( QUICKJS, "QuickJS is not enabled" );
   return QUICKJS;
}
