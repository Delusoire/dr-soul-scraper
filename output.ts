import { unreachable } from "@std/assert/unreachable";
import { decodeBase64 } from "@std/encoding/base64";
import { join } from "@std/path/join";
import { join as posixJoin } from "@std/path/posix/join";
import { TarStream, type TarStreamFile, type TarStreamInput } from "@std/tar/tar-stream";
import { PDFDocument, PDFImage } from "pdf-lib";

import { TILES_PER_ROW } from "./config.ts";
import type { Corrige, PdfResource, Question, QuestionResource } from "./types.ts";
import { downloadStream, meterStream, saveToFile } from "./util.ts";

function getCorrigeTitle( corrige: Corrige ) {
   return `${ corrige.id }.corrige.pdf`;
}

export async function saveCorrigeToDir( corrige: Corrige, directory: string ) {
   const promises = [];

   const thumbnailsDir = join( directory, "thumbnails" );

   if ( corrige.questions ) {
      promises.push( downloadQuestions( corrige, directory ) );
      promises.push( downloadMiniatures( corrige.questions, thumbnailsDir ) );
   }

   if ( corrige.enonce ) {
      promises.push( doawnloadEnonce( corrige, directory ) );
   }

   if ( corrige.rapport ) {
      promises.push( downloadRapport( corrige, directory ) );
   }

   await Promise.all( promises );


   async function downloadQuestions( corrige: Corrige, directory: string ) {
      const pdfBytes = await saveCorrigeQuestionsToPDF( corrige );
      const pdfPath = join( directory, getCorrigeTitle( corrige ) );

      await Deno.writeFile( pdfPath, pdfBytes );
   }

   async function downloadMiniatures( questions: Array<Question>, thumbnailsDir: string ) {
      const files = questions.map( question => downloadMiniature( question, thumbnailsDir ) );
      await Promise.all( files );
   }

   async function downloadMiniature( question: Question, thumbnailsDir: string ) {
      const { id, miniature } = question;

      if ( !miniature ) return;

      const miniatureReadable = await downloadStream( miniature.src );
      await saveToFile( miniatureReadable, thumbnailsDir, `${ id }.jpg` );
   }

   async function doawnloadEnonce( corrige: Corrige, directory: string ) {
      const enonceReadable = await downloadStream( corrige.enonce!.url );
      await saveToFile( enonceReadable, directory, `${ corrige.id }.enonce.pdf` );
   }

   async function downloadRapport( corrige: Corrige, directory: string ) {
      const rapportReadable = await downloadStream( corrige.rapport!.url );
      await saveToFile( rapportReadable, directory, `${ corrige.id }.rapport.pdf` );
   }
}

export async function saveCorrigeToTarGz( corrige: Corrige ) {
   const tarFiles = await saveCorrigeToStreams( corrige );

   const tarGzStream = await ReadableStream.from<TarStreamInput>( tarFiles )
      .pipeThrough( new TarStream() )
      .pipeThrough( new CompressionStream( "gzip" ) );

   return tarGzStream;


   async function saveCorrigeToStreams( corrige: Corrige ) {
      const files = new Array<TarStreamFile>().concat( ...await Promise.all( [
         downloadQuestions( corrige ),
         downloadMiniatures( corrige.questions ),
         doawnloadEnonce( corrige.enonce ),
         downloadRapport( corrige.rapport ),
      ] ) );

      return files;


      async function downloadQuestions( corrige: Corrige ) {
         const pdf = await saveCorrigeQuestionsToPDF( corrige );
         const stream = ReadableStream.from( [ pdf ] );

         return [
            {
               type: "file",
               path: getCorrigeTitle( corrige ),
               size: pdf.byteLength,
               readable: stream,
            } as TarStreamFile
         ];
      }

      async function downloadMiniatures( questions?: Array<Question> ) {
         if ( !questions ) return [];

         const files = questions.map( question => downloadMiniature( question ) );
         const results = await Promise.all( files );
         return results.flat();
      }

      async function downloadMiniature( question: Question ) {
         const { id, miniature } = question;

         if ( !miniature ) return [];

         const miniatureReadable = await downloadStream( miniature.src );
         const { size, readable } = meterStream( miniatureReadable );

         return [ {
            type: "file",
            path: posixJoin( "thumbnails", `${ id }.jpg` ),
            size,
            readable,
         } as TarStreamFile ];

      }

      async function doawnloadEnonce( enonce?: PdfResource ) {
         if ( !enonce ) return [];

         const enonceReadable = await downloadStream( enonce.url );
         const { size, readable } = meterStream( enonceReadable );

         return [ {
            type: "file",
            path: `${ corrige.id }.enonce.pdf`,
            size,
            readable,
         } as TarStreamFile ];
      }

      async function downloadRapport( rapport?: PdfResource ) {
         if ( !rapport ) return [];

         const rapportReadable = await downloadStream( rapport.url );
         const { size, readable } = meterStream( rapportReadable );

         return [ {
            type: "file",
            path: `${ corrige.id }.rapport.pdf`,
            size,
            readable,
         } as TarStreamFile ];
      }
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
