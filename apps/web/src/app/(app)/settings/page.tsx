"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { palette } from "@/theme/theme";

export default function SettingsPage() {
  return (
    <Stack spacing={3} sx={{ maxWidth: 720, width: "100%" }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Settings
        </Typography>
        <Typography color="text.secondary">
          Workspace preferences for GD RAG. Values are local placeholders for now.
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          bgcolor: palette.surface,
          border: "1px solid rgba(79,109,122,0.16)",
        }}
      >
        <Stack spacing={1.5}>
          <FormControlLabel
            control={<Switch defaultChecked color="primary" />}
            label="Show citation snippets by default"
            sx={{ alignItems: "flex-start", m: 0, gap: 1 }}
          />
          <FormControlLabel
            control={<Switch color="primary" />}
            label="Email me when ingestion finishes"
            sx={{ alignItems: "flex-start", m: 0, gap: 1 }}
          />
          <FormControlLabel
            control={<Switch defaultChecked color="primary" />}
            label="Abstain when retrieval confidence is low"
            sx={{ alignItems: "flex-start", m: 0, gap: 1 }}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
