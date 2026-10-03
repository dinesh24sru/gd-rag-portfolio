"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { palette } from "@/theme/theme";

const DRAWER_WIDTH = 280;

const topNav = [
  { label: "Home", href: "/home", icon: <HomeOutlinedIcon /> },
  { label: "Doc management", href: "/docs", icon: <DescriptionOutlinedIcon /> },
  { label: "Chat", href: "/chat", icon: <ChatBubbleOutlineRoundedIcon /> },
] as const;

const bottomNav = [
  { label: "Settings", href: "/settings", icon: <SettingsOutlinedIcon /> },
  { label: "Profile", href: "/profile", icon: <PersonOutlineRoundedIcon /> },
] as const;

function NavList({
  items,
  onNavigate,
}: {
  items: ReadonlyArray<{ label: string; href: string; icon: ReactNode }>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <List disablePadding>
      {items.map((item) => {
        const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            selected={selected}
            onClick={onNavigate}
          >
            <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{
                primary: { sx: { fontWeight: selected ? 740 : 600 } },
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    onNavigate?.();
    logout();
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", py: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", px: 2.5, mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "14px",
            bgcolor: palette.accent,
            color: palette.onAccent,
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
          }}
        >
          G
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            GD RAG
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Document-grounded answers
          </Typography>
        </Box>
      </Stack>

      <NavList items={topNav} onNavigate={onNavigate} />

      <Box sx={{ flexGrow: 1 }} />

      <Divider sx={{ mx: 2, mb: 1.5, borderColor: "divider" }} />

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", px: 2.5, mb: 1.5 }}>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: palette.slate,
            color: palette.cream,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {(user?.name ?? "U").slice(0, 1).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {user?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.email}
          </Typography>
        </Box>
      </Stack>

      <NavList items={bottomNav} onNavigate={onNavigate} />

      <List disablePadding sx={{ mb: 1 }}>
        <ListItemButton onClick={handleLogout}>
          <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            slotProps={{ primary: { sx: { fontWeight: 600 } } }}
          />
        </ListItemButton>
      </List>
    </Box>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {!isDesktop && (
        <Toolbar
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.appBar,
            bgcolor: "rgba(232, 218, 178, 0.92)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(79,109,122,0.18)",
          }}
        >
          <IconButton edge="start" color="inherit" onClick={() => setMobileOpen(true)}>
            <MenuRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, fontWeight: 800 }}>
            GD RAG
          </Typography>
        </Toolbar>
      )}

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
          }}
        >
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          <SidebarContent />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          px: { xs: 2, md: 4 },
          py: { xs: 10, md: 4 },
          minHeight: "100vh",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
