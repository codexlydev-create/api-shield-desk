import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, Mail, MapPin, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CodexlyFooter } from "@/components/codexly-footer";
import { contactApi } from "@/lib/api";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — APPLICATION Validity Manager" },
      {
        name: "description",
        content:
          "Get in touch with the APPLICATION Validity Manager team. We'd love to hear your questions, feedback or feature requests.",
      },
      { property: "og:title", content: "Contact — APPLICATION Validity Manager" },
      {
        property: "og:description",
        content:
          "Get in touch with the APPLICATION Validity Manager team. We'd love to hear your questions, feedback or feature requests.",
      },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
});

function ContactPage() {
  const [data, setData] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (map[i.path[0] as string] = i.message));
      setErrors(map);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      await contactApi.send(parsed.data);
      setData({ name: "", email: "", message: "" });
      toast.success("Message sent", {
        description: "Thanks for reaching out — we'll get back soon.",
      });
    } catch (err) {
      const message = (err as Error)?.message || "Failed to send message";
      toast.error("Could not send message", { description: message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-mesh" />
      <PublicHeader />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <MessageSquare className="h-3 w-3" /> Contact us
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Let's <span className="text-gradient-sunset">talk</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Have a question, feedback, or a feature request? Send us a note and we'll get back as
            soon as we can.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="space-y-3"
          >
            <InfoCard
              icon={Mail}
              title="Email"
              value="codexlydev@gmail.com"
              hint="We typically reply within 1 business day."
            />
            <InfoCard
              icon={MessageSquare}
              title="Support"
              value="codexlydev@gmail.com"
              hint="For account or API endpoint issues."
            />
            <InfoCard
              icon={MapPin}
              title="Location"
              value="Remote — worldwide"
              hint="Async-first, distributed team."
            />
          </motion.div>

          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-elegant backdrop-blur sm:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cname">Your name</Label>
                <Input
                  id="cname"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="Jane Doe"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cemail">Email</Label>
                <Input
                  id="cemail"
                  type="email"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  placeholder="you@gmail.com"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="cmsg">Message</Label>
              <Textarea
                id="cmsg"
                rows={6}
                value={data.message}
                onChange={(e) => setData({ ...data, message: e.target.value })}
                placeholder="Tell us what's on your mind…"
              />
              {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                We typically reply within 1 business day.
              </p>
              <Button
                type="submit"
                disabled={sending}
                className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95"
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" /> Send message
                  </>
                )}
              </Button>
            </div>
          </motion.form>
        </div>
      </main>
      <CodexlyFooter />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-soft backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-warm text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
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
