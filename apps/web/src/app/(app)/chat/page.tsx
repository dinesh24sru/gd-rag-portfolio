"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { useState } from "react";
import { palette } from "@/theme/theme";

export default function ChatPage() {
  const [draft, setDraft] = useState("");

  return (
    <Stack spacing={3} sx={{ maxWidth: 900, height: { md: "calc(100vh - 64px)" } }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Chat
        </Typography>
        <Typography color="text.secondary">
          Ask questions about your uploaded documents. Retrieval, confidence gating,
          and citations will connect here once the API is live.
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          flexGrow: 1,
          minHeight: 360,
          p: 3,
          borderRadius: 4,
          bgcolor: palette.surface,
          border: "1px solid rgba(79,109,122,0.16)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            flexGrow: 1,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            px: 2,
          }}
        >
          <Stack spacing={1} sx={{ maxWidth: 420 }}>
            <Typography variant="h6">No messages yet</Typography>
            <Typography color="text.secondary">
              When documents are READY, answers will be grounded in retrieved chunks
              and will abstain if evidence is insufficient.
            </Typography>
          </Stack>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "stretch" }}>
          <TextField
            fullWidth
            placeholder="Ask about your documents…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            slotProps={{
              input: {
                sx: {
                  bgcolor: palette.lightSurface,
                  color: palette.ink,
                  borderRadius: 999,
                  "& fieldset": { border: "none" },
                },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      color="primary"
                      disabled={!draft.trim()}
                      sx={{ bgcolor: palette.orange, color: palette.onAccent }}
                    >
                      <SendRoundedIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            variant="contained"
            disabled={!draft.trim()}
            sx={{ display: { xs: "none", sm: "inline-flex" }, minWidth: 120 }}
          >
            Send
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
