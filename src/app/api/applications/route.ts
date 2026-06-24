import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const applications = await prisma.application.findMany({
    where: { userId: session.user.id },
    include: { job: true, documents: true },
    orderBy: { appliedAt: "desc" },
  });

  return NextResponse.json(applications);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Move job to APPLIED status
  await prisma.job.update({
    where: { id: body.jobId },
    data: { status: "APPLIED" },
  });

  const application = await prisma.application.upsert({
    where: { jobId: body.jobId },
    update: {
      status: body.status || "SENT",
      salaryStated: body.salaryStated || null,
      appliedAt: body.appliedAt ? new Date(body.appliedAt) : new Date(),
      notes: body.notes || null,
      followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
    },
    create: {
      userId: session.user.id,
      jobId: body.jobId,
      status: body.status || "SENT",
      salaryStated: body.salaryStated || null,
      appliedAt: body.appliedAt ? new Date(body.appliedAt) : new Date(),
      notes: body.notes || null,
      followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
    },
  });

  return NextResponse.json(application);
}
