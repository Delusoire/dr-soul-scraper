import { DOMParser } from "@b-fuze/deno-dom";
import { assert } from "@std/assert";
import { getSetCookies } from "@std/http/cookie";

import { DOCSOLUS_ID_COOKIE_NAME, DOCSOLUS_ID_COOKIE_VALUE, DOCSOLUS_URL } from "./config.ts";
import { FutureQueue } from "./request.ts";
import { delayGeneratorMs, generateRandomId, getTimestampSeconds, parseYearFromCorrigeId } from "./util.ts";

import DEFAULT_HEADERS from "./headers.json" with { type: "json" };

export class SimpleSession {
   #cookies = new Map<string, string>();
   #scheduler = new FutureQueue(delayGeneratorMs);

   #getCookieHeader() {
      if (this.#cookies.size === 0) {
         return null;
      }

      const cookieHeader = this.#cookies.entries()
         .map(([name, value]) => `${name}=${value}`)
         .reduce((acc, cookie) => acc + cookie + "; ", "");

      return cookieHeader;
   }

   #scheduleFetch(input: string | URL, init?: RequestInit) {
      return this.#scheduler.add(() => fetch(input, init));
   }

   async fetch(input: string | URL, init?: RequestInit): Promise<Response> {
      const headers = new Headers(init?.headers);

      const cookieHeader = this.#getCookieHeader();
      if (cookieHeader) {
         headers.set("Cookie", cookieHeader);
      }

      const response = await this.#scheduleFetch(input, { ...init, headers });

      const setCookieHeaders = getSetCookies(response.headers);

      for (const cookie of setCookieHeaders) {
         this.setCookie(cookie.name, cookie.value);
      }

      return response;
   }

   setCookie(name: string, value: string) {
      this.#cookies.set(name, value);
   }

   deleteCookie(name: string) {
      this.#cookies.delete(name);
   }
}

export const DOCSOLUS_SESSION = new SimpleSession();
DOCSOLUS_SESSION.setCookie(DOCSOLUS_ID_COOKIE_NAME, `${DOCSOLUS_ID_COOKIE_VALUE}.${getTimestampSeconds()}`);

export async function fetchCorrigePage(corrigeId: string) {
   const referrer = DOCSOLUS_URL;
   const response = await DOCSOLUS_SESSION.fetch(DOCSOLUS_URL + buildCorrigeUrl(corrigeId), {
      headers: DEFAULT_HEADERS,
      referrer,
      method: "GET",
   });

   const responseText = await response.text();

   const parser = new DOMParser();

   const doc = parser.parseFromString(responseText, "text/html");
   return doc;
}

export async function fetchQuestionPage(corrigeId: string, questionId: string, md5Hash: string) {
   const referrer = DOCSOLUS_URL + buildCorrigeUrl(corrigeId);
   const response = await DOCSOLUS_SESSION.fetch(DOCSOLUS_URL + buildQuestionUrl(questionId, md5Hash), {
      headers: DEFAULT_HEADERS,
      referrer,
      method: "GET",
   });

   const responseText = await response.text();

   const parser = new DOMParser();

   const doc = parser.parseFromString(responseText, "text/html");
   return doc;
}

export async function fetchTilesPuzzle(questionId: string, md5Hash: string, id = generateRandomId()) {
   const referrer = DOCSOLUS_URL + buildQuestionUrl(questionId, md5Hash);
   const response20 = await DOCSOLUS_SESSION.fetch(DOCSOLUS_URL + buildTilesPuzzleUrl(questionId, md5Hash, id), {
      headers: DEFAULT_HEADERS,
      referrer,
      method: "GET",
   });

   const responseText20 = await response20.text();

   return responseText20;
}

export async function fetchLehmerPayload(questionId: string, mdf5Hash: string, payloadUrl: string) {
   const referrer = DOCSOLUS_URL + buildQuestionUrl(questionId, mdf5Hash);
   const response30 = await DOCSOLUS_SESSION.fetch(DOCSOLUS_URL + payloadUrl, {
      headers: DEFAULT_HEADERS,
      referrer,
      method: "GET",
   });

   const responseText30 = await response30.text();

   const timestampString = responseText30.slice(0, 10);
   const timestamp = parseInt(timestampString, 10);
   assert(!isNaN(timestamp), "Invalid timestamp in Lehmer payload");

   const payload = responseText30.slice(10);

   return payload;
}

export function buildMiniatureUrl(corrigeId: string, questionId: string) {
   const year = parseYearFromCorrigeId(corrigeId);
   return `/prepa/sci/adc/img/miniatures/${year}/${corrigeId}/${questionId}.w100px.jpg`;
}

export function buildPdfEnonceUrl(corrigeId: string) {
   const year = parseYearFromCorrigeId(corrigeId);
   return `/prepa/sci/adc/pdf/enonces.pdf/${year}/${corrigeId}.enonce.pdf`;
}

export function buildPdfRapportUrl(corrigeId: string) {
   const year = parseYearFromCorrigeId(corrigeId);
   return `/prepa/sci/adc/pdf/rapports.pdf/${year}/${corrigeId}.rapport.pdf`;
}

export function buildCorrigeUrl(corrigeId: string) {
   return `/prepa/sci/adc/bin/view.corrige.html?q=${corrigeId}`;
}

function buildQuestionUrl(questionId: string, md5Hash: string) {
   return `/prepa/sci/adc/bin/view.question.html?q=${questionId}&h=${md5Hash}`;
}

function buildTilesPuzzleUrl(questionId: string, md5Hash: string, id: string) {
   return `/lib/mason/puzzles/20.js.html?auth=1&question=${questionId}&divId=${id}&md5=${md5Hash}`;
}

function buildLehmerPayloadUrl(code: string) {
   const codeRegex = /\w{8}\.\d{3}/;
   assert(codeRegex.test(code), "Invalid Lehmer code");
   return `/lib/mason/puzzles/30.ajax.html?q=${getTimestampSeconds()}${code}`;
}
