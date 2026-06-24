import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;

  const body = await req.json();

  await prisma.document.updateMany({
    where: { id: docId, userId: session.user.id },
    data: { content: body.content, driveFileUrl: body.driveFileUrl },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;

  await prisma.document.deleteMany({ where: { id: docId, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
