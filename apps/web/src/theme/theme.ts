"use client";

import { createTheme } from "@mui/material/styles";

/** Brand swatches from the product palette. */
export const palette = {
  orange: "#DD6E42",
  cream: "#E8DAB2",
  slate: "#4F6D7A",
  powder: "#C0D6DF",
  /** Slate deepened so body copy stays readable on cream and powder. */
  ink: "#243840",
  background: "#E8DAB2",
  surface: "#F7F3E6",
  mid: "#4F6D7A",
  accent: "#DD6E42",
  text: "#243840",
  textMuted: "rgba(36, 56, 64, 0.72)",
  lightSurface: "#FFFFFF",
  onAccent: "#FFFFFF",
} as const;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: palette.orange,
      contrastText: palette.onAccent,
    },
    secondary: {
      main: palette.slate,
      contrastText: palette.cream,
    },
    background: {
      default: palette.cream,
      paper: palette.surface,
    },
    text: {
      primary: palette.ink,
      secondary: palette.slate,
    },
    divider: "rgba(79, 109, 122, 0.22)",
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: "'Manrope', 'Segoe UI', sans-serif",
    h1: {
      fontWeight: 800,
      letterSpacing: "-0.03em",
      fontSize: "clamp(2rem, 5vw, 3.25rem)",
    },
    h2: {
      fontWeight: 780,
      letterSpacing: "-0.02em",
      fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
    },
    h3: {
      fontWeight: 720,
      letterSpacing: "-0.02em",
      fontSize: "clamp(1.5rem, 3.5vw, 2.15rem)",
    },
    h4: {
      fontWeight: 700,
      fontSize: "clamp(1.3rem, 2.8vw, 1.75rem)",
    },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 680 },
    button: { fontWeight: 720, textTransform: "none" },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.55 },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.cream,
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 8% -12%, rgba(221,110,66,0.22), transparent 55%), radial-gradient(ellipse 70% 45% at 100% 0%, rgba(192,214,223,0.95), transparent 52%)",
          color: palette.ink,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 22,
          paddingBlock: 10,
          variants: [
            {
              props: { variant: "contained", color: "primary" },
              style: {
                backgroundColor: palette.orange,
                color: palette.onAccent,
                "&:hover": {
                  backgroundColor: "#C85E36",
                },
              },
            },
            {
              props: { variant: "outlined" },
              style: {
                borderColor: "rgba(79,109,122,0.45)",
                color: palette.slate,
                "&:hover": {
                  borderColor: palette.slate,
                  backgroundColor: "rgba(79,109,122,0.08)",
                },
              },
            },
          ],
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          variants: [
            {
              props: { variant: "outlined" },
              style: {
                borderColor: "rgba(79,109,122,0.4)",
                color: palette.slate,
              },
            },
          ],
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.powder,
          color: palette.ink,
          borderRight: "1px solid rgba(79,109,122,0.18)",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          marginInline: 10,
          marginBlock: 4,
          color: palette.ink,
          "&.Mui-selected": {
            backgroundColor: palette.orange,
            color: palette.onAccent,
            "& .MuiListItemIcon-root": {
              color: palette.onAccent,
            },
            "&:hover": {
              backgroundColor: "#C85E36",
            },
          },
          "&:hover": {
            backgroundColor: "rgba(79, 109, 122, 0.12)",
          },
        },
      },
    },
  },
});
