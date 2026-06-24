import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, OPUS } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { jobId } = await req.json();

  const [job, profile, uploadedDocs] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.uploadedDocument.findMany({ where: { userId, type: "CV" } }),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const baseCV = uploadedDocs[0]?.parsedJson || profile?.cvParsedJson || {};

  const prompt = `Du bist ein professioneller Bewerbungsberater. Erstelle einen optimierten, auf diese Stellenanzeige zugeschnittenen Lebenslauf im Markdown-Format.

STELLENANZEIGE:
Titel: ${job.title}
Unternehmen: ${job.company}
Beschreibung: ${job.description}
${job.workMode ? `Arbeitsmodell: ${job.workMode}` : ""}
${job.employmentType ? `Anstellungsart: ${job.employmentType}` : ""}

BASIS-LEBENSLAUF DES KANDIDATEN:
${JSON.stringify(baseCV, null, 2)}

PROFIL-PRÄFERENZEN:
${profile ? `
- Gehaltsvorstellung: ${profile.salaryMin ? `${profile.salaryMin.toLocaleString("de-DE")} – ${profile.salaryMax?.toLocaleString("de-DE")} EUR` : "nicht angegeben"}
- Präferierter Arbeitsort: ${profile.workLocation || "flexibel"}
` : "Kein Profil vorhanden"}

ANWEISUNGEN:
1. Passe die Berufserfahrung so an, dass die relevantesten Aspekte für DIESE Stelle hervorgehoben werden
2. Formuliere die Summary/Profil-Sektion auf die Stelle zugeschnitten
3. Ordne Skills nach Relevanz für die Stelle
4. Behalte alle Fakten bei – erfinde nichts
5. Format: professionelles Deutsch, klare Struktur
6. Nutze Markdown: # für Name, ## für Sektionen, ### für Stationen

Erstelle den vollständigen, einschreibbereiten Lebenslauf:`;

  const response = await anthropic.messages.create({
    model: OPUS,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";

  // Ensure application exists
  const application = await prisma.application.upsert({
    where: { jobId },
    update: {},
    create: {
      userId,
      jobId,
      status: "DRAFT",
    },
  });

  // Update job status
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "APPLYING" },
  });

  // Delete old tailored CV for this job if exists
  await prisma.document.deleteMany({
    where: { applicationId: application.id, type: "CV_TAILORED" },
  });

  const doc = await prisma.document.create({
    data: {
      userId,
      applicationId: application.id,
      type: "CV_TAILORED",
      title: `CV – ${job.company} – ${job.title}`,
      content,
      generatedBy: "opus",
    },
  });

  return NextResponse.json({ document: doc, content });
}
