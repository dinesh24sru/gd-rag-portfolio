"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  createUploadUrl,
  deleteDocument,
  isApiConfigured,
  listDocuments,
  type DocumentRecord,
} from "@/lib/api/client";
import { palette } from "@/theme/theme";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 5;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function resolveContentType(file: File): string {
  if (file.type === "application/pdf" || file.type === "text/plain" || file.type === "text/markdown") {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  throw new Error("Only PDF, TXT, and Markdown files are supported (max 10 MB).");
}

function statusColor(status: DocumentRecord["status"]): "default" | "warning" | "success" | "error" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "error";
    case "PROCESSING":
      return "warning";
    default:
      return "default";
  }
}

export default function DocsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const atLimit = documents.length >= MAX_DOCUMENTS;

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) {
      setLoading(false);
      setError("NEXT_PUBLIC_API_BASE_URL is not set.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listDocuments();
      setDocuments(rows);
    } catch (err) {
      setError(errorMessage(err, "Failed to load documents"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPick = () => inputRef.current?.click();

  const onFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setError(null);
    setInfo(null);

    try {
      if (documents.length >= MAX_DOCUMENTS) {
        throw new Error(`Document limit reached (${MAX_DOCUMENTS}). Delete a file first.`);
      }
      if (file.size > MAX_BYTES) {
        throw new Error("File exceeds the 10 MB limit.");
      }
      const contentType = resolveContentType(file);
      setUploading(true);

      const { document, uploadUrl } = await createUploadUrl({
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });

      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": contentType,
        },
      });

      if (!put.ok) {
        throw new Error(`S3 upload failed (${put.status})`);
      }

      setInfo(`Uploaded “${document.fileName}”. Status is PENDING until ingestion is wired.`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const onDelete = async (doc: DocumentRecord) => {
    const okConfirm = window.confirm(`Delete “${doc.fileName}”? This removes it from storage.`);
    if (!okConfirm) return;

    setError(null);
    setInfo(null);
    setDeletingId(doc.documentId);
    try {
      await deleteDocument(doc.documentId);
      setInfo(`Deleted “${doc.fileName}”.`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Delete failed"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 820 }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Doc management
        </Typography>
        <Typography color="text.secondary">
          Upload private files with a short-lived S3 URL. Max {MAX_DOCUMENTS} files per account.
          Delete removes the object from S3 and its DynamoDB metadata.
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 4,
          border: "1px dashed rgba(221,110,66,0.55)",
          bgcolor: palette.powder,
          textAlign: "center",
        }}
      >
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CloudUploadOutlinedIcon sx={{ fontSize: 42, color: "primary.main" }} />
          <Typography variant="h6">Upload documents</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
            PDF, TXT, or Markdown up to 10 MB ({documents.length}/{MAX_DOCUMENTS} used).
          </Typography>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            hidden
            onChange={(e) => void onFile(e.target.files)}
          />
          <Button
            variant="contained"
            startIcon={
              uploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadOutlinedIcon />
            }
            onClick={onPick}
            disabled={uploading || atLimit || !isApiConfigured() || Boolean(deletingId)}
          >
            {uploading ? "Uploading…" : atLimit ? "Limit reached" : "Choose file"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}
      {atLimit && !error && (
        <Alert severity="info">You have {MAX_DOCUMENTS} documents. Delete one to upload another.</Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          bgcolor: palette.surface,
          border: "1px solid rgba(79,109,122,0.16)",
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">Your documents</Typography>
            <Button
              size="small"
              onClick={() => void refresh()}
              disabled={loading || uploading || Boolean(deletingId)}
            >
              Refresh
            </Button>
          </Stack>

          {loading && (
            <Box sx={{ display: "grid", placeItems: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!loading && documents.length === 0 && (
            <Typography color="text.secondary" variant="body2">
              No documents yet. Upload a file to create a PENDING record.
            </Typography>
          )}

          {!loading && documents.length > 0 && (
            <List dense disablePadding>
              {documents.map((doc) => (
                <ListItem
                  key={doc.documentId}
                  secondaryAction={
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip size="small" label={doc.status} color={statusColor(doc.status)} />
                      <IconButton
                        edge="end"
                        aria-label={`Delete ${doc.fileName}`}
                        onClick={() => void onDelete(doc)}
                        disabled={uploading || Boolean(deletingId)}
                      >
                        {deletingId === doc.documentId ? (
                          <CircularProgress size={18} />
                        ) : (
                          <DeleteOutlineRoundedIcon />
                        )}
                      </IconButton>
                    </Stack>
                  }
                  sx={{ px: 0, pr: 12 }}
                >
                  <ListItemText
                    primary={doc.fileName}
                    secondary={`${doc.contentType} · ${(doc.sizeBytes / 1024).toFixed(1)} KB · ${new Date(doc.createdAt).toLocaleString()}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
