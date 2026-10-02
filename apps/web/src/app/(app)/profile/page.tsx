"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { fetchMe, isApiConfigured, type MeResponse } from "@/lib/api/client";
import { useAuth } from "@/providers/AuthProvider";
import { palette } from "@/theme/theme";

export default function ProfilePage() {
  const { user } = useAuth();
  const [apiMe, setApiMe] = useState<MeResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) {
      setApiError(null);
      setApiMe(null);
      return;
    }

    let cancelled = false;
    setApiLoading(true);
    setApiError(null);

    fetchMe()
      .then((me) => {
        if (!cancelled) {
          setApiMe(me);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          typeof error === "object" &&
          error &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
            ? (error as { message: string }).message
            : "Failed to load API identity";
        setApiError(message);
        setApiMe(null);
      })
      .finally(() => {
        if (!cancelled) {
          setApiLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tenantMatches =
    apiMe && user?.sub ? apiMe.tenantId === user.sub && apiMe.sub === user.sub : null;

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Profile
        </Typography>
        <Typography color="text.secondary">
          Identity from your Cognito Google session. API tenant mapping uses Cognito
          `sub` server-side.
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: palette.surface,
          border: "1px solid rgba(79,109,122,0.16)",
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: palette.orange,
              color: palette.onAccent,
              fontWeight: 800,
              fontSize: 28,
            }}
          >
            {(user?.name ?? "U").slice(0, 1).toUpperCase()}
          </Avatar>
          <Stack spacing={0.5}>
            <Typography variant="h6">{user?.name}</Typography>
            <Typography color="text.secondary">{user?.email}</Typography>
            <Chip label={`${user?.provider ?? "Google"} · Cognito`} size="small" color="primary" />
          </Stack>
        </Stack>

        <Divider sx={{ mb: 1, borderColor: "divider" }} />

        <List dense>
          <ListItem>
            <ListItemText primary="Cognito sub" secondary={user?.sub ?? "—"} />
          </ListItem>
          <ListItem>
            <ListItemText primary="Identity provider" secondary={user?.provider ?? "Google"} />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Tenant (client session)"
              secondary={user?.sub ?? "— (Cognito sub)"}
            />
          </ListItem>
        </List>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: palette.surface,
          border: "1px solid rgba(79,109,122,0.16)",
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="h6">API session (`GET /me`)</Typography>
          <Typography variant="body2" color="text.secondary">
            Server-derived tenant from the Cognito access token after API Gateway JWT
            validation.
          </Typography>

          {!isApiConfigured() && (
            <Alert severity="warning">
              `NEXT_PUBLIC_API_BASE_URL` is not set. Deploy the SAM stack and copy
              `ApiBaseUrl` into `.env.local`.
            </Alert>
          )}

          {apiLoading && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Calling API…
              </Typography>
            </Stack>
          )}

          {apiError && <Alert severity="error">{apiError}</Alert>}

          {apiMe && (
            <>
              <List dense>
                <ListItem>
                  <ListItemText primary="API tenantId" secondary={apiMe.tenantId} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="API sub" secondary={apiMe.sub} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="API email claim" secondary={apiMe.email ?? "—"} />
                </ListItem>
              </List>
              {tenantMatches === true && (
                <Alert severity="success">API tenantId matches Cognito sub.</Alert>
              )}
              {tenantMatches === false && (
                <Alert severity="error">API tenantId does not match Cognito sub.</Alert>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
