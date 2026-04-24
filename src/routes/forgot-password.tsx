import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { hashPassword, otpStore, usersStore } from "@/lib/storage";

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

  const sendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const u = usersStore.byEmail(email);
    if (!u) {
      toast.error("No account with that email.");
      return;
    }
    const code = otpStore.generate(email, "reset");
    toast.success("Reset code sent (demo mode)", { description: `Your code: ${code}`, duration: 15000 });
    setStep("reset");
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = pwSchema.safeParse(pw);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (map[i.path[0] as string] = i.message));
      setErrors(map);
      return;
    }
    const v = otpStore.verify(email, "reset", otp);
    if (!v.ok) {
      toast.error("Invalid or expired code");
      return;
    }
    const u = usersStore.byEmail(email)!;
    usersStore.update(u.id, { passwordHash: hashPassword(pw.password) });
    toast.success("Password updated. Please log in.");
    navigate({ to: "/login" });
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
          <Button type="submit" className="w-full bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
            Send reset code
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
            <Input id="password" type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
          </div>
          <Button type="submit" className="w-full bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
