"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GoogleIcon from "@mui/icons-material/Google";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useAuth } from "@/providers/AuthProvider";
import { palette } from "@/theme/theme";

export default function LoginClient() {
  const { isAuthenticated, isLoading, isConfigured, loginWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams.get("next") || "/home";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, isLoading, nextPath, router]);

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle(nextPath);
      // Redirects to Cognito Hosted UI; no further code runs on success.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed. Try again.");
      setSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 6,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 460,
          p: { xs: 3, sm: 4 },
          bgcolor: palette.surface,
          border: "1px solid rgba(79,109,122,0.2)",
          borderRadius: 4,
          backdropFilter: "blur(12px)",
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={1.25} sx={{ alignItems: "flex-start" }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "16px",
                bgcolor: palette.accent,
                color: palette.onAccent,
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 22,
              }}
            >
              G
            </Box>
            <Typography variant="h4" component="h1">
              GroundedRAG
            </Typography>
            <Typography color="text.secondary">
              Sign in with Google through AWS Cognito to upload documents and ask
              grounded questions.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip label="AWS Cognito" size="small" color="primary" variant="outlined" />
            <Chip label="Google IdP" size="small" variant="outlined" />
            <Chip label="PKCE" size="small" variant="outlined" />
          </Stack>

          {!isConfigured && (
            <Alert severity="warning">
              Cognito env vars are missing. Copy `apps/web/.env.example` to `.env.local`
              and fill values from the Cognito SAM stack outputs.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            fullWidth
            size="large"
            variant="contained"
            startIcon={
              submitting ? <CircularProgress size={18} color="inherit" /> : <GoogleIcon />
            }
            onClick={handleGoogleLogin}
            disabled={submitting || !isConfigured}
          >
            {submitting ? "Redirecting…" : "Continue with Google"}
          </Button>

          <Divider sx={{ borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary">
              Secure tenant session
            </Typography>
          </Divider>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <LockOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              Uses Cognito Hosted UI with Authorization Code + PKCE. Tenant identity is
              Cognito `sub` (enforced server-side on the API).
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
