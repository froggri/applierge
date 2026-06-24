"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink, ArrowLeft, Loader2, FileText, Send, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, Application, Document, Profile } from "@prisma/client";

type JobWithApp = Job & {
  application: (Application & { documents: Document[] }) | null;
};

const STATUS_OPTIONS = [
  "INTERESTING", "TO_APPLY", "APPLYING", "APPLIED",
  "PHONE_CALL", "INTERVIEW", "OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN",
];

const STATUS_LABEL: Record<string, string> = {
  INTERESTING: "Interessant",
  TO_APPLY: "Noch zu bewerben",
  APPLYING: "In Bearbeitung",
  APPLIED: "Abgeschickt",
  PHONE_CALL: "Telefonat",
  INTERVIEW: "Interview",
  OFFER: "Angebot erhalten",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  WITHDRAWN: "Zurückgezogen",
};

const WORK_MODE: Record<string, string> = {
  ONSITE: "Vor Ort", HYBRID: "Hybrid", REMOTE: "Remote", FLEXIBLE: "Flexibel",
};

type Props = { job: JobWithApp; profile: Profile | null };

export default function JobDetailClient({ job, profile }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(job.status);
  const [saving, setSaving] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyData, setApplyData] = useState({
    salaryStated: profile?.salaryNote || "",
    notes: "",
    followUpAt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatingCV, setGeneratingCV] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [showLetterInterview, setShowLetterInterview] = useState(false);
  const [letterAnswers, setLetterAnswers] = useState<Record<string, string>>({});
  const [letterResult, setLetterResult] = useState("");

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    setStatus(newStatus as Job["status"]);
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    router.refresh();
  };

  const submitApplication = async () => {
    setSubmitting(true);
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, ...applyData }),
    });
    setSubmitting(false);
    setShowApplyForm(false);
    router.refresh();
  };

  const generateCV = async () => {
    setGeneratingCV(true);
    await fetch("/api/documents/generate-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    });
    setGeneratingCV(false);
    router.refresh();
  };

  const generateLetter = async () => {
    setGeneratingLetter(true);
    const res = await fetch("/api/documents/generate-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, answers: letterAnswers }),
    });
    const data = await res.json();
    setLetterResult(data.content || "");
    setGeneratingLetter(false);
    setShowLetterInterview(false);
    router.refresh();
  };

  const docs = job.application?.documents || [];
  const cvDoc = docs.find((d) => d.type === "CV_TAILORED");
  const letterDoc = docs.find((d) => d.type === "COVER_LETTER");

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/pipeline" className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Pipeline
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{job.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-zinc-300">{job.company}</span>
              {job.location && <span className="text-zinc-500">• {job.location}</span>}
              {job.workMode && <span className="text-zinc-500">• {WORK_MODE[job.workMode]}</span>}
              {job.employmentType && <span className="text-zinc-500">• {job.employmentType}</span>}
              {job.url && (
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
            <select
              value={status}
              onChange={(e) => updateStatus(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          {/* Match Score */}
          {job.matchScore != null && (
            <div className={cn(
              "border rounded-xl p-4",
              job.matchScore >= 70 ? "bg-green-900/20 border-green-800" :
              job.matchScore >= 40 ? "bg-amber-900/20 border-amber-800" :
              "bg-red-900/20 border-red-800"
            )}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl font-bold text-white">{Math.round(job.matchScore)}%</span>
                <span className="text-zinc-400 text-sm">KI-Match</span>
              </div>
              {job.matchReason && <p className="text-zinc-300 text-sm">{job.matchReason}</p>}
            </div>
          )}

          {/* Description */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-medium mb-3">Stellenbeschreibung</h2>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
              {job.description || "Keine Beschreibung vorhanden."}
            </p>
          </div>

          {/* Red Flags */}
          {job.redFlags && (
            <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4">
              <h3 className="text-amber-400 font-medium text-sm mb-1">Haken / Anmerkungen</h3>
              <p className="text-amber-300 text-sm">{job.redFlags}</p>
            </div>
          )}

          {/* Documents */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-medium">Bewerbungsunterlagen</h2>

            <div className="grid grid-cols-2 gap-3">
              {/* CV */}
              <div className={cn(
                "border rounded-lg p-4",
                cvDoc ? "border-green-800 bg-green-900/10" : "border-zinc-700"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span className="text-white text-sm font-medium">CV (auf Stelle zugeschnitten)</span>
                </div>
                {cvDoc ? (
                  <div className="space-y-2">
                    <p className="text-green-400 text-xs">✓ Generiert</p>
                    <Link href={`/documents/${cvDoc.id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                      Ansehen & bearbeiten →
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={generateCV}
                    disabled={generatingCV}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-60"
                  >
                    {generatingCV ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generiere…</> : "Mit Opus generieren"}
                  </button>
                )}
              </div>

              {/* Cover Letter */}
              <div className={cn(
                "border rounded-lg p-4",
                letterDoc ? "border-green-800 bg-green-900/10" : "border-zinc-700"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span className="text-white text-sm font-medium">Anschreiben</span>
                </div>
                {letterDoc ? (
                  <div className="space-y-2">
                    <p className="text-green-400 text-xs">✓ Generiert</p>
                    <Link href={`/documents/${letterDoc.id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                      Ansehen & bearbeiten →
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLetterInterview(!showLetterInterview)}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {showLetterInterview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Interview starten
                  </button>
                )}
              </div>
            </div>

            {showLetterInterview && !letterDoc && (
              <div className="bg-zinc-800 rounded-lg p-4 space-y-4">
                <h3 className="text-white text-sm font-medium">Anschreiben-Interview</h3>
                {[
                  { id: "motivation", q: "Warum bewirbst du dich bei diesem Unternehmen und für diese Stelle?" },
                  { id: "fit", q: "Welche deiner Erfahrungen/Stärken passen am besten zu dieser Stelle?" },
                  { id: "added_value", q: "Welchen konkreten Mehrwert kannst du dem Unternehmen bringen?" },
                  { id: "personal", q: "Gibt es eine persönliche Geschichte oder Motivation die relevant ist?" },
                ].map(({ id, q }) => (
                  <div key={id}>
                    <label className="text-zinc-300 text-xs font-medium block mb-1">{q}</label>
                    <textarea
                      value={letterAnswers[id] || ""}
                      onChange={(e) => setLetterAnswers((p) => ({ ...p, [id]: e.target.value }))}
                      rows={2}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                ))}
                <button
                  onClick={generateLetter}
                  disabled={generatingLetter}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {generatingLetter ? <><Loader2 className="w-4 h-4 animate-spin" /> Sonnet schreibt…</> : "Anschreiben mit Sonnet generieren"}
                </button>
              </div>
            )}

            {letterResult && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="text-white text-sm font-medium mb-2">Generiertes Anschreiben</h3>
                <pre className="text-zinc-300 text-xs whitespace-pre-wrap font-sans">{letterResult}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-medium text-sm">Details</h3>
            {[
              { label: "Quelle", value: job.source },
              { label: "Referenz-Nr.", value: job.referenceId },
              { label: "Gehaltsrange", value: job.salaryRangeNote || (job.salaryMin ? `${job.salaryMin.toLocaleString("de-DE")} – ${job.salaryMax?.toLocaleString("de-DE") || "?"} EUR` : null) },
              { label: "Online seit", value: job.postedAt ? new Date(job.postedAt).toLocaleDateString("de-DE") : null },
            ].filter((r) => r.value).map(({ label, value }) => (
              <div key={label}>
                <span className="text-zinc-500 text-xs">{label}</span>
                <p className="text-zinc-300 text-sm">{value}</p>
              </div>
            ))}
          </div>

          {/* Apply action */}
          {!job.application && (status === "APPLYING" || status === "TO_APPLY") && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <button
                onClick={() => setShowApplyForm(!showApplyForm)}
                className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                <Send className="w-4 h-4" />
                Als abgeschickt markieren
              </button>

              {showApplyForm && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Gehaltsvorstellung angegeben</label>
                    <input
                      value={applyData.salaryStated}
                      onChange={(e) => setApplyData((p) => ({ ...p, salaryStated: e.target.value }))}
                      placeholder="z.B. 105.000 EUR"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Nachhaken am</label>
                    <input
                      type="date"
                      value={applyData.followUpAt}
                      onChange={(e) => setApplyData((p) => ({ ...p, followUpAt: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Notizen</label>
                    <textarea
                      value={applyData.notes}
                      onChange={(e) => setApplyData((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <button
                    onClick={submitApplication}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Bestätigen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Application status if exists */}
          {job.application && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="text-white font-medium text-sm">Bewerbungs-Status</h3>
              <p className="text-zinc-300 text-sm">{job.application.status}</p>
              {job.application.salaryStated && (
                <p className="text-zinc-400 text-xs">Gehalt: {job.application.salaryStated}</p>
              )}
              <Link href="/tracker" className="text-blue-400 hover:text-blue-300 text-xs">
                Im Tracker ansehen →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
