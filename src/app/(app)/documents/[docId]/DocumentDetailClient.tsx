"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Edit3, Save, X, Copy, Check } from "lucide-react";
import type { Document, Application, Job } from "@prisma/client";

type DocWithApp = Document & {
  application: (Application & { job: Job }) | null;
};

const TYPE_LABEL: Record<string, string> = {
  CV_BASE: "Basis-CV",
  CV_TAILORED: "CV (stellenspezifisch)",
  COVER_LETTER: "Anschreiben",
};

export default function DocumentDetailClient({ doc }: { doc: DocWithApp }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(doc.content || "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/documents" className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Alle Dokumente
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">{doc.title}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
              <span>{TYPE_LABEL[doc.type] || doc.type}</span>
              {doc.generatedBy && <><span>·</span><span>via {doc.generatedBy}</span></>}
              {doc.application?.job && (
                <><span>·</span>
                <Link href={`/jobs/${doc.application.job.id}`} className="hover:text-white transition-colors">
                  {doc.application.job.company}
                </Link></>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /> Kopiert</> : <><Copy className="w-3.5 h-3.5" /> Kopieren</>}
            </button>

            {editing ? (
              <>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? "Speichert…" : "Speichern"}
                </button>
                <button
                  onClick={() => { setEditing(false); setContent(doc.content || ""); }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Abbrechen
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Bearbeiten
              </button>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-[600px] bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 text-sm text-white font-mono focus:outline-none focus:border-blue-500 resize-y"
        />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-8 py-6 prose prose-invert prose-sm max-w-none
          prose-headings:text-white prose-h1:text-xl prose-h2:text-base prose-h2:border-b prose-h2:border-zinc-700 prose-h2:pb-1
          prose-p:text-zinc-300 prose-li:text-zinc-300 prose-strong:text-white">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
