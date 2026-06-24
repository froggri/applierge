import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import DocumentDetailClient from "./DocumentDetailClient";

export default async function DocumentDetailPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const doc = await prisma.document.findFirst({
    where: { id: docId, userId },
    include: { application: { include: { job: true } } },
  });

  if (!doc) notFound();

  return <DocumentDetailClient doc={doc} />;
}
