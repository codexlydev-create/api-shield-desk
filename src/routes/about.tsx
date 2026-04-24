import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — APPLICATION Validity Manager" },
      {
        name: "description",
        content:
          "Learn about APPLICATION Validity Manager — built to help you create, manage and monitor APPLICATION validity APIs effortlessly.",
      },
      { property: "og:title", content: "About — APPLICATION Validity Manager" },
      {
        property: "og:description",
        content:
          "Learn about APPLICATION Validity Manager — built to help you create, manage and monitor APPLICATION validity APIs effortlessly.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-mesh" />
      <PublicHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" /> About us
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Built for teams managing{" "}
            <span className="text-gradient-sunset">APPLICATION validity</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            APPLICATION Validity Manager helps you spin up unique IDs, set expiry rules and monitor
            live status — all from one clean dashboard.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Target,
              title: "Our mission",
              text: "Make APPLICATION lifecycle management simple, transparent and reliable for every team.",
            },
            {
              icon: ShieldCheck,
              title: "Trust first",
              text: "Strong defaults, clear status indicators and instant block controls keep you in charge.",
            },
            {
              icon: Sparkles,
              title: "Crafted UX",
              text: "Thoughtful details — live countdowns, OTP flows, clean tables — that respect your time.",
            },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-soft backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-warm text-primary-foreground">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-soft backdrop-blur sm:p-10">
          <h2 className="text-2xl font-bold">Our story</h2>
          <p className="mt-3 text-muted-foreground">
            We were tired of juggling spreadsheets and ad-hoc scripts to track when our APPLICATIONs
            would expire, who could access them, and which ones were currently blocked. So we built
            APPLICATION Validity Manager — a single place where every APPLICATION gets a unique ID,
            an expiry date, an HTTPS endpoint and a clear live status.
          </p>
          <p className="mt-3 text-muted-foreground">
            Today the product focuses on three things: speed of setup, clarity of status, and full
            control over each APPLICATION's lifecycle.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/register">
              <Button className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
                Get started free
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline">Contact us</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-sunset shadow-glow">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">
          <span className="text-gradient-sunset">APPLICATION</span> Validity
        </span>
      </Link>
      <nav className="hidden items-center gap-1 sm:flex">
        <Link to="/about">
          <Button variant="ghost" size="sm">
            About
          </Button>
        </Link>
        <Link to="/contact">
          <Button variant="ghost" size="sm">
            Contact
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="ghost" size="sm">
            Log in
          </Button>
        </Link>
        <Link to="/register">
          <Button
            size="sm"
            className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95"
          >
            Get started
          </Button>
        </Link>
      </nav>
      <div className="flex items-center gap-2 sm:hidden">
        <Link to="/login">
          <Button variant="ghost" size="sm">
            Log in
          </Button>
        </Link>
      </div>
    </header>
  );
}
