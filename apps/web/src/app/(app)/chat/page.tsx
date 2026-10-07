"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  askQuestion,
  fetchUsage,
  isApiConfigured,
  type AskResponse,
  type ChatUsageSnapshot,
  type Citation,
  type ApiClientError,
} from "@/lib/api/client";
import { palette } from "@/theme/theme";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  abstained?: boolean;
  citations?: Citation[];
};

function formatTokens(n: number): string {
  return n.toLocaleString();
}

function QuotaBar({ usage }: { usage: ChatUsageSnapshot }) {
  const pct =
    usage.quotaTokens > 0
      ? Math.min(100, Math.round((usage.usedTokens / usage.quotaTokens) * 100))
      : 0;
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: { xs: 2, sm: 3 },
        bgcolor: palette.surface,
        border: "1px solid rgba(79,109,122,0.16)",
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={0.5}
          sx={{ justifyContent: "space-between", alignItems: { sm: "baseline" } }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Chat tokens ({usage.period} UTC)
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflowWrap: "anywhere" }}
          >
            {formatTokens(usage.usedTokens)} / {formatTokens(usage.quotaTokens)} used ·{" "}
            {formatTokens(usage.remainingTokens)} left
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          aria-label="Chat token usage"
          sx={{
            height: 8,
            borderRadius: 999,
            bgcolor: "rgba(79,109,122,0.12)",
            "& .MuiLinearProgress-bar": {
              bgcolor: usage.remainingTokens === 0 ? palette.orange : palette.slate,
            },
          }}
        />
      </Stack>
    </Paper>
  );
}

function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) {
    return null;
  }
  return (
    <Stack spacing={1} sx={{ mt: 1.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        Sources
      </Typography>
      {citations.map((c) => (
        <Box
          key={`${c.documentId}:${c.chunkId}`}
          sx={{
            pl: 1.25,
            borderLeft: `3px solid ${palette.slate}`,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", overflowWrap: "anywhere" }}
          >
            {c.documentId} · score {c.score.toFixed(2)}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.25, overflowWrap: "anywhere", color: palette.ink }}
          >
            {c.excerpt}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <Box
      sx={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: { xs: "92%", sm: "85%" },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.25, sm: 1.5 },
          borderRadius: 3,
          bgcolor: isUser ? palette.slate : palette.lightSurface,
          color: isUser ? palette.onAccent : palette.ink,
          border: isUser ? "none" : "1px solid rgba(79,109,122,0.16)",
        }}
      >
        <Typography
          variant="body1"
          sx={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: { xs: "0.95rem", sm: "1rem" },
          }}
        >
          {message.text}
        </Typography>
        {message.abstained ? (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 1,
              opacity: 0.85,
              color: isUser ? palette.cream : palette.slate,
            }}
          >
            Abstained — insufficient evidence in your documents.
          </Typography>
        ) : null}
        {!isUser && message.citations ? (
          <CitationList citations={message.citations} />
        ) : null}
      </Paper>
    </Box>
  );
}

export default function ChatPage() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ChatUsageSnapshot | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  const refreshUsage = useCallback(async () => {
    if (!isApiConfigured()) {
      setUsageError("API is not configured.");
      setUsageLoading(false);
      return;
    }
    try {
      setUsageError(null);
      const next = await fetchUsage();
      setUsage(next);
    } catch (err) {
      const apiErr = err as ApiClientError;
      setUsageError(apiErr?.message ?? "Could not load token usage.");
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, sending]);

  const quotaExhausted = usage !== null && usage.remainingTokens <= 0;
  const canSend = Boolean(draft.trim()) && !sending && !quotaExhausted;

  const handleSend = useCallback(async () => {
    const question = draft.trim();
    if (!question || sending || quotaExhausted) {
      return;
    }
    if (!isApiConfigured()) {
      setSendError("API is not configured.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: question,
    };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setSendError(null);
    setSending(true);

    try {
      const result: AskResponse = await askQuestion(question);
      setUsage(result.usage);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: result.answer,
          abstained: result.abstained,
          citations: result.citations,
        },
      ]);
    } catch (err) {
      const apiErr = err as ApiClientError;
      if (apiErr?.usage) {
        setUsage(apiErr.usage);
      }
      setSendError(apiErr?.message ?? "Ask failed. Try again.");
    } finally {
      setSending(false);
    }
  }, [draft, sending, quotaExhausted]);

  return (
    <Stack
      spacing={2.5}
      sx={{
        maxWidth: 900,
        width: "100%",
        height: {
          xs: "calc(100dvh - 56px - 72px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 40px)",
          sm: "calc(100dvh - 64px - 72px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 48px)",
          md: "calc(100dvh - 64px)",
        },
        minHeight: { xs: 420, md: 520 },
      }}
    >
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Chat
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: { xs: "0.95rem", sm: "1rem" } }}>
          Ask questions about your uploaded documents. Answers are grounded in retrieved
          chunks, with citations, or abstain when evidence is weak.
        </Typography>
      </Stack>

      {usageLoading ? (
        <LinearProgress aria-label="Loading token usage" />
      ) : usage ? (
        <QuotaBar usage={usage} />
      ) : usageError ? (
        <Typography variant="body2" color="error" sx={{ overflowWrap: "anywhere" }}>
          {usageError}
        </Typography>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          p: { xs: 2, sm: 3 },
          borderRadius: { xs: 3, sm: 4 },
          bgcolor: palette.surface,
          border: "1px solid rgba(79,109,122,0.16)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          ref={listRef}
          sx={{
            flexGrow: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            overflow: "auto",
            px: { xs: 0.25, sm: 0.5 },
          }}
        >
          {messages.length === 0 && !sending ? (
            <Box
              sx={{
                flexGrow: 1,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                px: { xs: 1, sm: 2 },
              }}
            >
              <Stack spacing={1} sx={{ maxWidth: 420 }}>
                <Typography variant="h6">No messages yet</Typography>
                <Typography color="text.secondary">
                  When documents are READY, answers are grounded in retrieved chunks and
                  abstain if evidence is insufficient.
                  {quotaExhausted
                    ? " Your monthly chat token quota is used up — try again next UTC month."
                    : null}
                </Typography>
              </Stack>
            </Box>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {sending ? (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 0.5 }}>
                  <CircularProgress size={18} sx={{ color: palette.slate }} />
                  <Typography variant="body2" color="text.secondary">
                    Retrieving and generating…
                  </Typography>
                </Stack>
              ) : null}
            </>
          )}
        </Box>

        {sendError ? (
          <Typography
            variant="body2"
            color="error"
            sx={{ mt: 1.5, overflowWrap: "anywhere" }}
          >
            {sendError}
          </Typography>
        ) : null}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: "stretch", mt: 2 }}
        >
          <TextField
            fullWidth
            placeholder="Ask about your documents…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={quotaExhausted || sending}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            slotProps={{
              input: {
                sx: {
                  bgcolor: palette.lightSurface,
                  color: palette.ink,
                  borderRadius: { xs: 3, sm: 999 },
                  "& fieldset": { border: "none" },
                },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      color="primary"
                      aria-label="Send message"
                      disabled={!canSend}
                      onClick={() => void handleSend()}
                      sx={{
                        bgcolor: palette.orange,
                        color: palette.onAccent,
                        "&.Mui-disabled": {
                          bgcolor: "rgba(221,110,66,0.35)",
                          color: palette.onAccent,
                        },
                      }}
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
            disabled={!canSend}
            onClick={() => void handleSend()}
            sx={{ display: { xs: "none", sm: "inline-flex" }, minWidth: 120 }}
          >
            Send
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
