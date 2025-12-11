export type Require<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export interface ImageResource {
   type: "image";
   src: string;
}

export interface PuzzleResource {
   type: "puzzle";
   tiles: string[];
}

export interface PdfResource {
   type: "pdf";
   url: string;
}

export type QuestionResource = ImageResource | PuzzleResource;

export type Question = {
   id: string;
   short: string;
   hash: string;
   resource: QuestionResource;
   miniature?: ImageResource;
};

export interface CorrigeMetadata {
   theme: string;
   outils: string[];
   motcles: string[];
}

export type Corrige = {
   id: string;
   questions?: Question[];
   enonce?: PdfResource;
   rapport?: PdfResource;
   metadata?: CorrigeMetadata;
};
