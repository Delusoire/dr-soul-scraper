import { assert, unreachable } from "@std/assert";

import { DOCSOLUS_URL, INCLUDE_MINIATURES } from "./config.ts";
import { fetchCorrigePage, fetchQuestionPage } from "./fetch.ts";
import { outvalJavascriptLinks } from "./outval_links.ts";
import { solvePuzzleChallenge } from "./solve_puzzle.ts";
import type { Corrige, ImageResource, PdfResource, PuzzleResource, Question, Require } from "./types.ts";
import { parseYearFromCorrigeId } from "./util.ts";

export function downloadMiniature(corrigeId: string, questionId: string) {
   const year = parseYearFromCorrigeId(corrigeId);
   const url = `${DOCSOLUS_URL}/prepa/sci/adc/img/miniatures/${year}/${corrigeId}/${questionId}.w100px.jpg`;

   const miniature: ImageResource = {
      type: "image",
      src: url,
   };

   return miniature;
}

async function downloadQuestion(questionId: string, md5Hash: string) {
   const referrer = `${DOCSOLUS_URL}/prepa/sci/adc/bin/view.question.html?q=${questionId}&h=${md5Hash}`;

   const doc = await fetchQuestionPage(referrer, questionId, md5Hash);

   const images = doc.body.getElementsByClassName("img-corrige-q1");
   if (images.length > 0) {
      assert(images.length === 1, "Expected exactly one image for question");
      const image = images[0];
      assert(image.tagName === "IMG", "Expected image element to be IMG tag");
      const src = image.getAttribute("src");
      assert(src, "Expected image to have a src attribute");
      return {
         type: "image",
         src: DOCSOLUS_URL + src,
      } as ImageResource;
   }

   const puzzles = doc.body.getElementsByClassName("puzzle");
   if (puzzles.length > 0) {
      assert(puzzles.length === 1, "Expected exactly one puzzle for question");
      const puzzle = puzzles[0];
      assert(puzzle.tagName === "DIV", "Expected puzzle element to be DIV tag");
      const tiles = await solvePuzzleChallenge(referrer, questionId, md5Hash);
      return {
         type: "puzzle",
         tiles,
      } as PuzzleResource;
   }

   unreachable("Question resource not found");
}

export async function downloadCorrige(corrigeId: string) {
   const referrer = DOCSOLUS_URL;

   const doc = await fetchCorrigePage(referrer, corrigeId);

   const scripts = doc.body.getElementsByTagName("SCRIPT");
   const injectedScript = scripts[scripts.length - 1];
   const injectedScriptText = injectedScript?.textContent;
   assert(injectedScriptText, "Expected injected script to have text content");

   const links = await outvalJavascriptLinks(injectedScriptText);

   const corrige: Require<Corrige, "questions"> = {
      id: corrigeId,
      questions: [],
   };

   for (const link of links) {
      const question: Question = {
         id: link.id,
         short: link.short,
         hash: link.hash,
         resource: await downloadQuestion(link.id, link.hash),
         miniature: INCLUDE_MINIATURES ? downloadMiniature(corrigeId, link.id) : undefined,
      };

      corrige.questions.push(question);
   }

   return corrige;
}

export function downloadPdfs(corrigeId: string) {
   const year = parseYearFromCorrigeId(corrigeId);
   const enonceUrl = `${DOCSOLUS_URL}/prepa/sci/adc/pdf/enonces.pdf/${year}/${corrigeId}.enonce.pdf`;
   const rapportUrl = `${DOCSOLUS_URL}/prepa/sci/adc/pdf/rapports.pdf/${year}/${corrigeId}.rapport.pdf`;

   const enonce: PdfResource = {
      type: "pdf",
      url: enonceUrl,
   };

   const rapport: PdfResource = {
      type: "pdf",
      url: rapportUrl,
   };

   const corrige: Require<Corrige, "enonce" | "rapport"> = {
      id: corrigeId,
      enonce,
      rapport,
   };

   return corrige;
}
