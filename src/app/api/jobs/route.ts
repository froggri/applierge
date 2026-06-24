import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, SONNET } from "@/lib/anthropic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    include: { application: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();

  // If a URL is provided, extract job data via AI
  if (body.url && !body.title) {
    const profile = await prisma.profile.findUnique({ where: { userId } });

    const extractPrompt = `Du analysierst eine Stellenanzeige anhand ihrer URL und ggf. des Titels/Unternehmens.

URL: ${body.url}
${body.rawText ? `\nSeiteninhalt (aus Copy-Paste):\n${body.rawText}` : ""}

Da du keinen direkten Web-Zugriff hast, extrahiere aus der URL und dem verfügbaren Kontext was möglich ist.
Falls ein "rawText" des Stelleninserats mitgegeben wurde, nutze diesen für die vollständige Extraktion.

Kandidaten-Profil für Matching:
${profile ? `Gehalt: ${profile.salaryMin ? `${profile.salaryMin}–${profile.salaryMax} EUR` : "nicht angegeben"}, Präferenz: ${profile.workLocation || "flexibel"}, Branchen: ${profile.industryPrefs?.join(", ") || "keine Präferenz"}` : "Kein Profil vorhanden"}

Gib JSON zurück:
{
  "title": "Jobtitel",
  "company": "Unternehmen",
  "location": "Ort",
  "workMode": "ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE",
  "employmentType": "FW" | "OD",
  "salaryMin": <Zahl oder null>,
  "salaryMax": <Zahl oder null>,
  "salaryRangeNote": "<Gehaltsangabe aus Anzeige als Text oder null>",
  "description": "<Kurzbeschreibung der Stelle, max 300 Zeichen>",
  "source": "stepstone" | "linkedin" | "xing" | "company" | "manual",
  "matchScore": <0-100 basierend auf Kandidatenprofil>,
  "matchReason": "<1-2 Sätze warum gut/schlecht passend>"
}

Antworte NUR mit dem JSON-Objekt.`;

    const response = await anthropic.messages.create({
      model: SONNET,
      max_tokens: 1000,
      messages: [{ role: "user", content: extractPrompt }],
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
        title: (extracted.title as string) || "Unbekannte Stelle",
        company: (extracted.company as string) || "Unbekannt",
        location: (extracted.location as string) || null,
        workMode: (extracted.workMode as "ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE") || null,
        employmentType: (extracted.employmentType as "FW" | "OD") || "FW",
        salaryMin: (extracted.salaryMin as number) || null,
        salaryMax: (extracted.salaryMax as number) || null,
        salaryRangeNote: (extracted.salaryRangeNote as string) || null,
        description: (extracted.description as string) || "",
        url: body.url,
        source: (extracted.source as string) || "manual",
        matchScore: (extracted.matchScore as number) || null,
        matchReason: (extracted.matchReason as string) || null,
        status: "INTERESTING",
      },
    });

    return NextResponse.json(job);
  }

  // Manual entry
  const job = await prisma.job.create({
    data: {
      userId,
      title: body.title,
      company: body.company,
      location: body.location || null,
      workMode: body.workMode || null,
      employmentType: body.employmentType || "FW",
      description: body.description || "",
      url: body.url || "",
      source: "manual",
      status: body.status || "INTERESTING",
      redFlags: body.redFlags || null,
      salaryRangeNote: body.salaryRangeNote || null,
      referenceId: body.referenceId || null,
    },
  });

  return NextResponse.json(job);
}
