import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SQSEvent } from "aws-lambda";
import { PermanentIngestionError } from "@gd-rag/shared";
import { handler } from "./handler";
import { setWorkerWiringForTests } from "./wiring";

function s3Body(key: string): string {
  return JSON.stringify({
    Records: [
      {
        s3: {
          bucket: { name: "docs" },
          object: { key },
        },
      },
    ],
  });
}

describe("ingestion worker handler", () => {
  it("acks permanent failures without batchItemFailures", async () => {
    setWorkerWiringForTests({
      ingest: async () => {
        throw new PermanentIngestionError("bad doc");
      },
    });

    const event: SQSEvent = {
      Records: [
        {
          messageId: "m1",
          receiptHandle: "r",
          body: s3Body("tenant/t/documents/d/1/original"),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "0",
            SenderId: "s",
            ApproximateFirstReceiveTimestamp: "0",
          },
          messageAttributes: {},
          md5OfBody: "",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:1:q",
          awsRegion: "us-east-1",
        },
      ],
    };

    const result = await handler(event);
    assert.deepEqual(result.batchItemFailures, []);
    setWorkerWiringForTests(undefined);
  });

  it("reports transient failures for retry", async () => {
    setWorkerWiringForTests({
      ingest: async () => {
        throw new Error("throttled");
      },
    });

    const event: SQSEvent = {
      Records: [
        {
          messageId: "m2",
          receiptHandle: "r",
          body: s3Body("tenant/t/documents/d/1/original"),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "0",
            SenderId: "s",
            ApproximateFirstReceiveTimestamp: "0",
          },
          messageAttributes: {},
          md5OfBody: "",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:1:q",
          awsRegion: "us-east-1",
        },
      ],
    };

    const result = await handler(event);
    assert.deepEqual(result.batchItemFailures, [{ itemIdentifier: "m2" }]);
    setWorkerWiringForTests(undefined);
  });
});
