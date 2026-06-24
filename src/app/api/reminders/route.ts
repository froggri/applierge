import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  // Follow-up reminders (nachhaken)
  const followUps = await prisma.application.findMany({
    where: {
      userId,
      followUpAt: { lte: in7Days },
      status: { in: ["SENT", "ACKNOWLEDGED"] },
    },
    include: { job: true },
    orderBy: { followUpAt: "asc" },
  });

  // Open applications older than 21 days without response
  const staleApplications = await prisma.application.findMany({
    where: {
      userId,
      status: "SENT",
      appliedAt: { lte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
      responseAt: null,
    },
    include: { job: true },
    orderBy: { appliedAt: "asc" },
  });

  const reminders = [
    ...followUps.map((a) => ({
      type: "follow_up",
      urgency: a.followUpAt && new Date(a.followUpAt) <= today ? "overdue" : "upcoming",
      applicationId: a.id,
      jobTitle: a.job.title,
      company: a.job.company,
      date: a.followUpAt,
      message: `Nachhaken bei ${a.job.company}`,
    })),
    ...staleApplications.map((a) => ({
      type: "no_response",
      urgency: "info",
      applicationId: a.id,
      jobTitle: a.job.title,
      company: a.job.company,
      date: a.appliedAt,
      message: `Keine Rückmeldung von ${a.job.company} seit ${Math.floor((Date.now() - new Date(a.appliedAt!).getTime()) / (1000 * 60 * 60 * 24))} Tagen`,
    })),
  ];

  return NextResponse.json({ reminders });
}
