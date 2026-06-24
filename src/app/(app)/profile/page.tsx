import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [profile, uploadedDocs, inconsistencies] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.uploadedDocument.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.profileInconsistency.findMany({
      where: { userId },
      orderBy: [{ resolved: "asc" }, { severity: "desc" }],
    }),
  ]);

  return (
    <ProfileClient
      profile={profile}
      uploadedDocs={uploadedDocs}
      inconsistencies={inconsistencies}
    />
  );
}
