import type { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { parseS3EventRecords } from "@gd-rag/core";
import { PermanentIngestionError, logError, logInfo } from "@gd-rag/shared";
import { getWorkerWiring } from "./wiring";

async function processRecord(record: SQSRecord): Promise<void> {
  const receiveCount = record.attributes?.ApproximateReceiveCount;
  logInfo("ingest.sqs_record_start", {
    messageId: record.messageId,
    receiveCount,
  });

  const refs = parseS3EventRecords(record.body);
  if (refs.length === 0) {
    throw new PermanentIngestionError("SQS message contained no S3 records");
  }

  const wiring = getWorkerWiring();
  for (const ref of refs) {
    logInfo("ingest.sqs_object", {
      messageId: record.messageId,
      bucket: ref.bucket,
      key: ref.key,
    });
    const result = await wiring.ingest(ref);
    logInfo("ingest.sqs_object_done", {
      messageId: record.messageId,
      bucket: ref.bucket,
      key: ref.key,
      outcome: result.outcome,
      ...(result.outcome === "ready" ? { chunkCount: result.chunkCount } : {}),
      ...(result.outcome === "skipped" ? { reason: result.reason } : {}),
    });
  }

  logInfo("ingest.sqs_record_done", {
    messageId: record.messageId,
    objectCount: refs.length,
  });
}

/**
 * SQS → ingest one S3 object per record.
 * Permanent failures are acked (after FAILED status); transient failures use partial batch failure.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  logInfo("ingest.batch_start", { recordCount: event.Records.length });
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      if (err instanceof PermanentIngestionError) {
        logError("ingest.permanent_failure", {
          messageId: record.messageId,
          error: err.message,
        });
        continue;
      }
      logError("ingest.transient_failure", {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  logInfo("ingest.batch_done", {
    recordCount: event.Records.length,
    failureCount: batchItemFailures.length,
  });
  return { batchItemFailures };
}
