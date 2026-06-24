import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import TrackerClient from "./TrackerClient";

export default async function TrackerPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const applications = await prisma.application.findMany({
    where: { userId },
    include: { job: true },
    orderBy: { appliedAt: "desc" },
  });

  // Also get jobs with APPLIED+ status that might not have applications yet
  const appliedJobs = await prisma.job.findMany({
    where: {
      userId,
      status: { in: ["APPLIED", "PHONE_CALL", "INTERVIEW", "OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN"] },
    },
    include: { application: true },
    orderBy: { updatedAt: "desc" },
  });

  return <TrackerClient applications={applications} appliedJobs={appliedJobs} />;
}
