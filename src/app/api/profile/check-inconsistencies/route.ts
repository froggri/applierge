import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, SONNET } from "@/lib/anthropic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [profile, uploadedDocs] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.uploadedDocument.findMany({ where: { userId } }),
  ]);

  if (!profile && uploadedDocs.length < 2) {
    return NextResponse.json({ message: "Nicht genug Quellen für einen Vergleich" });
  }

  const sources: Record<string, unknown> = {};
  if (profile?.cvParsedJson) sources["cv_pdf"] = profile.cvParsedJson;
  if (profile?.linkedinUrl) sources["linkedin"] = { url: profile.linkedinUrl, note: "URL gespeichert, kein direkter Zugriff" };
  uploadedDocs.forEach((doc) => {
    sources[`${doc.type.toLowerCase()}_${doc.id.slice(-6)}`] = doc.parsedJson || doc.extractedText;
  });

  const prompt = `Du analysierst berufliche Dokumente eines Bewerbers auf Inkonsistenzen.

Quellen:
${JSON.stringify(sources, null, 2)}

Suche nach Inkonsistenzen wie:
- Unterschiedliche Berufsbezeichnungen für dieselbe Stelle
- Abweichende Beschäftigungszeiträume (Monat/Jahr)
- Widersprüchliche Angaben zu Unternehmen
- Lücken die nur in einer Quelle erscheinen
- Unterschiedliche Angaben zu Bildungsabschlüssen

Gib das Ergebnis als JSON-Array zurück:
[
  {
    "severity": "HIGH" | "MEDIUM" | "LOW",
    "source1": "Quellname",
    "source2": "Quellname",
    "field": "job_title" | "employment_dates" | "company" | "education" | "gap" | "other",
    "description": "Konkrete Beschreibung der Inkonsistenz auf Deutsch"
  }
]

Wenn keine Inkonsistenzen gefunden wurden, gib ein leeres Array [] zurück.
Antworte NUR mit dem JSON-Array.`;

  const response = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
  let findings: Array<{ severity: string; source1: string; source2: string; field: string; description: string }> = [];
  try {
    findings = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    findings = [];
  }

  // Clear old unresolved, insert new ones
  await prisma.profileInconsistency.deleteMany({ where: { userId, resolved: false } });

  if (findings.length > 0) {
    await prisma.profileInconsistency.createMany({
      data: findings.map((f) => ({
        userId,
        severity: (f.severity as "LOW" | "MEDIUM" | "HIGH") || "LOW",
        source1: f.source1,
        source2: f.source2,
        field: f.field,
        description: f.description,
      })),
    });
  }

  return NextResponse.json({ count: findings.length, findings });
}
