import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorage } from "@gd-rag/core";

export type S3ObjectStorageOptions = {
  bucketName: string;
  client?: S3Client;
};

/** Reuse across Lambda invocations. */
let sharedS3: S3Client | undefined;

function getS3(): S3Client {
  if (!sharedS3) {
    sharedS3 = new S3Client({});
  }
  return sharedS3;
}

async function streamToUint8Array(
  body: AsyncIterable<Uint8Array> | ReadableStream | Blob | undefined,
): Promise<Uint8Array> {
  if (!body) {
    return new Uint8Array();
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  // AWS SDK v3 Node runtime: body is a SdkStreamMixin readable
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export function createS3ObjectStorage(options: S3ObjectStorageOptions): ObjectStorage {
  const client = options.client ?? getS3();
  const bucketName = options.bucketName;

  return {
    async presignPut(params) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: params.key,
        ContentType: params.contentType,
        ContentLength: params.contentLength,
      });
      return getSignedUrl(client, command, { expiresIn: params.expiresInSeconds });
    },

    async getObject(key) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
      const body = await streamToUint8Array(result.Body as AsyncIterable<Uint8Array>);
      return {
        body,
        contentType: result.ContentType,
      };
    },

    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
    },
  };
}
