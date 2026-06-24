import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { anthropic, SONNET } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, type } = await req.json() as { url: string; type: "linkedin" | "xing" };

  const prompt = `Du erhältst die URL eines ${type === "linkedin" ? "LinkedIn" : "Xing"}-Profils: ${url}

Da du keinen direkten Web-Zugriff hast, gib mir einen strukturierten Prompt zurück, den der Nutzer verwenden kann, um sein eigenes Profil zu exportieren und hier einzufügen. Erkläre kurz:
1. Wie man das Profil als PDF exportiert (${type === "linkedin" ? "LinkedIn: Profil → Mehr → Als PDF speichern" : "Xing: Profil → PDF-Export"})
2. Dass sie das PDF dann hier hochladen sollen

Antworte auf Deutsch, freundlich und kurz (max 3 Sätze).`;

  const message = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const hint = message.content[0].type === "text" ? message.content[0].text : "";

  await prisma.profile.upsert({
    where: { userId: session.user.id },
    update: type === "linkedin" ? { linkedinUrl: url } : { xingUrl: url },
    create: {
      userId: session.user.id,
      ...(type === "linkedin" ? { linkedinUrl: url } : { xingUrl: url }),
    },
  });

  return NextResponse.json({ hint });
}
