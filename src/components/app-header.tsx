import { motion } from "framer-motion";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bot, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-sunset shadow-glow transition-transform group-hover:scale-110">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-gradient-sunset">APPLICATION</span> Validity
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link to="/dashboard">
            <Button variant={path === "/dashboard" ? "secondary" : "ghost"} size="sm" className="gap-2">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <Link to="/profile">
            <Button variant={path === "/profile" ? "secondary" : "ghost"} size="sm" className="gap-2">
              <UserIcon className="h-4 w-4" /> Profile
            </Button>
          </Link>
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full bg-muted/60 px-2 py-1.5 transition-colors hover:bg-muted">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-sunset text-xs font-bold text-primary-foreground">
                {user?.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: "/dashboard" })}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
              <UserIcon className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                logout();
                navigate({ to: "/login" });
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}
