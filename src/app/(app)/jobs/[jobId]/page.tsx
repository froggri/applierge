import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import JobDetailClient from "./JobDetailClient";

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    include: { application: { include: { documents: true } } },
  });

  if (!job) notFound();

  const profile = await prisma.profile.findUnique({ where: { userId } });

  return <JobDetailClient job={job} profile={profile} />;
}
