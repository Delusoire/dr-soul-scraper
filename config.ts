import { assert } from "@std/assert/assert";

import { checkStringBoolean } from "./util.ts";

// --- General ---

const include_miniatures_string = Deno.env.get( "INCLUDE_MINIATURES" ) ?? "true";
assert( checkStringBoolean( include_miniatures_string ), "INCLUDE_MINIATURES env var must be 'true' or 'false'" );
export const INCLUDE_MINIATURES = include_miniatures_string === "true";

export const EVAL_STRATEGY = Deno.env.get( "EVAL_STRATEGY" );
assert( [ "node_vm", "quickjs" ].includes( EVAL_STRATEGY! ), "EVAL_STRATEGY env var must be 'node_vm' or 'quickjs'" );

export const EVAL_TIMEOUT_MS = 3000;

// --- DocSolus ---

export const DOCSOLUS_URL = Deno.env.get( "DOCSOLUS_URL" ) ?? "https://www.doc-solus.fr";

export const DOCSOLUS_ID_COOKIE_NAME = "ck_id";
export const DOCSOLUS_ID_COOKIE_VALUE = Deno.env.get( "DOCSOLUS_ID_COOKIE" );
assert( DOCSOLUS_ID_COOKIE_VALUE, "Missing DOCSOLUS_ID_COOKIE_VALUE env var" );

export const TILES_PER_ROW = 20;

// --- Proxy ---

export const PROXY_URL = Deno.env.get( "PROXY_URL" );
export const PROXY_USERNAME = Deno.env.get( "PROXY_USERNAME" );
export const PROXY_PASSWORD = Deno.env.get( "PROXY_PASSWORD" );

// --- Cloudflare ---

const cloudflare_id = Deno.env.get( "CLOUDFLARE_ID" );

export function getCloudflareId() {
   assert( cloudflare_id, "Missing CLOUDFLARE_ID env var" );
   return cloudflare_id;
}

export const CLOUDFLARE_ACCESS_KEY_ID = Deno.env.get( "CLOUDFLARE_ACCESS_KEY_ID" );
export const CLOUDFLARE_SECRET_ACCESS_KEY = Deno.env.get( "CLOUDFLARE_SECRET_ACCESS_KEY" );
