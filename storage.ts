import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, getCloudflareId } from "./config.ts";

export function createR2Client() {
   const options: S3ClientConfig = {
      region: "auto",
      endpoint: `https://${ getCloudflareId() }.r2.cloudflarestorage.com`,
   };

   if ( CLOUDFLARE_ACCESS_KEY_ID && CLOUDFLARE_SECRET_ACCESS_KEY ) {
      options.credentials = {
         accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
         secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
      };
   }

   return new S3Client( options );
}
