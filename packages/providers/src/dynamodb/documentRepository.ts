import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DocumentRepository } from "@gd-rag/core";
import type { DocumentRecord } from "@gd-rag/shared";

export type DynamoDocumentRepositoryOptions = {
  tableName: string;
  client?: DynamoDBDocumentClient;
};

/** Reuse across Lambda invocations. */
let sharedClient: DynamoDBDocumentClient | undefined;

function getClient(): DynamoDBDocumentClient {
  if (!sharedClient) {
    sharedClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return sharedClient;
}

export function createDynamoDocumentRepository(
  options: DynamoDocumentRepositoryOptions,
): DocumentRepository {
  const client = options.client ?? getClient();
  const tableName = options.tableName;

  return {
    async put(document: DocumentRecord): Promise<void> {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: document,
        }),
      );
    },

    async get(tenantId: string, documentId: string): Promise<DocumentRecord | null> {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { tenantId, documentId },
        }),
      );
      return (result.Item as DocumentRecord | undefined) ?? null;
    },

    async listByTenant(tenantId: string, limit: number): Promise<DocumentRecord[]> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "tenantId = :tenantId",
          ExpressionAttributeValues: { ":tenantId": tenantId },
          Limit: limit,
          ScanIndexForward: false,
        }),
      );
      return (result.Items as DocumentRecord[] | undefined) ?? [];
    },

    async delete(tenantId: string, documentId: string): Promise<void> {
      await client.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { tenantId, documentId },
        }),
      );
    },
  };
}
