import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".data", "documents");
const endpoint = process.env.AWS_ENDPOINT_URL_S3;
const bucket = process.env.AWS_S3_BUCKET ?? process.env.S3_BUCKET ?? process.env.R2_BUCKET;
const configured = Boolean(endpoint && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && bucket);

const client = configured
  ? new S3Client({
      endpoint,
      region: process.env.AWS_REGION ?? "auto",
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
    })
  : null;

export async function saveDocumentFile(id: string, bytes: Uint8Array, contentType?: string) {
  if (client && bucket) {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: id, Body: bytes, ContentType: contentType }));
    return;
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, id), bytes);
}

export async function readDocumentFile(id: string) {
  if (client && bucket) {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: id }));
    if (!response.Body) throw new Error("Stored document has no content.");
    return new Uint8Array(await response.Body.transformToByteArray());
  }
  return readFile(path.join(dataDir, id));
}
