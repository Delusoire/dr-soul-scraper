import { DOMParser } from "@b-fuze/deno-dom";
import { assert } from "@std/assert";
import { getSetCookies } from "@std/http/cookie";

import { DOCSOLUS_ID_COOKIE_NAME, DOCSOLUS_ID_COOKIE_VALUE, DOCSOLUS_URL } from "./config.ts";
import { generateRandomId } from "./util.ts";

const DEFAULT_HEADERS = {
   "accept": "*/*",
   "accept-language": "en-US,en;q=0.9,fr-FR;q=0.8,fr;q=0.7",
   "sec-ch-ua": "\"Microsoft Edge\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
   "sec-ch-ua-mobile": "?0",
   "sec-ch-ua-platform": "\"Windows\"",
   "sec-fetch-dest": "script",
   "sec-fetch-mode": "no-cors",
   "sec-fetch-site": "same-origin"
};

export class SimpleSession {
   #cookies = new Map<string, string>();

   private getCookieHeader() {
      if (this.#cookies.size === 0) {
         return null;
      }

      const cookieHeader = this.#cookies.entries()
         .map(([name, value]) => `${name}=${value}`)
         .reduce((acc, cookie) => acc + cookie + "; ", "");

      return cookieHeader;
   }

   async fetch(input: string | URL, init?: RequestInit): Promise<Response> {
      const headers = new Headers(init?.headers);

      const cookieHeader = this.getCookieHeader();
      if (cookieHeader) {
         headers.set("Cookie", cookieHeader);
      }

      const response = await fetch(input, { ...init, headers });

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
DOCSOLUS_SESSION.setCookie(DOCSOLUS_ID_COOKIE_NAME, DOCSOLUS_ID_COOKIE_VALUE);

export async function fetchCorrigePage(referrer: string, corrigeId: string) {
   const response = await DOCSOLUS_SESSION.fetch(`${DOCSOLUS_URL}/prepa/sci/adc/bin/view.corrige.html?q=${corrigeId}`, {
      headers: DEFAULT_HEADERS,
      referrer,
      method: "GET",
   });

   const responseText = await response.text();

   const parser = new DOMParser();

   const doc = parser.parseFromString(responseText, "text/html");
   return doc;
}

export async function fetchQuestionPage(referrer: string, questionId: string, md5Hash: string) {
   const response = await DOCSOLUS_SESSION.fetch(`${DOCSOLUS_URL}/prepa/sci/adc/bin/view.question.html?q=${questionId}&h=${md5Hash}`, {
      headers: DEFAULT_HEADERS,
      referrer,
      method: "GET",
   });

   const responseText = await response.text();

   const parser = new DOMParser();

   const doc = parser.parseFromString(responseText, "text/html");
   return doc;
}

export async function fetchTilesPuzzle(referrer: string, q: string, h: string, id = generateRandomId()) {
   const response20 = await DOCSOLUS_SESSION.fetch(`${DOCSOLUS_URL}/lib/mason/puzzles/20.js.html?auth=1&question=${q}&divId=${id}&md5=${h}`, {
      headers: DEFAULT_HEADERS,
      referrer,
      method: "GET",
   });

   const responseText20 = await response20.text();

   return responseText20;
}

export async function fetchLehmerPayload(referrer: string, payloadUrl: string) {
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
