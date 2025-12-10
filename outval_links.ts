import vm from "node:vm";

const LINK_FN_CALL_SIG = /link\("[a-zA-Z0-9]{8}","(?<id>[^"]+)","(?<short>[^"]+)","(?<hash>[a-f0-9]{77})"\);/g;
type MATCHED_LINK = { id: string; short: string; hash: string; };

export async function outvalJavascriptLinks(mangledScript: string) {
   const { promise, resolve } = Promise.withResolvers<string>();

   const sandbox = vm.createContext({
      eval: (injectedScript: string) => {
         resolve(injectedScript);
      }
   });

   vm.runInContext(mangledScript, sandbox);

   const injectedScript = await promise;

   const matches = injectedScript.matchAll(LINK_FN_CALL_SIG);
   const links = Array.from(matches, match => match.groups as MATCHED_LINK);

   return links;
}
