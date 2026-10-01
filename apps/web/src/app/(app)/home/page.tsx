"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { useAuth } from "@/providers/AuthProvider";
import { palette } from "@/theme/theme";

const highlights = [
  {
    title: "Tenant-isolated retrieval",
    body: "Every search is scoped to your authenticated tenant before the model is called.",
    icon: <ShieldOutlinedIcon />,
  },
  {
    title: "Grounded answers",
    body: "Answers come only from retrieved document chunks, with citations you can verify.",
    icon: <FactCheckOutlinedIcon />,
  },
  {
    title: "Abstain when unsure",
    body: "If evidence is weak, the system refuses instead of inventing an answer.",
    icon: <ChatBubbleOutlineRoundedIcon />,
  },
] as const;

export default function HomePage() {
  const { user } = useAuth();

  return (
    <Stack spacing={4} sx={{ maxWidth: 980 }}>
      <Stack spacing={1.5}>
        <Chip
          label="Document-grounded RAG"
          color="primary"
          sx={{ alignSelf: "flex-start", fontWeight: 700 }}
        />
        <Typography variant="h3" component="h1">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ maxWidth: 720, fontWeight: 500 }}
        >
          GroundedRAG helps you upload private documents and ask questions that stay
          tied to your sources—with citations, tenant isolation, and abstention when
          evidence is missing.
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 4,
          bgcolor: palette.slate,
          color: palette.cream,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2.5}
          sx={{
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ color: palette.cream, fontWeight: 800 }}>
              Start with your documents
            </Typography>
            <Typography sx={{ color: "rgba(232,218,178,0.86)", mt: 0.75, maxWidth: 520 }}>
              Upload files for async indexing, then open chat to ask grounded questions
              about what you own.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              component={Link}
              href="/docs"
              variant="contained"
              startIcon={<CloudUploadOutlinedIcon />}
              sx={{
                bgcolor: palette.orange,
                color: palette.onAccent,
                "&:hover": { bgcolor: "#C85E36" },
              }}
            >
              Upload
            </Button>
            <Button
              component={Link}
              href="/chat"
              variant="outlined"
              startIcon={<ChatBubbleOutlineRoundedIcon />}
              sx={{
                borderColor: palette.cream,
                color: palette.cream,
                "&:hover": {
                  borderColor: palette.cream,
                  bgcolor: "rgba(232,218,178,0.12)",
                },
              }}
            >
              Chat
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {highlights.map((item) => (
          <Grid key={item.title} size={{ xs: 12, md: 4 }}>
            <Paper
              elevation={0}
              sx={{
                height: "100%",
                p: 2.5,
                borderRadius: 3,
                bgcolor: palette.powder,
                border: "1px solid rgba(79,109,122,0.16)",
              }}
            >
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    bgcolor: palette.cream,
                    display: "grid",
                    placeItems: "center",
                    color: palette.orange,
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="h6">{item.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.body}
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
