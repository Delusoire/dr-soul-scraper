import { assert } from "@std/assert";

export const DOCSOLUS_URL = "https://www.doc-solus.fr";

export const DOCSOLUS_ID_COOKIE_NAME = "ck_id";

export const DOCSOLUS_ID_COOKIE_VALUE = Deno.env.get("DOCSOLUS_ID_COOKIE_VALUE")!;
assert(DOCSOLUS_ID_COOKIE_VALUE, "Missing DOCSOLUS_ID_COOKIE_VALUE env var");

export const INCLUDE_MINIATURES = false;
