"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { completeSignInFromCallback } from "@/lib/auth/cognito";
import { useAuth } from "@/providers/AuthProvider";

function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (oauthError) {
      setError(errorDescription || oauthError);
      return;
    }

    if (!code || !state) {
      setError("Missing authorization code. Try signing in again.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await completeSignInFromCallback({ code, state });
        if (cancelled) {
          return;
        }
        refreshSession();
        router.replace(result.nextPath || "/home");
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, refreshSession]);

  if (error) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 480 }}>
          <Alert severity="error">{error}</Alert>
          <Typography
            component="a"
            href="/login"
            color="primary"
            sx={{ textDecoration: "underline", cursor: "pointer" }}
          >
            Back to login
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress color="primary" />
        <Typography color="text.secondary">Completing Google sign-in…</Typography>
      </Stack>
    </Box>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <CircularProgress color="primary" />
        </Box>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
