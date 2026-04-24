import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { hashPassword, otpStore, usersStore } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

const schema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
    email: z.string().trim().email("Enter a valid email").max(120),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [data, setData] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [sendingOtp, setSendingOtp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (map[i.path[0] as string] = i.message));
      setErrors(map);
      return;
    }
    setErrors({});
    if (usersStore.byEmail(data.email)) {
      toast.error("An account with this email already exists.");
      return;
    }
    setSendingOtp(true);
    await new Promise((r) => setTimeout(r, 400));
    const code = otpStore.generate(data.email, "register");
    toast.success("OTP sent (demo mode)", {
      description: `Your code: ${code}`,
      duration: 15000,
    });
    setSendingOtp(false);
    setStep("otp");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    const res = otpStore.verify(data.email, "register", otp);
    if (!res.ok) {
      toast.error("Invalid or expired code");
      setSubmitting(false);
      return;
    }
    const id = `u_${Date.now().toString(36)}`;
    usersStore.create({
      id,
      name: data.name,
      email: data.email,
      passwordHash: hashPassword(data.password),
      emailVerified: true,
      createdAt: new Date().toISOString(),
    });
    toast.success("Account created — welcome!");
    refresh();
    navigate({ to: "/login" });
  };

  return (
    <AuthShell
      title={step === "form" ? "Create your account" : "Verify your email"}
      subtitle={step === "form" ? "Start managing APPLICATION validities in seconds" : `We sent a 6-digit code to ${data.email}`}
    >
      {step === "form" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Jane Doe" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (Gmail)</Label>
            <Input id="email" type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="you@gmail.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} placeholder="At least 8 characters" />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput id="confirm" value={data.confirm} onChange={(e) => setData({ ...data, confirm: e.target.value })} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
          </div>
          <Button type="submit" disabled={sendingOtp} className="w-full bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
            {sendingOtp ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code…</>) : "Send verification code"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </form>
      ) : (
        <motion.form
          key="otp"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onSubmit={handleVerify}
          className="space-y-6"
        >
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
          <Button type="submit" disabled={submitting} className="w-full bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
            {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>) : "Verify & create account"}
          </Button>
          <button
            type="button"
            onClick={() => {
              const code = otpStore.generate(data.email, "register");
              toast.success("New code sent", { description: `Your code: ${code}`, duration: 15000 });
            }}
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Resend code
          </button>
        </motion.form>
      )}
    </AuthShell>
  );
}
