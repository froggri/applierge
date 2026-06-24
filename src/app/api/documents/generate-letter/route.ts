import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, SONNET } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { jobId, answers } = await req.json() as {
    jobId: string;
    answers: Record<string, string>;
  };

  const [job, profile] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.profile.findUnique({ where: { userId } }),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  const prompt = `Du bist ein erfahrener Karriereberater und Texter. Erstelle ein überzeugendes, authentisches Anschreiben auf Basis des Interviews mit dem Kandidaten.

STELLENANZEIGE:
Titel: ${job.title}
Unternehmen: ${job.company}
Ort: ${job.location || "nicht angegeben"}
Beschreibung: ${job.description}

KANDIDATEN-PROFIL:
Name: ${profile?.fullName || "[Name des Kandidaten]"}
Ort: ${profile?.location || "[Ort]"}
${profile?.headline ? `Aktuelle Position: ${profile.headline}` : ""}

INTERVIEW-ANTWORTEN DES KANDIDATEN:
Motivation: ${answers.motivation || "(keine Angabe)"}
Passung zur Stelle: ${answers.fit || "(keine Angabe)"}
Mehrwert für das Unternehmen: ${answers.added_value || "(keine Angabe)"}
Persönliche Motivation/Geschichte: ${answers.personal || "(keine Angabe)"}

ANWEISUNGEN:
- Schreibe ein professionelles, aber persönliches Anschreiben auf Deutsch
- Nutze die Interview-Antworten als Basis – bleib bei den Fakten
- Vermeide Floskeln ("Hiermit bewerbe ich mich…")
- Starte mit einem starken, aufmerksamkeitserregenden Einstieg
- Zeige echtes Interesse am Unternehmen
- Länge: ca. 250-350 Wörter
- Format: Briefformat mit Datum, Betreff, Anrede, Text, Grußformel

Datum: ${today}
Absender: ${profile?.fullName || "[Name]"}, ${profile?.location || "[Ort]"}
Empfänger: ${job.company}

Schreibe jetzt das vollständige Anschreiben:`;

  const response = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";

  const application = await prisma.application.upsert({
    where: { jobId },
    update: {},
    create: { userId, jobId, status: "DRAFT" },
  });

  await prisma.document.deleteMany({
    where: { applicationId: application.id, type: "COVER_LETTER" },
  });

  const doc = await prisma.document.create({
    data: {
      userId,
      applicationId: application.id,
      type: "COVER_LETTER",
      title: `Anschreiben – ${job.company}`,
      content,
      generatedBy: "sonnet",
    },
  });

  return NextResponse.json({ document: doc, content });
}
