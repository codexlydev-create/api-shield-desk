import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, KeyRound, ShieldCheck, Zap } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import { tokenStore } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CodexlyFooter } from "@/components/codexly-footer";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && tokenStore.get()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-mesh" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="APPLICATION Validity logo" className="h-9 w-9 rounded-lg shadow-glow" />
          <span className="text-lg font-bold">
            <span className="text-gradient-sunset">APPLICATION</span> Validity
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/about" className="hidden sm:block">
            <Button variant="ghost" size="sm">About</Button>
          </Link>
          <Link to="/contact" className="hidden sm:block">
            <Button variant="ghost" size="sm">Contact</Button>
          </Link>
          <Link to="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link to="/register">
            <Button size="sm" className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
              Get started
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Live — backed by your own MongoDB
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Manage your <span className="text-gradient-sunset">APPLICATION validity</span> APIs in one place
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Generate unique IDs, set expiry dates, block or unblock instantly. Each APPLICATION gets its own
            HTTPS endpoint that returns live status.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
                Create free account <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">I already have an account</Button>
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-muted-foreground sm:hidden">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <span aria-hidden>·</span>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </motion.div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Instant endpoints", text: "Each APPLICATION gets a unique URL the moment it's created." },
            { icon: ShieldCheck, title: "Full control", text: "Block, unblock, or delete APPLICATIONs anytime — state persists." },
            { icon: KeyRound, title: "Secure access", text: "OTP verification on signup, email change, and reset." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              className="rounded-xl border border-border/60 bg-card/70 p-5 shadow-soft backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-warm text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </main>
      <CodexlyFooter />
    </div>
  );
}
