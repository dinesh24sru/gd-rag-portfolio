import { Suspense } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <CircularProgress color="primary" />
        </Box>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
