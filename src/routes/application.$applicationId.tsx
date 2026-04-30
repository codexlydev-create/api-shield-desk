import { useEffect, useState, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sessionStore } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import {
  devicesApi,
  publicApi,
  type Device,
  type DeviceStatus,
  type PublicApplicationResponse,
} from "@/lib/api";

export const Route = createFileRoute("/application/$applicationId")({
  head: ({ params }) => ({
    meta: [
      { title: `Application ${params.applicationId} — Device Access` },
      {
        name: "description",
        content:
          "Register and manage device access requests for this application.",
      },
    ],
  }),
  component: ApplicationDetailsPage,
});

function StatusBadge({ status }: { status: DeviceStatus }) {
  if (status === "approved") {
    return (
      <Badge className="border-0 bg-success/15 text-success hover:bg-success/20">
        <ShieldCheck className="mr-1 h-3 w-3" /> Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="border-0 bg-destructive/15 text-destructive hover:bg-destructive/20">
        <X className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-warning/20 text-warning-foreground hover:bg-warning/30">
      <Clock className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}

function CopyInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("Copy failed");
        }
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function CopyBlock({ value, language = "text" }: { value: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed">
        <code data-lang={language}>{value}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied");
            setTimeout(() => setCopied(false), 1200);
          } catch {
            toast.error("Copy failed");
          }
        }}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
        aria-label="Copy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function ApplicationDetailsPage() {
  const { applicationId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAuthed = typeof window !== "undefined" && !!sessionStore.get();

  const [appData, setAppData] = useState<PublicApplicationResponse | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [appLoading, setAppLoading] = useState(true);

  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState<string | null>(null);

  const [deviceName, setDeviceName] = useState("");
  const [deviceSecret, setDeviceSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  const apiBase =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:4000";
  const postUrl = `${apiBase}/api/public/applications/${applicationId}/device`;
  const getUrl = `${apiBase}/api/public/applications/${applicationId}/deviceAccess`;
  const postBody = JSON.stringify(
    { deviceName: "DESKTOP-ABC123", deviceSecret: "9f1c2e7a8b3d", status: "pending" },
    null,
    2,
  );
  const curlPost = `curl -X POST "${postUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${postBody.replace(/\n/g, " ").replace(/\s+/g, " ")}'`;
  const curlGet = `curl "${getUrl}"`;

  const loadApp = useCallback(async () => {
    setAppLoading(true);
    setAppError(null);
    try {
      const data = await publicApi.getApplication(applicationId);
      setAppData(data);
    } catch (e) {
      setAppError(e instanceof Error ? e.message : "Failed to load application");
    } finally {
      setAppLoading(false);
    }
  }, [applicationId]);

  const loadDevices = useCallback(async () => {
    setDevicesError(null);
    try {
      // Owner gets the authenticated list (so the action buttons work
      // implicitly via ownership). Anonymous viewers fall back to public list.
      const res = isAuthed
        ? await devicesApi.listOwned(applicationId).catch(async (e) => {
            // 404 here means "you don't own it" — fall back to public list.
            if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) {
              return devicesApi.listPublic(applicationId);
            }
            throw e;
          })
        : await devicesApi.listPublic(applicationId);
      setDevices(res.devices);
    } catch (e) {
      setDevicesError(e instanceof Error ? e.message : "Failed to load devices");
    } finally {
      setDevicesLoading(false);
    }
  }, [applicationId, isAuthed]);

  useEffect(() => {
    loadApp();
    loadDevices();
  }, [loadApp, loadDevices]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || !deviceSecret.trim()) {
      toast.error("Device name and secret are required");
      return;
    }
    setSubmitting(true);
    try {
      await devicesApi.register(applicationId, {
        deviceName: deviceName.trim(),
        deviceSecret: deviceSecret.trim(),
      });
      toast.success("Device registered — pending approval");
      setDeviceName("");
      setDeviceSecret("");
      loadDevices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Owner-only: derived from "is logged in AND the listOwned call worked".
  // We don't have a clean ownership flag — but if listOwned succeeded the
  // user owns the app, so we expose action buttons. We approximate by
  // checking `user` + a successful first load.
  const canManage = isAuthed && !!user;

  const updateStatus = async (device: Device, status: DeviceStatus) => {
    setActioningId(device.id);
    try {
      const res = await devicesApi.updateStatus(applicationId, device.id, status);
      setDevices((prev) => prev.map((d) => (d.id === device.id ? res.device : d)));
      toast.success(`Device ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActioningId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await devicesApi.remove(applicationId, deleteTarget.id);
      setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success("Device deleted");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/dashboard" })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadApp();
              loadDevices();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Application
                <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                  {applicationId}
                </code>
                <CopyInline value={applicationId} />
              </CardTitle>
              <CardDescription>
                Public application details and device access management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : appError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {appError}
                </div>
              ) : appData ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Status
                    </div>
                    <div className="mt-1">
                      <Badge
                        className={
                          appData.status === "active"
                            ? "border-0 bg-success/15 text-success"
                            : appData.status === "expired"
                              ? "border-0 bg-destructive/15 text-destructive"
                              : "border-0 bg-warning/20 text-warning-foreground"
                        }
                      >
                        {appData.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Expiry date
                    </div>
                    <div className="mt-1 font-mono">{appData.expiry_date}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Remaining time
                    </div>
                    <div className="mt-1 font-mono">{appData.remaining_time}</div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Register a device</CardTitle>
              <CardDescription>
                New devices start as <strong>pending</strong> until the owner
                approves them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="deviceName">Device name</Label>
                  <Input
                    id="deviceName"
                    placeholder="DESKTOP-ABC123"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deviceSecret">Device secret</Label>
                  <Input
                    id="deviceSecret"
                    placeholder="9f1c2e7a8b3d"
                    value={deviceSecret}
                    onChange={(e) => setDeviceSecret(e.target.value)}
                    maxLength={200}
                    required
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      "Register device"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Device access requests</CardTitle>
              <CardDescription>
                {devices.length} request{devices.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : devicesError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {devicesError}
                </div>
              ) : devices.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No device requests yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Device name</th>
                        <th className="px-3 py-2 font-medium">Secret</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((d) => (
                        <tr
                          key={d.id}
                          className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-3 py-2 font-medium">{d.deviceName}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                                {d.deviceSecret}
                              </code>
                              <CopyInline value={d.deviceSecret} />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              {canManage ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      actioningId === d.id ||
                                      d.status === "approved"
                                    }
                                    onClick={() => updateStatus(d, "approved")}
                                    className="gap-1 border-success/40 text-success hover:bg-success/10"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      actioningId === d.id ||
                                      d.status === "rejected"
                                    }
                                    onClick={() => updateStatus(d, "rejected")}
                                    className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="h-3.5 w-3.5" /> Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteTarget(d)}
                                    className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                                    aria-label="Delete device"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Owner only
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!isAuthed && (
                <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <Link to="/login" className="font-medium text-foreground underline">
                    Log in
                  </Link>{" "}
                  as the application owner to approve or reject device requests.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Public API reference</CardTitle>
              <CardDescription>
                Use these endpoints from any device or backend. No authentication required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* POST */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-primary/15 text-primary">POST</Badge>
                  <span className="text-sm font-medium">Register a device</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send a JSON body with <code className="rounded bg-muted px-1">deviceName</code>,{" "}
                  <code className="rounded bg-muted px-1">deviceSecret</code> and{" "}
                  <code className="rounded bg-muted px-1">status</code>. The server always
                  stores new devices as <strong>pending</strong> regardless of the value sent.
                </p>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Endpoint
                  </Label>
                  <CopyBlock value={postUrl} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Request body
                  </Label>
                  <CopyBlock value={postBody} language="json" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    cURL example
                  </Label>
                  <CopyBlock value={curlPost} language="bash" />
                </div>
              </div>

              {/* GET */}
              <div className="space-y-2 border-t border-border/60 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-success/15 text-success">GET</Badge>
                  <span className="text-sm font-medium">List device access requests</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Returns every device registered against this application with its current{" "}
                  <code className="rounded bg-muted px-1">status</code> (
                  <em>pending | approved | rejected</em>).
                </p>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Endpoint
                  </Label>
                  <CopyBlock value={getUrl} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    cURL example
                  </Label>
                  <CopyBlock value={curlGet} language="bash" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Example response
                  </Label>
                  <CopyBlock
                    language="json"
                    value={`{
  "devices": [
    {
      "id": "...",
      "applicationId": "${applicationId}",
      "deviceName": "DESKTOP-ABC123",
      "deviceSecret": "9f1c2e7a8b3d",
      "status": "pending",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete device request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong className="text-foreground">{deleteTarget?.deviceName}</strong> from this
              application. The device will need to register again to regain access. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
