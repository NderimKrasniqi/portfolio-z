import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
export function r2() {
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  )
    throw Error("R2 storage is not configured");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}
export function bucket() {
  if (!process.env.R2_BUCKET_NAME) throw Error("R2 bucket is not configured");
  return process.env.R2_BUCKET_NAME;
}
