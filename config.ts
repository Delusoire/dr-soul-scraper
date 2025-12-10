import { assert } from "@std/assert";

import { checkStringBoolean } from "./util.ts";

export const DOCSOLUS_URL = Deno.env.get("DOCSOLUS_URL") ?? "https://www.doc-solus.fr";

export const DOCSOLUS_ID_COOKIE_NAME = "ck_id";

const _DOCSOLUS_ID_COOKIE_VALUE = Deno.env.get("DOCSOLUS_ID_COOKIE");
assert(_DOCSOLUS_ID_COOKIE_VALUE, "Missing DOCSOLUS_ID_COOKIE_VALUE env var");
export const DOCSOLUS_ID_COOKIE_VALUE = _DOCSOLUS_ID_COOKIE_VALUE;

const _INCLUDE_MINIATURES = Deno.env.get("DOCSOLUS_ID_COOKIE");
assert(checkStringBoolean(_INCLUDE_MINIATURES), "INCLUDE_MINIATURES env var must be 'true' or 'false'");
export const INCLUDE_MINIATURES = _INCLUDE_MINIATURES === "true";
