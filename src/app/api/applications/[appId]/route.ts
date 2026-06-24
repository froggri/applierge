import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { appId } = await params;

  const body = await req.json();

  const dateFields = ["appliedAt", "responseAt", "phoneCallAt", "interviewAt", "followUpAt"];
  const data: Record<string, unknown> = { ...body };
  for (const f of dateFields) {
    if (body[f]) data[f] = new Date(body[f]);
  }

  const app = await prisma.application.updateMany({
    where: { id: appId, userId: session.user.id },
    data,
  });

  return NextResponse.json(app);
}
