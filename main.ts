import { assert, unreachable } from "@std/assert";

import { DOCSOLUS_URL } from "./config.ts";
import { fetchCorrigePage, fetchQuestionPage } from "./fetch.ts";
import { solvePuzzleChallenge } from "./solve_puzzle.ts";
import { outvalJavascriptLinks } from "./outval_links.ts";

interface ImageResource {
   type: "image",
   src: string,
}

interface PuzzleResource {
   type: "puzzle",
   tiles: string[],
}

interface PdfResource {
   type: "pdf",
   url: string,
}

type QuestionResource = ImageResource | PuzzleResource;

type Question = {
   id: string,
   short: string,
   hash: string,
   resource: QuestionResource;
};

type Corrige = {
   id: string,
   questions?: Question[],
   enonce?: PdfResource,
   rapport?: PdfResource,
};

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

async function downloadCorrige(corrigeId: string): Promise<Corrige> {
   const referrer = DOCSOLUS_URL;

   const doc = await fetchCorrigePage(referrer, corrigeId);

   const scripts = doc.body.getElementsByTagName("SCRIPT");
   const injectedScript = scripts[scripts.length - 1];
   const injectedScriptText = injectedScript?.textContent;
   assert(injectedScriptText, "Expected injected script to have text content");

   const links = await outvalJavascriptLinks(injectedScriptText);

   const corrige = {
      id: corrigeId,
      questions: [] as Question[],
   };

   for (const link of links) {
      const question: Question = {
         id: link.id,
         short: link.short,
         hash: link.hash,
         resource: await downloadQuestion(link.id, link.hash),
      };

      corrige.questions.push(question);
   }

   return corrige;
}


async function downloadPdfs(corrigeId: string): Promise<Corrige> {
   const yearStr = corrigeId.slice(-4);
   const year = parseInt(yearStr, 10);
   assert(!isNaN(year), "Invalid year in corrige ID");
   const enonceUrl = DOCSOLUS_URL + "/prepa/sci/adc/pdf/enonces.pdf/" + year + "/" + corrigeId + ".enonce.pdf";
   const rapportUrl = DOCSOLUS_URL + "/prepa/sci/adc/pdf/rapports.pdf/" + year + "/" + corrigeId + ".rapport.pdf";

   const enonce: PdfResource = {
      type: "pdf",
      url: enonceUrl,
   };

   const rapport: PdfResource = {
      type: "pdf",
      url: rapportUrl,
   };

   const corrige: Corrige = {
      id: corrigeId,
      enonce,
      rapport,
   };

   return corrige;
}
