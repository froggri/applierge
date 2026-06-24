import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, SONNET } from "@/lib/anthropic";
import { put } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import type { Base64PDFSource } from "@anthropic-ai/sdk/resources/messages.js";

const DOC_TYPE_PROMPT: Record<string, string> = {
  cv: "einen Lebenslauf (CV)",
  cover_letter: "ein Anschreiben",
  reference: "ein Arbeitszeugnis oder eine Referenz",
  certificate: "ein Zertifikat oder einen Abschluss",
  other: "ein berufliches Dokument",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const docType = (formData.get("type") as string) || "other";
  const isCv = docType === "cv";

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const blob = await put(`applierge/${session.user.id}/${Date.now()}-${file.name}`, file, {
    access: "private",
  });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const extraction = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            } as Base64PDFSource,
          },
          {
            type: "text",
            text: `Analysiere dieses Dokument. Es handelt sich um ${DOC_TYPE_PROMPT[docType] || "ein Dokument"}.

Extrahiere alle relevanten Informationen und gib sie als JSON zurück mit folgender Struktur:
{
  "fullName": "...",
  "headline": "aktuelle Position / Berufsbezeichnung",
  "summary": "Zusammenfassung / Profil",
  "location": "Wohnort",
  "experiences": [{"title": "...", "company": "...", "from": "MM/YYYY", "to": "MM/YYYY oder heute", "description": "..."}],
  "education": [{"degree": "...", "institution": "...", "from": "...", "to": "..."}],
  "skills": ["..."],
  "languages": [{"language": "...", "level": "..."}],
  "certificates": ["..."],
  "documentType": "${docType}",
  "rawNotes": "Sonstige wichtige Informationen"
}

Felder die nicht vorhanden sind bitte weglassen. Antworte NUR mit dem JSON-Objekt, kein weiterer Text.`,
          },
        ],
      },
    ],
  });

  const rawText = extraction.content[0].type === "text" ? extraction.content[0].text : "{}";
  let parsedJson: Prisma.InputJsonValue = {};
  try {
    parsedJson = JSON.parse(rawText.replace(/```json\n?|\n?```/g, "").trim()) as Prisma.InputJsonValue;
  } catch {
    parsedJson = { rawNotes: rawText };
  }

  if (isCv) {
    const parsed = parsedJson as Record<string, unknown>;
    await prisma.profile.upsert({
      where: { userId: session.user.id },
      update: {
        cvPdfUrl: blob.url,
        cvParsedJson: parsedJson,
        fullName: (parsed.fullName as string) || undefined,
        headline: (parsed.headline as string) || undefined,
        summary: (parsed.summary as string) || undefined,
        location: (parsed.location as string) || undefined,
      },
      create: {
        userId: session.user.id,
        cvPdfUrl: blob.url,
        cvParsedJson: parsedJson,
        fullName: (parsed.fullName as string) || undefined,
        headline: (parsed.headline as string) || undefined,
        summary: (parsed.summary as string) || undefined,
        location: (parsed.location as string) || undefined,
      },
    });
  }

  const uploaded = await prisma.uploadedDocument.create({
    data: {
      userId: session.user.id,
      type: docType.toUpperCase() as "CV" | "COVER_LETTER" | "REFERENCE" | "CERTIFICATE" | "OTHER",
      title: file.name.replace(/\.pdf$/i, ""),
      fileUrl: blob.url,
      extractedText: rawText,
      parsedJson,
      analyzedAt: new Date(),
    },
  });

  return NextResponse.json({ document: uploaded, parsedJson });
}
