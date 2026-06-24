"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Reminder = {
  type: string;
  urgency: string;
  applicationId: string;
  jobTitle: string;
  company: string;
  date: string | null;
  message: string;
};

export default function RemindersWidget() {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((d) => setReminders(d.reminders || []));
  }, []);

  if (reminders.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-amber-800/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-amber-400" />
        <h3 className="text-white font-medium text-sm">Erinnerungen</h3>
        <span className="bg-amber-900/50 text-amber-400 text-xs px-2 py-0.5 rounded-full ml-auto">
          {reminders.length}
        </span>
      </div>
      <div className="space-y-2">
        {reminders.slice(0, 5).map((r, i) => (
          <Link
            key={i}
            href="/tracker"
            className={cn(
              "flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-zinc-800 transition-colors",
            )}
          >
            <AlertCircle className={cn(
              "w-4 h-4 mt-0.5 shrink-0",
              r.urgency === "overdue" ? "text-red-400" : r.urgency === "upcoming" ? "text-amber-400" : "text-zinc-400"
            )} />
            <div>
              <p className="text-zinc-300 text-xs">{r.message}</p>
              {r.date && (
                <p className="text-zinc-500 text-xs mt-0.5">
                  {new Date(r.date).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
