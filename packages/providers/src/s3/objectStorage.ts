import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  };
}
