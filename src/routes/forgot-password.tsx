import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { authApi } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

const pwSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ForgotPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await authApi.forgotStart({ email: email.trim() });
      toast.success("Reset code sent", { description: `Check ${email}` });
      setStep("reset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = pwSchema.safeParse(pw);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (map[i.path[0] as string] = i.message));
      setErrors(map);
      return;
    }
    setResetting(true);
    try {
      await authApi.forgotVerify({ email: email.trim(), code: otp, password: pw.password });
      toast.success("Password updated. Please log in.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <AuthShell
      title={step === "email" ? "Forgot password" : "Reset your password"}
      subtitle={step === "email" ? "We'll send a 6-digit code to your email" : `Enter the code sent to ${email}`}
    >
      {step === "email" ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required />
          </div>
          <Button type="submit" disabled={sending} className="w-full bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
            {sending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code…</>) : "Send reset code"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">Back to login</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-5">
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
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <PasswordInput id="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput id="confirm" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
          </div>
          <Button type="submit" disabled={resetting} className="w-full bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
            {resetting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…</>) : "Reset password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
