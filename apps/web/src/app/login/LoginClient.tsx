"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
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
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        overflow: "hidden",
      }}
    >
      {/* Left: brand / product story */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          px: { xs: 3, sm: 5, md: 7 },
          py: { xs: 6, md: 8 },
          bgcolor: palette.slate,
          color: palette.cream,
          backgroundImage:
            "radial-gradient(ellipse 90% 70% at 0% 100%, rgba(221,110,66,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 10%, rgba(192,214,223,0.28), transparent 50%)",
          "@keyframes brandIn": {
            from: { opacity: 0, transform: "translateY(18px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          "@keyframes washIn": {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(36,56,64,0.2) 0%, transparent 45%)",
            animation: "washIn 900ms ease-out both",
            pointerEvents: "none",
          },
        }}
      >
        <Stack
          spacing={2.5}
          sx={{
            position: "relative",
            maxWidth: 440,
            animation: "brandIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
          }}
        >
          <Typography
            component="p"
            sx={{
              m: 0,
              fontWeight: 900,
              fontSize: { xs: "3.4rem", sm: "4.4rem", md: "5rem" },
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              color: palette.cream,
            }}
          >
            GD RAG
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "1.15rem", md: "1.35rem" },
              fontWeight: 600,
              color: "rgba(232,218,178,0.92)",
              maxWidth: 380,
            }}
          >
            Ask your documents. Get answers with sources—or a clear no when evidence is thin.
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(232,218,178,0.7)", maxWidth: 360 }}
          >
            Private uploads. Tenant-scoped retrieval. Citations you can check.
          </Typography>
        </Stack>
      </Box>

      {/* Right: Google sign-in */}
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          px: { xs: 2.5, sm: 4 },
          py: { xs: 5, md: 6 },
          bgcolor: palette.cream,
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 100% 0%, rgba(192,214,223,0.85), transparent 55%)",
          "@keyframes panelIn": {
            from: { opacity: 0, transform: "translateX(16px)" },
            to: { opacity: 1, transform: "translateX(0)" },
          },
        }}
      >
        <Stack
          spacing={3}
          sx={{
            width: "100%",
            maxWidth: 380,
            animation: "panelIn 650ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both",
          }}
        >
          <Stack spacing={1}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              Sign in
            </Typography>
            <Typography color="text.secondary">
              Continue with Google to open your GD RAG workspace.
            </Typography>
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

          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <LockOutlinedIcon sx={{ fontSize: 18, color: "text.secondary", mt: 0.15 }} />
            <Typography variant="caption" color="text.secondary">
              Cognito Hosted UI with Authorization Code + PKCE. Tenant identity is Cognito
              `sub`, enforced server-side.
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
