"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";
import { theme } from "@/theme/theme";
import { AuthProvider } from "@/providers/AuthProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
