export type S3ObjectCreatedRef = {
  bucket: string;
  key: string;
};

type S3EventLike = {
  Records?: Array<{
    s3?: {
      bucket?: { name?: string };
      object?: { key?: string };
    };
  }>;
};

/** Parse one SQS body that wraps an S3 ObjectCreated notification. */
export function parseS3EventRecords(body: string): S3ObjectCreatedRef[] {
  let parsed: S3EventLike;
  try {
    parsed = JSON.parse(body) as S3EventLike;
  } catch {
    throw new Error("SQS body is not valid JSON");
  }

  const records = parsed.Records ?? [];
  const out: S3ObjectCreatedRef[] = [];
  for (const record of records) {
    const bucket = record.s3?.bucket?.name?.trim();
    const key = record.s3?.object?.key?.trim();
    if (!bucket || !key) {
      continue;
    }
    out.push({ bucket, key });
  }
  return out;
}
