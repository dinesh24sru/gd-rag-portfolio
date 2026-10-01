export type CognitoPublicConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
  domain: string;
  appUrl: string;
  redirectUri: string;
  logoutUri: string;
};

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Missing ${name}. Copy apps/web/.env.example to .env.local and fill Cognito outputs.`,
    );
  }
  return value.trim();
}

export function getCognitoConfig(): CognitoPublicConfig {
  const appUrl = required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL).replace(
    /\/$/,
    "",
  );
  const domain = required(
    "NEXT_PUBLIC_COGNITO_DOMAIN",
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
  ).replace(/^https?:\/\//, "");

  return {
    region: required("NEXT_PUBLIC_COGNITO_REGION", process.env.NEXT_PUBLIC_COGNITO_REGION),
    userPoolId: required(
      "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    ),
    clientId: required(
      "NEXT_PUBLIC_COGNITO_CLIENT_ID",
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    ),
    domain,
    appUrl,
    redirectUri: `${appUrl}/auth/callback`,
    logoutUri: `${appUrl}/login`,
  };
}

export function isCognitoConfigured(): boolean {
  try {
    getCognitoConfig();
    return true;
  } catch {
    return false;
  }
}
