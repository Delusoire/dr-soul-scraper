import { assert } from "@std/assert/assert";

import { checkStringBoolean } from "./util.ts";

export const DOCSOLUS_URL = Deno.env.get( "DOCSOLUS_URL" ) ?? "https://www.doc-solus.fr";

export const DOCSOLUS_ID_COOKIE_NAME = "ck_id";

export const DOCSOLUS_ID_COOKIE_VALUE = Deno.env.get( "DOCSOLUS_ID_COOKIE" );
assert( DOCSOLUS_ID_COOKIE_VALUE, "Missing DOCSOLUS_ID_COOKIE_VALUE env var" );

const include_miniatures = Deno.env.get( "INCLUDE_MINIATURES" ) ?? "true";
assert( checkStringBoolean( include_miniatures ), "INCLUDE_MINIATURES env var must be 'true' or 'false'" );
export const INCLUDE_MINIATURES = include_miniatures === "true";

export const PROXY_URL = Deno.env.get( "PROXY_URL" );
export const PROXY_USERNAME = Deno.env.get( "PROXY_USERNAME" );
export const PROXY_PASSWORD = Deno.env.get( "PROXY_PASSWORD" );

export const TILES_PER_ROW = 20;

const eval_strategy = Deno.env.get( "EVAL_STRATEGY" ) ?? "node_vm";
assert( [ "node_vm", "quickjs" ].includes( eval_strategy ), "EVAL_STRATEGY env var must be 'node_vm' or 'quickjs'" );
export const EVAL_STRATEGY = eval_strategy as "node_vm" | "quickjs";

export const EVAL_TIMEOUT_MS = 3000;
