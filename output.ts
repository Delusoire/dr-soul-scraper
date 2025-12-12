import { PDFDocument, PDFImage } from "pdf-lib";

import { unreachable } from "@std/assert";
import { decodeBase64 } from "@std/encoding/base64";
import { join } from "@std/path";

import { TILES_PER_ROW } from "./config.ts";
import type { Corrige, Question, QuestionResource } from "./types.ts";
import { downloadFile } from "./util.ts";

function getCorrigeTitle( corrige: Corrige ) {
   return `${ corrige.id }.corrige.pdf`;
}

export async function saveCorrigeToFolder( corrige: Corrige, folderPath: string ) {
   const promises = [];

   const thumbnailsPath = join( folderPath, "thumbnails" );

   if ( corrige.questions ) {
      promises.push( downloadQuestions() );

      promises.push( Promise.all(
         corrige.questions.map( question => downloadMiniature( question, thumbnailsPath ) )
      ) );

   }

   if ( corrige.enonce ) {
      promises.push( downloadFile( corrige.enonce.url, folderPath, `${ corrige.id }.enonce.pdf` ) );
   }

   if ( corrige.rapport ) {
      promises.push( downloadFile( corrige.rapport.url, folderPath, `${ corrige.id }.rapport.pdf` ) );
   }

   await Promise.all( promises );

   async function downloadQuestions() {
      const pdfBytes = await saveCorrigeQuestionsToPDF( corrige );
      const pdfPath = join( folderPath, getCorrigeTitle( corrige ) );

      await Deno.writeFile( pdfPath, pdfBytes );
   }

   async function downloadMiniature( question: Question, thumbnailsPath: string ) {
      const { id, miniature } = question;

      if ( !miniature ) return;

      await downloadFile( miniature.src, thumbnailsPath, `${ id }.jpg` );
   }
}

async function writeImageToPDF( pdfDoc: PDFDocument, src: string ) {
   const res = await fetch( src );
   const bytes = await res.arrayBuffer();
   const img = await pdfDoc.embedJpg( bytes );
   const page = pdfDoc.addPage( [ img.width, img.height ] );

   page.drawImage( img, {
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
   } );
}

async function writePuzzleToPDF( pdfDoc: PDFDocument, tiles: string[] ) {
   const embeddedImages: PDFImage[] = [];

   for ( const b64 of tiles ) {
      const bytes = decodeBase64( b64 );

      const img = await pdfDoc.embedJpg( bytes );
      embeddedImages.push( img );
   }

   // Calculate Layout
   let totalPageHeight = 0;
   let maxPageWidth = 0;

   // We hold row metadata here to save time during drawing
   const rowMeta: { height: number; width: number; startIndex: number; }[] = [];

   for ( let i = 0; i < embeddedImages.length; i += TILES_PER_ROW ) {
      const firstImgInRow = embeddedImages[ i ];

      const rowHeight = firstImgInRow.height;
      const rowWidth = firstImgInRow.width * TILES_PER_ROW;

      rowMeta.push( {
         height: rowHeight,
         width: rowWidth,
         startIndex: i
      } );

      totalPageHeight += rowHeight;
      if ( rowWidth > maxPageWidth ) maxPageWidth = rowWidth;
   }

   const page = pdfDoc.addPage( [ maxPageWidth, totalPageHeight ] );

   // PDF coordinates start at Bottom-Left (0,0).
   // Images render Top-Down. We need a cursor tracking Y from the top.
   let currentYFromTop = 0;

   for ( const row of rowMeta ) {
      const pdfY = totalPageHeight - currentYFromTop - row.height;

      for ( let col = 0; col < TILES_PER_ROW; col++ ) {
         const imgIndex = row.startIndex + col;

         // Stop if we run out of images (e.g., last row is incomplete)
         if ( imgIndex >= embeddedImages.length ) break;

         const img = embeddedImages[ imgIndex ];

         const pdfX = col * img.width;

         page.drawImage( img, {
            x: pdfX,
            y: pdfY,
            width: img.width,
            height: img.height,
         } );
      }

      currentYFromTop += row.height;
   }
}

function writeQuestionToPDF( pdfDoc: PDFDocument, res: QuestionResource ) {
   if ( res.type === "image" ) {
      return writeImageToPDF( pdfDoc, res.src );
   }

   if ( res.type === "puzzle" ) {
      return writePuzzleToPDF( pdfDoc, res.tiles );
   }

   unreachable( "Unknown question resource type" );
}

export async function saveCorrigeQuestionsToPDF( corrige: Corrige ) {
   const pdfDoc = await PDFDocument.create( {
      updateMetadata: false
   } );

   pdfDoc.setTitle( getCorrigeTitle( corrige ) );
   pdfDoc.setAuthor( "https://www.doc-solus.fr" );
   if ( corrige.metadata ) {
      pdfDoc.setSubject( corrige.metadata.theme );
      pdfDoc.setKeywords( corrige.metadata.motcles );
   }
   pdfDoc.setCreator( "LaTeX with hyperref" );
   pdfDoc.setLanguage( "fr-FR" );

   if ( corrige.questions )
      for ( const question of corrige.questions ) {
         await writeQuestionToPDF( pdfDoc, question.resource );
      }

   const pdfBytes = await pdfDoc.save();

   return pdfBytes;
}
