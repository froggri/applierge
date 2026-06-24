import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { FileText } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  CV_BASE: "Basis-CV",
  CV_TAILORED: "CV (zugeschnitten)",
  COVER_LETTER: "Anschreiben",
};

export default async function DocumentsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const documents = await prisma.document.findMany({
    where: { userId },
    include: { application: { include: { job: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dokumente</h1>
        <p className="text-zinc-400 mt-1">Alle generierten CVs und Anschreiben</p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">Noch keine Dokumente generiert</p>
          <p className="text-zinc-500 text-sm mt-1">
            Öffne einen Job in der Pipeline und generiere CV oder Anschreiben
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 hover:border-zinc-600 transition-colors"
            >
              <FileText className="w-5 h-5 text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{doc.title}</p>
                <p className="text-zinc-400 text-xs mt-0.5">
                  {TYPE_LABEL[doc.type] || doc.type}
                  {doc.application?.job && ` · ${doc.application.job.company}`}
                  {doc.generatedBy && ` · via ${doc.generatedBy}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-zinc-500 text-xs">
                  {new Date(doc.createdAt).toLocaleDateString("de-DE")}
                </p>
                {doc.driveFileUrl && (
                  <span className="text-green-400 text-xs">Drive ✓</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
