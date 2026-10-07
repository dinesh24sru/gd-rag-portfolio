/** Grounded generation request — prompts are assembled in application code. */
export type LLMRequest = {
  systemPrompt: string;
  userPrompt: string;
  /** Hard cap; providers must enforce a default if omitted. */
  maxOutputTokens?: number;
};

export type LLMTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LLMResponse = {
  text: string;
  /** Provider-reported or estimated token usage for quota accounting. */
  usage?: LLMTokenUsage;
};

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}
