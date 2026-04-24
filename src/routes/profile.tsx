import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, KeyRound, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { hashPassword, otpStore, sessionStore, usersStore } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !sessionStore.get()) {
      throw redirect({ to: "/login" });
    }
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refresh } = useAuth();
  const [emailOpen, setEmailOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your <span className="text-gradient-sunset">profile</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account and security settings.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elegant"
        >
          <div className="relative h-28 bg-gradient-sunset">
            <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
          </div>
          <div className="relative px-6 pb-6">
            <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-2xl bg-card text-3xl font-bold text-primary shadow-glow ring-4 ring-card">
              <span className="text-gradient-sunset">{user.name[0]?.toUpperCase()}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{user.name}</h2>
              {user.emailVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" /> {user.email}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <InfoRow icon={UserIcon} label="Account ID" value={user.id} mono />
              <InfoRow
                icon={ShieldCheck}
                label="Joined"
                value={new Date(user.createdAt).toLocaleDateString()}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
        >
          <h3 className="text-base font-semibold">Security</h3>
          <p className="text-sm text-muted-foreground">Update your email or password.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEmailOpen(true)}>
              <Mail className="mr-2 h-4 w-4" /> Change email
            </Button>
            <Button variant="outline" onClick={() => setPwOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" /> Change password
            </Button>
          </div>
        </motion.div>
      </main>

      <ChangeEmailDialog open={emailOpen} onOpenChange={setEmailOpen} onDone={refresh} />
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`truncate text-sm ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
      </div>
    </div>
  );
}

function ChangeEmailDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [step, setStep] = useState<"input" | "otp">("input");
  const [otp, setOtp] = useState("");

  const sendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().email().safeParse(newEmail.trim());
    if (!parsed.success) {
      toast.error("Enter a valid email");
      return;
    }
    if (usersStore.byEmail(newEmail)) {
      toast.error("Email already in use");
      return;
    }
    const code = otpStore.generate(newEmail, "change-email", { userId: user!.id });
    toast.success("OTP sent (demo)", { description: `Code: ${code}`, duration: 15000 });
    setStep("otp");
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    const v = otpStore.verify(newEmail, "change-email", otp);
    if (!v.ok) {
      toast.error("Invalid or expired code");
      return;
    }
    usersStore.update(user!.id, { email: newEmail.trim(), emailVerified: true });
    toast.success("Email updated");
    onDone();
    onOpenChange(false);
    setStep("input");
    setNewEmail("");
    setOtp("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setStep("input"); setNewEmail(""); setOtp(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "input" ? "Change email" : "Verify new email"}</DialogTitle>
          <DialogDescription>
            {step === "input" ? "Enter your new email address. We'll send a verification code." : `Code sent to ${newEmail}`}
          </DialogDescription>
        </DialogHeader>
        {step === "input" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New email</Label>
              <Input id="newEmail" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
                Send code
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStep("input")}>Back</Button>
              <Button type="submit" className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
                Verify & update
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const pwSchema = z
  .object({
    current: z.string().min(1, "Required"),
    next: z.string().min(8, "At least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [data, setData] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = pwSchema.safeParse(data);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (map[i.path[0] as string] = i.message));
      setErrors(map);
      return;
    }
    if (user!.passwordHash !== hashPassword(data.current)) {
      setErrors({ current: "Incorrect current password" });
      return;
    }
    usersStore.update(user!.id, { passwordHash: hashPassword(data.next) });
    toast.success("Password updated");
    setData({ current: "", next: "", confirm: "" });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Use a strong, unique password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <PasswordInput id="current" value={data.current} onChange={(e) => setData({ ...data, current: e.target.value })} />
            {errors.current && <p className="text-xs text-destructive">{errors.current}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="next">New password</Label>
            <PasswordInput id="next" value={data.next} onChange={(e) => setData({ ...data, next: e.target.value })} />
            {errors.next && <p className="text-xs text-destructive">{errors.next}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <PasswordInput id="confirm" value={data.confirm} onChange={(e) => setData({ ...data, confirm: e.target.value })} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
