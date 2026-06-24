"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Application, Job } from "@prisma/client";

type AppWithJob = Application & { job: Job };
type JobWithApp = Job & { application: Application | null };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Entwurf", color: "text-zinc-400" },
  SENT: { label: "Abgeschickt", color: "text-blue-400" },
  ACKNOWLEDGED: { label: "Eingangsbestätigung", color: "text-blue-300" },
  PHONE_CALL_SCHEDULED: { label: "Telefonat geplant", color: "text-amber-400" },
  INTERVIEW_SCHEDULED: { label: "Interview geplant", color: "text-amber-300" },
  OFFER_RECEIVED: { label: "Angebot erhalten", color: "text-green-400" },
  ACCEPTED: { label: "Angenommen", color: "text-green-300" },
  REJECTED: { label: "Abgelehnt", color: "text-red-400" },
  WITHDRAWN: { label: "Zurückgezogen", color: "text-zinc-500" },
};

const JOB_STATUS_LABEL: Record<string, string> = {
  APPLIED: "Abgeschickt",
  PHONE_CALL: "Telefonat",
  INTERVIEW: "Interview",
  OFFER: "Angebot",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  WITHDRAWN: "Zurückgezogen",
};

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "–";
  return new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Props = {
  applications: AppWithJob[];
  appliedJobs: JobWithApp[];
};

export default function TrackerClient({ applications, appliedJobs }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});

  const saveEdit = async (appId: string) => {
    await fetch(`/api/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    setEditingId(null);
    setEditData({});
    router.refresh();
  };

  const startEdit = (app: AppWithJob) => {
    setEditingId(app.id);
    setEditData({
      status: app.status,
      salaryStated: app.salaryStated || "",
      responseAt: app.responseAt ? new Date(app.responseAt).toISOString().split("T")[0] : "",
      phoneCallAt: app.phoneCallAt ? new Date(app.phoneCallAt).toISOString().split("T")[0] : "",
      interviewAt: app.interviewAt ? new Date(app.interviewAt).toISOString().split("T")[0] : "",
      followUpAt: app.followUpAt ? new Date(app.followUpAt).toISOString().split("T")[0] : "",
      notes: app.notes || "",
    });
  };

  const allRows = applications;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tracker</h1>
        <p className="text-zinc-400 mt-1">Alle abgeschickten Bewerbungen auf einen Blick</p>
      </div>

      {allRows.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-400">Noch keine Bewerbungen</p>
          <Link href="/pipeline" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
            Zur Pipeline →
          </Link>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Arbeitgeber / Stelle</th>
                  <th className="text-left px-4 py-3">Art</th>
                  <th className="text-left px-4 py-3">Beworben</th>
                  <th className="text-left px-4 py-3">Tage</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Gehalt angegeben</th>
                  <th className="text-left px-4 py-3">Rückmeldung</th>
                  <th className="text-left px-4 py-3">Telefonat</th>
                  <th className="text-left px-4 py-3">Gespräch</th>
                  <th className="text-left px-4 py-3">Nachhaken</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {allRows.map((app) => {
                  const isEditing = editingId === app.id;
                  const days = daysSince(app.appliedAt);
                  const st = STATUS_LABEL[app.status] || { label: app.status, color: "text-zinc-400" };

                  return (
                    <tr key={app.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/jobs/${app.job.id}`} className="text-white hover:text-blue-400 transition-colors font-medium block">
                          {app.job.company}
                        </Link>
                        <span className="text-zinc-400 text-xs">{app.job.title}</span>
                        {app.job.url && (
                          <a href={app.job.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-zinc-600 hover:text-zinc-400">
                            <ExternalLink className="w-3 h-3 inline" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{app.job.employmentType || "–"}</td>
                      <td className="px-4 py-3 text-zinc-300">{formatDate(app.appliedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "font-medium",
                          days != null && days > 14 ? "text-amber-400" : "text-zinc-300"
                        )}>
                          {days != null ? days : "–"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editData.status}
                            onChange={(e) => setEditData((d) => ({ ...d, status: e.target.value }))}
                            className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-white"
                          >
                            {Object.entries(STATUS_LABEL).map(([v, { label }]) => (
                              <option key={v} value={v}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={cn("text-xs font-medium", st.color)}>{st.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {isEditing ? (
                          <input
                            value={editData.salaryStated}
                            onChange={(e) => setEditData((d) => ({ ...d, salaryStated: e.target.value }))}
                            placeholder="z.B. 105.000 EUR"
                            className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-white w-32"
                          />
                        ) : (
                          app.salaryStated || "–"
                        )}
                      </td>
                      {(["responseAt", "phoneCallAt", "interviewAt", "followUpAt"] as const).map((field) => (
                        <td key={field} className="px-4 py-3 text-zinc-300 text-xs">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editData[field] || ""}
                              onChange={(e) => setEditData((d) => ({ ...d, [field]: e.target.value }))}
                              className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-white"
                            />
                          ) : (
                            formatDate(app[field])
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => saveEdit(app.id)} className="text-xs text-green-400 hover:text-green-300">Speichern</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-zinc-500 hover:text-white">Abbrechen</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(app)} className="text-xs text-zinc-500 hover:text-white transition-colors">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {appliedJobs.filter((j) => !j.application).length > 0 && (
        <div className="mt-6">
          <h2 className="text-zinc-400 text-sm font-medium mb-3">Jobs ohne Bewerbungs-Eintrag</h2>
          <div className="space-y-2">
            {appliedJobs.filter((j) => !j.application).map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 hover:border-zinc-600 transition-colors"
              >
                <span className="text-white text-sm font-medium">{job.company}</span>
                <span className="text-zinc-400 text-xs">{job.title}</span>
                <span className="ml-auto text-xs text-zinc-500">{JOB_STATUS_LABEL[job.status] || job.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
