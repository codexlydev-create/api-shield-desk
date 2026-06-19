import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, RefreshCw, ShieldCheck, Clock, X } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sessionStore } from "@/lib/storage";
import {
  devicesApi,
  locationsApi,
  type Device,
  type DeviceStatus,
  type LocationEntry,
} from "@/lib/api";

export const Route = createFileRoute("/application/$applicationId/device/$deviceId")({
  head: ({ params }) => ({
    meta: [
      { title: `Device ${params.deviceId} — Details` },
      {
        name: "description",
        content: "Full device information and location history.",
      },
    ],
  }),
  component: DeviceDetailsPage,
});

function StatusBadge({ status }: { status: DeviceStatus }) {
  if (status === "approved") {
    return (
      <Badge className="border-0 bg-success/15 text-success">
        <ShieldCheck className="mr-1 h-3 w-3" /> Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="border-0 bg-destructive/15 text-destructive">
        <X className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-warning/20 text-warning-foreground">
      <Clock className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}

function DeviceDetailsPage() {
  const { applicationId, deviceId } = Route.useParams();
  const navigate = useNavigate();
  const isAuthed = typeof window !== "undefined" && !!sessionStore.get();

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const loadDevice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = isAuthed
        ? await devicesApi.listOwned(applicationId).catch(async (e) => {
            if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) {
              return devicesApi.listPublic(applicationId);
            }
            throw e;
          })
        : await devicesApi.listPublic(applicationId);
      const found = res.devices.find((d) => d.id === deviceId) || null;
      if (!found) setError("Device not found");
      setDevice(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load device");
    } finally {
      setLoading(false);
    }
  }, [applicationId, deviceId, isAuthed]);

  const loadLocations = useCallback(async () => {
    setLocationsError(null);
    setLocationsLoading(true);
    try {
      const res = isAuthed
        ? await locationsApi.listOwned(applicationId).catch(async (e) => {
            if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) {
              return locationsApi.listPublic(applicationId);
            }
            throw e;
          })
        : await locationsApi.listPublic(applicationId);
      setLocations(res.locations);
    } catch (e) {
      setLocationsError(e instanceof Error ? e.message : "Failed to load locations");
    } finally {
      setLocationsLoading(false);
    }
  }, [applicationId, isAuthed]);

  useEffect(() => {
    loadDevice();
    loadLocations();
  }, [loadDevice, loadLocations]);

  // Filter locations to just this device by secret.
  const deviceLocations = useMemo(() => {
    if (!device) return [] as LocationEntry[];
    return locations.filter((l) => l.deviceSecret === device.deviceSecret);
  }, [locations, device]);

  const platform =
    device?.platform ||
    (device?.windowsInfo &&
      (((device.windowsInfo as Record<string, unknown>).product_name as string) ||
        ((device.windowsInfo as Record<string, unknown>).system as string))) ||
    "—";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/application/$applicationId", params: { applicationId } })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to application
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadDevice();
              loadLocations();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Device details
                {device && <StatusBadge status={device.status} />}
              </CardTitle>
              <CardDescription>
                Application{" "}
                <Link
                  to="/application/$applicationId"
                  params={{ applicationId }}
                  className="font-mono text-primary hover:underline"
                >
                  {applicationId}
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              ) : error ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : device ? (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Device name" value={device.deviceName} />
                  <Field label="Device secret" value={device.deviceSecret} mono />
                  <Field label="Platform" value={platform} />
                  <Field label="IP address" value={device.ip || "—"} mono />
                  <Field
                    label="Registered"
                    value={
                      device.formattedRegistrationTime ||
                      new Date(device.createdAt).toLocaleString()
                    }
                  />
                  <Field
                    label="Last updated"
                    value={new Date(device.updatedAt).toLocaleString()}
                  />
                  {device.windowsInfo && (
                    <div className="sm:col-span-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Windows / system info
                      </div>
                      <pre className="mt-1 overflow-x-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
{JSON.stringify(device.windowsInfo, null, 2)}
                      </pre>
                    </div>
                  )}
                </dl>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Location history
              </CardTitle>
              <CardDescription>
                {deviceLocations.length} record{deviceLocations.length === 1 ? "" : "s"} — every
                ping from this device is preserved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {locationsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : locationsError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {locationsError}
                </div>
              ) : deviceLocations.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No location records yet for this device.
                </div>
              ) : (
                <div className="max-h-[600px] overflow-auto rounded-md border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">Location</th>
                        <th className="px-3 py-2 font-medium">Place</th>
                        <th className="px-3 py-2 font-medium">IP</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceLocations.map((l) => {
                        const lat = l.location?.latitude;
                        const lng = l.location?.longitude;
                        const place = [l.location?.city, l.location?.region, l.location?.country]
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <tr
                            key={l.id}
                            className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-3 py-2 font-mono text-xs">
                              {l.formattedDateTime ||
                                (l.timestamp
                                  ? new Date(l.timestamp).toLocaleString()
                                  : new Date(l.createdAt).toLocaleString())}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {l.location?.error ? (
                                <span className="text-destructive">{l.location.error}</span>
                              ) : typeof lat === "number" && typeof lng === "number" ? (
                                <a
                                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {lat.toFixed(4)}, {lng.toFixed(4)}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {place || "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{l.ip || "—"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {l.location?.source || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-xs break-all" : "text-sm"}`}>{value}</div>
    </div>
  );
}
