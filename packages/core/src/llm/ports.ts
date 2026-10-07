/** Grounded generation request — prompts are assembled in application code. */
export type LLMRequest = {
  systemPrompt: string;
  userPrompt: string;
  /** Hard cap; providers must enforce a default if omitted. */
  maxOutputTokens?: number;
};

export type LLMResponse = {
  text: string;
};

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}
