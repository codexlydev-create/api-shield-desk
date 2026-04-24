import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { botsStore, type Bot } from "@/lib/storage";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  description: z.string().trim().max(300).optional().default(""),
  expiryDate: z.date({ required_error: "Pick an expiry date" }),
  expiryTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)")
    .default("23:59"),
});

export function BotFormDialog({
  open,
  onOpenChange,
  ownerId,
  bot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownerId: string;
  bot?: Bot | null;
}) {
  const editing = !!bot;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("23:59");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(bot?.name ?? "");
      setDescription(bot?.description ?? "");
      if (bot?.expiryDate) {
        const d = new Date(bot.expiryDate);
        setDate(d);
        setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      } else {
        setDate(undefined);
        setTime("23:59");
      }
      setErrors({});
    }
  }, [open, bot]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, description, expiryDate: date, expiryTime: time });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (map[i.path[0] as string] = i.message));
      setErrors(map);
      return;
    }
    // Combine date + time into a single Date
    const [h, m] = parsed.data.expiryTime.split(":").map(Number);
    const combined = new Date(parsed.data.expiryDate);
    combined.setHours(h, m, 0, 0);

    if (editing && bot) {
      botsStore.update(bot.id, {
        name: parsed.data.name,
        description: parsed.data.description,
        expiryDate: combined.toISOString(),
      });
      toast.success("APPLICATION updated");
    } else {
      const created = botsStore.create({
        ownerId,
        name: parsed.data.name,
        description: parsed.data.description,
        expiryDate: combined.toISOString(),
      });
      toast.success("APPLICATION created", { description: `ID: ${created.id}` });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit APPLICATION" : "Create new APPLICATION validity"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update APPLICATION details below." : "Set a name, description and expiry date. We'll generate a unique ID and API endpoint."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bname">APPLICATION Name</Label>
            <Input id="bname" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Telegram application" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bdesc">Description</Label>
            <Textarea id="bdesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this APPLICATION do?" />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label>Expiry date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.expiryDate && <p className="text-xs text-destructive">{errors.expiryDate}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="btime">Expiry time</Label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="btime"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="pl-8"
                  step={60}
                />
              </div>
              {errors.expiryTime && <p className="text-xs text-destructive">{errors.expiryTime}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button type="submit" className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95">
                {editing ? "Save changes" : "Create APPLICATION"}
              </Button>
            </motion.div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
