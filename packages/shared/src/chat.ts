import type { ChatUsageSnapshot } from "./usage";

/** Client request for a grounded answer (tenant from JWT, never from body). */
export type AskRequest = {
  question: string;
};

export type Citation = {
  documentId: string;
  chunkId: string;
  score: number;
  /** Short excerpt from the retrieved chunk for UI display. */
  excerpt: string;
};

export type AskResponse = {
  answer: string;
  abstained: boolean;
  citations: Citation[];
  /** Updated monthly chat usage after this request. */
  usage: ChatUsageSnapshot;
};
