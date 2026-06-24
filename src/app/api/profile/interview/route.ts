import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, SONNET } from "@/lib/anthropic";

const INTERVIEW_QUESTIONS = [
  {
    id: "salary",
    question: "Was ist deine Gehaltsvorstellung? (Jahresbrutto in EUR, gerne als Bandbreite)",
    field: "salary",
  },
  {
    id: "workmode",
    question: "Wie möchtest du arbeiten – vor Ort, hybrid oder vollständig remote?",
    field: "workLocation",
  },
  {
    id: "employment_type",
    question: "Öffentlicher Dienst, freie Wirtschaft oder beides? Was bevorzugst du und warum?",
    field: "employmentType",
  },
  {
    id: "security",
    question: "Wie wichtig ist dir Jobsicherheit / Planbarkeit auf einer Skala von 1-5?",
    field: "securityNeed",
  },
  {
    id: "company_size",
    question: "Bevorzugst du eher Start-ups, Mittelstand oder Konzerne?",
    field: "companySize",
  },
  {
    id: "industry",
    question: "In welchen Branchen möchtest du gerne arbeiten? Was schließt du aus?",
    field: "industry",
  },
  {
    id: "values",
    question: "Was ist dir in einem Job neben Gehalt am wichtigsten? (z.B. Flexibilität, Sinnhaftigkeit, Team, Aufstiegschancen)",
    field: "values",
  },
];

export async function GET() {
  return NextResponse.json({ questions: INTERVIEW_QUESTIONS });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { answers } = await req.json() as { answers: Record<string, string> };

  const profile = await prisma.profile.findUnique({ where: { userId } });

  // Use AI to extract structured data from free-text answers
  const extractionPrompt = `Analysiere folgende Interview-Antworten eines Jobsuchenden und extrahiere strukturierte Daten.

Antworten:
${INTERVIEW_QUESTIONS.map((q) => `${q.question}\nAntwort: ${answers[q.id] || "(keine Antwort)"}`).join("\n\n")}

Profil-Kontext (falls vorhanden):
${profile ? `Name: ${profile.fullName || "unbekannt"}, Ort: ${profile.location || "unbekannt"}` : "Kein Profil vorhanden"}

Extrahiere folgendes JSON:
{
  "salaryMin": <Zahl in EUR oder null>,
  "salaryMax": <Zahl in EUR oder null>,
  "salaryNote": "<Freitext zur Gehaltsvorstellung>",
  "workLocation": "ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE",
  "securityNeed": "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH",
  "companySizePrefs": ["startup", "mittelstand", "konzern"] (Teilmenge),
  "industryPrefs": ["<Branche1>", ...],
  "valuesNotes": "<Freitext zu Werten und Präferenzen>",
  "employmentTypeNote": "<FW / ÖD / beides + Begründung>"
}

Antworte NUR mit dem JSON-Objekt.`;

  const extraction = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 1000,
    messages: [{ role: "user", content: extractionPrompt }],
  });

  const raw = extraction.content[0].type === "text" ? extraction.content[0].text : "{}";
  let extracted: Record<string, unknown> = {};
  try {
    extracted = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    extracted = {};
  }

  await prisma.profile.upsert({
    where: { userId },
    update: {
      salaryMin: (extracted.salaryMin as number) || null,
      salaryMax: (extracted.salaryMax as number) || null,
      salaryNote: (extracted.salaryNote as string) || null,
      workLocation: (extracted.workLocation as "ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE") || null,
      securityNeed: (extracted.securityNeed as "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH") || null,
      companySizePrefs: (extracted.companySizePrefs as string[]) || [],
      industryPrefs: (extracted.industryPrefs as string[]) || [],
      valuesNotes: (extracted.valuesNotes as string) || null,
      interviewCompleted: true,
      interviewData: answers,
    },
    create: {
      userId,
      salaryMin: (extracted.salaryMin as number) || null,
      salaryMax: (extracted.salaryMax as number) || null,
      salaryNote: (extracted.salaryNote as string) || null,
      workLocation: (extracted.workLocation as "ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE") || null,
      securityNeed: (extracted.securityNeed as "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH") || null,
      companySizePrefs: (extracted.companySizePrefs as string[]) || [],
      industryPrefs: (extracted.industryPrefs as string[]) || [],
      valuesNotes: (extracted.valuesNotes as string) || null,
      interviewCompleted: true,
      interviewData: answers,
    },
  });

  return NextResponse.json({ success: true, extracted });
}
