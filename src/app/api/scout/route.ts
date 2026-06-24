import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, SONNET } from "@/lib/anthropic";

// Job-Scout: nimmt eine Liste von Stellenanzeigen (manuell eingefügt oder via URL-Batch)
// und analysiert sie gegen das Kandidatenprofil
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { urls, rawTexts } = await req.json() as {
    urls?: string[];
    rawTexts?: Array<{ url: string; text: string; source?: string }>;
  };

  const profile = await prisma.profile.findUnique({ where: { userId } });

  const profileSummary = profile ? `
Kandidaten-Profil:
- Gehaltsvorstellung: ${profile.salaryMin ? `${profile.salaryMin.toLocaleString("de-DE")} – ${profile.salaryMax?.toLocaleString("de-DE")} EUR` : "nicht angegeben"}
- Arbeitsmodell: ${profile.workLocation || "flexibel"}
- Branchenpräferenzen: ${profile.industryPrefs?.join(", ") || "keine spezifischen"}
- Unternehmensgröße: ${profile.companySizePrefs?.join(", ") || "keine spezifischen"}
- Werte: ${profile.valuesNotes || "nicht angegeben"}
- Sicherheitsbedürfnis: ${profile.securityNeed || "mittel"}
` : "Kein Profil vorhanden – bitte erst Profil anlegen.";

  const items = rawTexts || (urls || []).map((url) => ({ url, text: "", source: "manual" }));

  const results = [];

  for (const item of items.slice(0, 10)) { // max 10 auf einmal
    const prompt = `Analysiere diese Stellenanzeige und matche sie mit dem Kandidatenprofil.

URL: ${item.url}
${item.text ? `Anzeigentext:\n${item.text.slice(0, 3000)}` : ""}

${profileSummary}

Gib JSON zurück:
{
  "title": "...",
  "company": "...",
  "location": "...",
  "workMode": "ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE",
  "employmentType": "FW" | "OD",
  "salaryMin": <Zahl oder null>,
  "salaryMax": <Zahl oder null>,
  "salaryRangeNote": "...",
  "description": "<Kurzbeschreibung max 200 Zeichen>",
  "source": "${item.source || "manual"}",
  "matchScore": <0-100>,
  "matchReason": "<1-2 Sätze>"
}

Antworte NUR mit dem JSON-Objekt.`;

    try {
      const response = await anthropic.messages.create({
        model: SONNET,
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
      let extracted: Record<string, unknown> = {};
      try {
        extracted = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      } catch {
        extracted = { title: "Unbekannte Stelle", company: "Unbekannt", description: "" };
      }

      const job = await prisma.job.create({
        data: {
          userId,
          title: (extracted.title as string) || "Stelle",
          company: (extracted.company as string) || "Unbekannt",
          location: (extracted.location as string) || null,
          workMode: (extracted.workMode as "ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE") || null,
          employmentType: (extracted.employmentType as "FW" | "OD") || "FW",
          salaryMin: (extracted.salaryMin as number) || null,
          salaryMax: (extracted.salaryMax as number) || null,
          salaryRangeNote: (extracted.salaryRangeNote as string) || null,
          description: (extracted.description as string) || "",
          url: item.url,
          source: (extracted.source as string) || "manual",
          matchScore: (extracted.matchScore as number) || null,
          matchReason: (extracted.matchReason as string) || null,
          status: "INTERESTING",
        },
      });

      results.push(job);
    } catch (err) {
      console.error("Scout error for", item.url, err);
    }
  }

  return NextResponse.json({ added: results.length, jobs: results });
}
