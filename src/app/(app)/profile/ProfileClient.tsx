"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, AlertTriangle, CheckCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile, UploadedDocument, ProfileInconsistency } from "@prisma/client";

const DOC_TYPES = [
  { value: "cv", label: "Lebenslauf (CV)" },
  { value: "cover_letter", label: "Anschreiben" },
  { value: "reference", label: "Arbeitszeugnis / Referenz" },
  { value: "certificate", label: "Zertifikat / Abschluss" },
  { value: "other", label: "Sonstiges Dokument" },
];

const SEVERITY_COLOR = {
  HIGH: "text-red-400 bg-red-900/30 border-red-800",
  MEDIUM: "text-amber-400 bg-amber-900/30 border-amber-800",
  LOW: "text-zinc-400 bg-zinc-800 border-zinc-700",
};

const INTERVIEW_QUESTIONS = [
  { id: "salary", question: "Was ist deine Gehaltsvorstellung? (Jahresbrutto, gerne als Bandbreite)" },
  { id: "workmode", question: "Wie möchtest du arbeiten – vor Ort, hybrid oder vollständig remote?" },
  { id: "employment_type", question: "Öffentlicher Dienst, freie Wirtschaft oder beides? Was bevorzugst du und warum?" },
  { id: "security", question: "Wie wichtig ist dir Jobsicherheit auf einer Skala von 1-5?" },
  { id: "company_size", question: "Bevorzugst du Start-ups, Mittelstand oder Konzerne?" },
  { id: "industry", question: "In welchen Branchen möchtest du arbeiten? Was schließt du aus?" },
  { id: "values", question: "Was ist dir neben Gehalt am wichtigsten?" },
];

type Props = {
  profile: Profile | null;
  uploadedDocs: UploadedDocument[];
  inconsistencies: ProfileInconsistency[];
};

export default function ProfileClient({ profile, uploadedDocs, inconsistencies }: Props) {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedinUrl || "");
  const [xingUrl, setXingUrl] = useState(profile?.xingUrl || "");
  const [urlHint, setUrlHint] = useState("");
  const [uploadDocType, setUploadDocType] = useState("cv");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState("");
  const [checkingInconsistencies, setCheckingInconsistencies] = useState(false);
  const [showInterview, setShowInterview] = useState(!profile?.interviewCompleted);
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});
  const [savingInterview, setSavingInterview] = useState(false);
  const [interviewDone, setInterviewDone] = useState(profile?.interviewCompleted || false);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setUploadResult("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", uploadDocType);
      const res = await fetch("/api/profile/upload", { method: "POST", body: fd });
      if (res.ok) {
        setUploadResult(`✓ ${file.name} erfolgreich analysiert`);
        router.refresh();
      } else {
        setUploadResult("Fehler beim Upload");
      }
    } finally {
      setUploading(false);
    }
  }, [uploadDocType, router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const saveUrl = async (type: "linkedin" | "xing") => {
    const url = type === "linkedin" ? linkedinUrl : xingUrl;
    if (!url) return;
    const res = await fetch("/api/profile/import-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, type }),
    });
    const data = await res.json();
    setUrlHint(data.hint || "");
    router.refresh();
  };

  const runInconsistencyCheck = async () => {
    setCheckingInconsistencies(true);
    await fetch("/api/profile/check-inconsistencies", { method: "POST" });
    setCheckingInconsistencies(false);
    router.refresh();
  };

  const saveInterview = async () => {
    setSavingInterview(true);
    await fetch("/api/profile/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: interviewAnswers }),
    });
    setSavingInterview(false);
    setInterviewDone(true);
    setShowInterview(false);
    router.refresh();
  };

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Mein Profil</h1>
        <p className="text-zinc-400 mt-1">Importiere deine Unterlagen und führ das Interview durch</p>
      </div>

      {/* Profile URLs */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Profil-URLs</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "LinkedIn", value: linkedinUrl, setter: setLinkedinUrl, type: "linkedin" as const },
            { label: "Xing", value: xingUrl, setter: setXingUrl, type: "xing" as const },
          ].map(({ label, value, setter, type }) => (
            <div key={type}>
              <label className="text-zinc-400 text-sm mb-1 block">{label} URL</label>
              <div className="flex gap-2">
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={`https://www.${type}.com/in/…`}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => saveUrl(type)}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
                >
                  Speichern
                </button>
              </div>
            </div>
          ))}
        </div>
        {urlHint && (
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-sm text-blue-300">
            {urlHint}
          </div>
        )}
      </section>

      {/* Document Upload */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Dokumente hochladen</h2>
        <p className="text-zinc-400 text-sm">
          Lade CV, Zeugnisse, Anschreiben oder Referenzen hoch – KI analysiert sie automatisch.
        </p>

        <div>
          <label className="text-zinc-400 text-sm mb-1 block">Dokumenttyp</label>
          <select
            value={uploadDocType}
            onChange={(e) => setUploadDocType(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-blue-500"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            isDragActive ? "border-blue-500 bg-blue-900/10" : "border-zinc-700 hover:border-zinc-500"
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Wird analysiert…</span>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">PDF hierher ziehen oder klicken</p>
            </>
          )}
        </div>

        {uploadResult && (
          <p className={cn("text-sm", uploadResult.startsWith("✓") ? "text-green-400" : "text-red-400")}>
            {uploadResult}
          </p>
        )}

        {uploadedDocs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-zinc-400 text-sm font-medium">Hochgeladene Dokumente</h3>
            {uploadedDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-white text-sm flex-1">{doc.title}</span>
                <span className="text-zinc-500 text-xs">{doc.type}</span>
              </div>
            ))}
          </div>
        )}

        {uploadedDocs.length >= 1 && (
          <button
            onClick={runInconsistencyCheck}
            disabled={checkingInconsistencies}
            className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-60"
          >
            {checkingInconsistencies ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Prüfe Inkonsistenzen…</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Inkonsistenz-Check durchführen</>
            )}
          </button>
        )}
      </section>

      {/* Inconsistencies */}
      {inconsistencies.length > 0 && (
        <section id="inconsistencies" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Inkonsistenzen ({inconsistencies.filter((i) => !i.resolved).length} offen)
          </h2>
          {inconsistencies.map((inc) => (
            <div
              key={inc.id}
              className={cn("border rounded-lg p-3 text-sm", SEVERITY_COLOR[inc.severity as keyof typeof SEVERITY_COLOR] || SEVERITY_COLOR.LOW)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium uppercase text-xs">{inc.severity}</span>
                <span className="text-zinc-500">•</span>
                <span>{inc.source1} vs. {inc.source2}</span>
                {inc.resolved && <span className="ml-auto text-green-400 text-xs">✓ geklärt</span>}
              </div>
              <p>{inc.description}</p>
            </div>
          ))}
        </section>
      )}

      {/* Interview */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <button
          onClick={() => setShowInterview(!showInterview)}
          className="w-full flex items-center justify-between"
        >
          <div className="text-left">
            <h2 className="text-white font-semibold flex items-center gap-2">
              Onboarding-Interview
              {interviewDone && <CheckCircle className="w-4 h-4 text-green-400" />}
            </h2>
            <p className="text-zinc-400 text-sm mt-0.5">
              {interviewDone ? "Abgeschlossen – klicken um Antworten zu aktualisieren" : "7 Fragen zu Gehalt, Remote, Werten und mehr"}
            </p>
          </div>
          {showInterview ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {showInterview && (
          <div className="mt-5 space-y-5">
            {INTERVIEW_QUESTIONS.map((q, i) => (
              <div key={q.id}>
                <label className="text-zinc-300 text-sm font-medium block mb-1.5">
                  {i + 1}. {q.question}
                </label>
                <textarea
                  value={interviewAnswers[q.id] || ""}
                  onChange={(e) => setInterviewAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Deine Antwort…"
                />
              </div>
            ))}
            <button
              onClick={saveInterview}
              disabled={savingInterview}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-5 rounded-lg transition-colors disabled:opacity-60"
            >
              {savingInterview ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gespeichert…</> : "Interview abschließen"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
