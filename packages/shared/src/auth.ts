/**
 * JWT claims after API Gateway Cognito JWT authorizer validation.
 * Claim values from HTTP API JWT authorizer are strings.
 */
export type AuthClaims = {
  sub?: string;
  email?: string;
  username?: string;
  token_use?: string;
  client_id?: string;
  aud?: string;
  iss?: string;
  [key: string]: string | undefined;
};

export type ApiErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
