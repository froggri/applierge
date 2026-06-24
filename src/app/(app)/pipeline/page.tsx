import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import PipelineClient from "./PipelineClient";

export default async function PipelinePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const jobs = await prisma.job.findMany({
    where: {
      userId,
      status: { in: ["INTERESTING", "TO_APPLY", "APPLYING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return <PipelineClient initialJobs={jobs} />;
}
