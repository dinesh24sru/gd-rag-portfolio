import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { chatUsageDocumentId } from "@gd-rag/core";
import type { UsageRepository } from "@gd-rag/core";
import { QuotaExceededError, type ChatUsageSnapshot } from "@gd-rag/shared";

export type DynamoUsageRepositoryOptions = {
  tableName: string;
  client?: DynamoDBDocumentClient;
};

let sharedClient: DynamoDBDocumentClient | undefined;

function getClient(): DynamoDBDocumentClient {
  if (!sharedClient) {
    sharedClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return sharedClient;
}

function toSnapshot(
  period: string,
  usedTokens: number,
  quotaTokens: number,
): ChatUsageSnapshot {
  const used = Math.max(0, usedTokens);
  const quota = Math.max(1, quotaTokens);
  return {
    period,
    usedTokens: used,
    quotaTokens: quota,
    remainingTokens: Math.max(0, quota - used),
  };
}

export function createDynamoUsageRepository(
  options: DynamoUsageRepositoryOptions,
): UsageRepository {
  const client = options.client ?? getClient();
  const tableName = options.tableName;

  return {
    async getChatUsage(tenantId, period) {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { tenantId, documentId: chatUsageDocumentId(period) },
        }),
      );
      const item = result.Item as
        | { usedTokens?: number; quotaTokens?: number; period?: string }
        | undefined;
      if (!item) {
        return null;
      }
      return toSnapshot(
        item.period ?? period,
        Number(item.usedTokens ?? 0),
        Number(item.quotaTokens ?? 0) || 1,
      );
    },

    async tryConsumeChatTokens(params) {
      const documentId = chatUsageDocumentId(params.period);
      const maxBefore = params.quotaTokens - params.deltaTokens;
      try {
        const result = await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { tenantId: params.tenantId, documentId },
            UpdateExpression:
              "ADD usedTokens :delta SET quotaTokens = if_not_exists(quotaTokens, :quota), #period = if_not_exists(#period, :period), updatedAt = :updatedAt, entityType = :entityType",
            ConditionExpression:
              "attribute_not_exists(usedTokens) OR usedTokens <= :maxBefore",
            ExpressionAttributeNames: { "#period": "period" },
            ExpressionAttributeValues: {
              ":delta": params.deltaTokens,
              ":quota": params.quotaTokens,
              ":period": params.period,
              ":updatedAt": params.updatedAt,
              ":entityType": "chat_usage",
              ":maxBefore": maxBefore,
            },
            ReturnValues: "ALL_NEW",
          }),
        );
        const item = result.Attributes as {
          usedTokens?: number;
          quotaTokens?: number;
          period?: string;
        };
        return toSnapshot(
          item.period ?? params.period,
          Number(item.usedTokens ?? 0),
          Number(item.quotaTokens ?? params.quotaTokens),
        );
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        if (name === "ConditionalCheckFailedException") {
          const current = await this.getChatUsage(params.tenantId, params.period);
          const usage = toSnapshot(
            params.period,
            current?.usedTokens ?? params.quotaTokens,
            current?.quotaTokens ?? params.quotaTokens,
          );
          throw new QuotaExceededError(
            `Monthly chat token quota exceeded (${usage.usedTokens}/${usage.quotaTokens} used for ${usage.period}).`,
            usage,
          );
        }
        throw err;
      }
    },
  };
}
