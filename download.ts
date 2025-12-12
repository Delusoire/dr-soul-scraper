import { getLogger } from "@logtape/logtape";
import { assert, unreachable } from "@std/assert";
import { escape } from "@std/regexp/escape";

import { DOCSOLUS_URL, INCLUDE_MINIATURES } from "./config.ts";
import { buildCorrigeUrl, buildMiniatureUrl, buildPdfEnonceUrl, buildPdfRapportUrl, fetchAcceuil, fetchCorrigePage, fetchQuestionPage } from "./fetch.ts";
import { outvalJavascriptLinks } from "./outval_links.ts";
import { solvePuzzleChallenge } from "./solve_puzzle.ts";
import type { Corrige, ImageResource, PdfResource, PuzzleResource, Question, Require } from "./types.ts";

const l = getLogger( [ "dss", "main" ] );

export async function listCorriges() {
   l.info`Listing corriges...`;

   const html = await fetchAcceuil();

   const corrigeIdRegex = new RegExp( `href="${ escape( buildCorrigeUrl( "" ) ) }(?<id>[^"]+)"`, "g" );
   const matches = html.matchAll( corrigeIdRegex );
   const corrigeIds = Array.from( matches, match => match.groups!.id );

   return corrigeIds;
}

export function downloadMiniature( corrigeId: string, questionId: string ) {
   l.info`Downloading miniature for question ${ questionId }...`;

   const url = buildMiniatureUrl( corrigeId, questionId );

   const miniature: ImageResource = {
      type: "image",
      src: DOCSOLUS_URL + url,
   };

   return miniature;
}

export function downloadPdfs( corrigeId: string ) {
   l.info`Downloading PDFs for corrige ${ corrigeId }...`;

   const enonce: PdfResource = {
      type: "pdf",
      url: DOCSOLUS_URL + buildPdfEnonceUrl( corrigeId ),
   };

   const rapport: PdfResource = {
      type: "pdf",
      url: DOCSOLUS_URL + buildPdfRapportUrl( corrigeId ),
   };

   const corrige: Require<Corrige, "enonce" | "rapport"> = {
      id: corrigeId,
      enonce,
      rapport,
   };

   return corrige;
}

export async function downloadQuestion( corrigeId: string, questionId: string, md5Hash: string ) {
   l.info`Downloading question ${ questionId }...`;

   const doc = await fetchQuestionPage( corrigeId, questionId, md5Hash );

   const images = doc.body.getElementsByClassName( "img-corrige-q1" );
   if ( images.length > 0 ) {
      assert( images.length === 1, "Expected exactly one image for question" );
      const image = images[ 0 ];
      assert( image.tagName === "IMG", "Expected image element to be IMG tag" );
      const src = image.getAttribute( "src" );
      assert( src, "Expected image to have a src attribute" );
      return {
         type: "image",
         src: DOCSOLUS_URL + src,
      } as ImageResource;
   }

   const puzzles = doc.body.getElementsByClassName( "puzzle" );
   if ( puzzles.length > 0 ) {
      assert( puzzles.length === 1, "Expected exactly one puzzle for question" );
      const puzzle = puzzles[ 0 ];
      assert( puzzle.tagName === "DIV", "Expected puzzle element to be DIV tag" );
      const tiles = await solvePuzzleChallenge( questionId, md5Hash );
      return {
         type: "puzzle",
         tiles,
      } as PuzzleResource;
   }

   unreachable( "Question resource not found" );
}

export async function downloadCorrige( corrigeId: string ) {
   l.info`Downloading corrige ${ corrigeId }...`;

   const doc = await fetchCorrigePage( corrigeId );

   const scripts = doc.body.getElementsByTagName( "SCRIPT" );
   const injectedScript = scripts[ scripts.length - 1 ];
   const injectedScriptText = injectedScript?.textContent;
   assert( injectedScriptText, "Expected injected script to have text content" );

   const metadatas = Array.from( doc.body.querySelectorAll( "table>tbody>tr>td.tabright" ) );
   if ( metadatas.length !== 3 ) {
      unreachable( "Corrige metadata table not found" );
   }

   const theme = metadatas[ 0 ].innerHTML;
   const outils = metadatas[ 1 ].innerText.split( ", " );
   const motcles = metadatas[ 2 ].innerText.split( ", " );

   const links = await outvalJavascriptLinks( injectedScriptText );

   const corrige: Require<Corrige, "questions" | "metadata"> = {
      id: corrigeId,
      questions: [],
      metadata: {
         theme,
         outils,
         motcles,
      },
   };

   for ( const link of links ) {
      const question: Question = {
         id: link.id,
         short: link.short,
         hash: link.hash,
         resource: await downloadQuestion( corrigeId, link.id, link.hash ),
         miniature: INCLUDE_MINIATURES ? downloadMiniature( corrigeId, link.id ) : undefined,
      };

      corrige.questions.push( question );
   }

   return corrige;
}
