"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Loader2, ExternalLink, ArrowRight, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@prisma/client";

const STATUS_COLUMNS = [
  { status: "INTERESTING", label: "Interessant", color: "border-zinc-600" },
  { status: "TO_APPLY", label: "Noch zu bewerben", color: "border-blue-600" },
  { status: "APPLYING", label: "In Bearbeitung", color: "border-amber-600" },
];

const WORK_MODE_LABEL: Record<string, string> = {
  ONSITE: "Vor Ort",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
  FLEXIBLE: "Flexibel",
};

type Props = { initialJobs: Job[] };

export default function PipelineClient({ initialJobs }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const [adding, setAdding] = useState(false);

  const addJob = async () => {
    if (!url) return;
    setAdding(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, rawText }),
    });
    if (res.ok) {
      const job = await res.json();
      setJobs((prev) => [job, ...prev]);
      setUrl("");
      setRawText("");
      setShowAdd(false);
    }
    setAdding(false);
  };

  const moveJob = async (jobId: string, status: string) => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: status as Job["status"] } : j)));
  };

  const deleteJob = async (jobId: string) => {
    await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-zinc-400 mt-1">Jobs entdecken und zur Bewerbung vorbereiten</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Job hinzufügen
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-white font-medium">Job via URL hinzufügen</h3>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.stepstone.de/... oder LinkedIn-URL"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={() => setShowRawText(!showRawText)}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs transition-colors"
          >
            {showRawText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Anzeigentext einfügen (für bessere KI-Extraktion)
          </button>

          {showRawText && (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
              placeholder="Kopiere den kompletten Anzeigentext hier rein…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={addJob}
              disabled={!url || adding}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> KI analysiert…</> : "Hinzufügen"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="py-2 px-4 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {STATUS_COLUMNS.map(({ status, label, color }) => {
          const colJobs = jobs.filter((j) => j.status === status);
          return (
            <div key={status} className={cn("bg-zinc-900 border-t-2 rounded-xl p-4", color)}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-medium text-sm">{label}</h2>
                <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
                  {colJobs.length}
                </span>
              </div>

              <div className="space-y-3">
                {colJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 hover:border-zinc-500 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-white text-sm font-medium hover:text-blue-400 transition-colors leading-tight"
                      >
                        {job.title}
                      </Link>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {job.url && (
                          <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => deleteJob(job.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-zinc-400 text-xs mb-2">{job.company}</p>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {job.location && (
                        <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded">
                          {job.location}
                        </span>
                      )}
                      {job.workMode && (
                        <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded">
                          {WORK_MODE_LABEL[job.workMode] || job.workMode}
                        </span>
                      )}
                      {job.employmentType && (
                        <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded">
                          {job.employmentType}
                        </span>
                      )}
                      {job.matchScore != null && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded font-medium",
                          job.matchScore >= 70 ? "bg-green-900/40 text-green-400" :
                          job.matchScore >= 40 ? "bg-amber-900/40 text-amber-400" :
                          "bg-red-900/40 text-red-400"
                        )}>
                          {Math.round(job.matchScore)}%
                        </span>
                      )}
                    </div>

                    {job.salaryRangeNote && (
                      <p className="text-zinc-500 text-xs mb-2">{job.salaryRangeNote}</p>
                    )}

                    {/* Move buttons */}
                    <div className="flex gap-1.5">
                      {status === "INTERESTING" && (
                        <button
                          onClick={() => moveJob(job.id, "TO_APPLY")}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" /> Zu bewerben
                        </button>
                      )}
                      {status === "TO_APPLY" && (
                        <Link
                          href={`/jobs/${job.id}`}
                          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" /> Bewerbung starten
                        </Link>
                      )}
                      {status === "APPLYING" && (
                        <button
                          onClick={() => router.push(`/jobs/${job.id}`)}
                          className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" /> Dokumente &amp; Absenden
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {colJobs.length === 0 && (
                  <p className="text-zinc-600 text-xs text-center py-4">Keine Jobs</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
