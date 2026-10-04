import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Uses S3 when CV_BUCKET is set, otherwise the local ./storage folder.
const BUCKET = process.env.CV_BUCKET;
const LOCAL_ROOT = path.join(process.cwd(), "storage");

async function s3() {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  return {
    client: new S3Client({ region: process.env.AWS_REGION }),
    PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  };
}

function localPath(key: string) {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (BUCKET) {
    const { client, PutObjectCommand } = await s3();
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: body,
        ContentType: contentType, ServerSideEncryption: "AES256",
      }),
    );
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function deleteObject(key: string) {
  if (BUCKET) {
    const { client, DeleteObjectCommand } = await s3();
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return;
  }
  await rm(localPath(key), { force: true });
}

export async function getObject(key: string): Promise<Buffer> {
  if (BUCKET) {
    const { client, GetObjectCommand } = await s3();
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) throw new Error("Empty object");
    return Buffer.from(await res.Body.transformToByteArray());
  }
  return readFile(localPath(key));
}
