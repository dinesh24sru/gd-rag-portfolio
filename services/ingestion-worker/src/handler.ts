import type { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { parseS3EventRecords } from "@gd-rag/core";
import { PermanentIngestionError } from "@gd-rag/shared";
import { getWorkerWiring } from "./wiring";

async function processRecord(record: SQSRecord): Promise<void> {
  const refs = parseS3EventRecords(record.body);
  if (refs.length === 0) {
    throw new PermanentIngestionError("SQS message contained no S3 records");
  }

  const wiring = getWorkerWiring();
  for (const ref of refs) {
    await wiring.ingest(ref);
  }
}

/**
 * SQS → ingest one S3 object per record.
 * Permanent failures are acked (after FAILED status); transient failures use partial batch failure.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      if (err instanceof PermanentIngestionError) {
        console.error("Permanent ingestion failure", {
          messageId: record.messageId,
          error: err.message,
        });
        continue;
      }
      console.error("Transient ingestion failure", {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
