import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Config } from "./config.js";

export class Storage {
  private client: S3Client;
  private bucket: string;

  constructor(r2: Config["r2"]) {
    this.bucket = r2.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async download(key: string, path: string, signal?: AbortSignal) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: signal });
    if (!res.Body) throw new Error(`Empty object ${key}`);
    await pipeline(res.Body as Readable, createWriteStream(path), { signal });
  }

  async uploadFile(key: string, path: string, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: await readFile(path),
        ContentType: contentType,
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
  }

  async delete(keys: (string | null | undefined)[]) {
    const objects = [...new Set(keys.filter((k): k is string => Boolean(k)))].map((Key) => ({ Key }));
    if (!objects.length) return;
    await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: true } }));
  }
}
