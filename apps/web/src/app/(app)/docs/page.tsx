"use client";

import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { palette } from "@/theme/theme";

export default function DocsPage() {
  return (
    <Stack spacing={3} sx={{ maxWidth: 820 }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Doc management
        </Typography>
        <Typography color="text.secondary">
          Upload and track document processing status. Backend ingestion wiring comes
          next; this screen is ready for the upload entry point.
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
            PDF and text uploads will request a short-lived S3 URL from the API, then
            process asynchronously through SQS.
          </Typography>
          <Button variant="contained" startIcon={<CloudUploadOutlinedIcon />}>
            Choose files
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
