"use client";

import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/providers/AuthProvider";
import { palette } from "@/theme/theme";

export default function ProfilePage() {
  const { user } = useAuth();

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
              primary="Tenant (v1)"
              secondary={user?.sub ?? "— (Cognito sub, enforced server-side)"}
            />
          </ListItem>
        </List>
      </Paper>
    </Stack>
  );
}
