import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Briefcase, FileText, AlertTriangle, User } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [profile, jobsTotal, applicationsTotal, inconsistencies] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.job.count({ where: { userId } }),
    prisma.application.count({ where: { userId } }),
    prisma.profileInconsistency.count({ where: { userId, resolved: false } }),
  ]);

  const stats = [
    { label: "Jobs in Pipeline", value: jobsTotal, icon: Briefcase, href: "/pipeline" },
    { label: "Bewerbungen", value: applicationsTotal, icon: FileText, href: "/tracker" },
    { label: "Inkonsistenzen", value: inconsistencies, icon: AlertTriangle, href: "/profile#inconsistencies" },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Hallo{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-zinc-400 mt-1">Dein Bewerbungs-Cockpit</p>
      </div>

      {!profile?.interviewCompleted && (
        <div className="mb-8 bg-blue-900/30 border border-blue-700 rounded-xl p-5 flex items-start gap-4">
          <User className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-white font-medium">Profil noch nicht vollständig</p>
            <p className="text-zinc-400 text-sm mt-1">
              Importiere dein LinkedIn/Xing-Profil und führe das Onboarding-Interview durch,
              damit Applierge dir passende Jobs vorschlagen kann.
            </p>
            <Link
              href="/profile"
              className="inline-block mt-3 text-sm text-blue-400 hover:text-blue-300 font-medium"
            >
              Profil einrichten →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm">{label}</span>
              <Icon className="w-4 h-4 text-zinc-500" />
            </div>
            <span className="text-3xl font-bold text-white">{value}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/pipeline"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-blue-600 transition-colors group"
        >
          <h3 className="text-white font-medium mb-1 group-hover:text-blue-400 transition-colors">
            Job hinzufügen
          </h3>
          <p className="text-zinc-400 text-sm">
            Stepstone- oder LinkedIn-URL einfügen, KI extrahiert alles automatisch
          </p>
        </Link>
        <Link
          href="/tracker"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-blue-600 transition-colors group"
        >
          <h3 className="text-white font-medium mb-1 group-hover:text-blue-400 transition-colors">
            Bewerbungen tracken
          </h3>
          <p className="text-zinc-400 text-sm">
            Status, Rückmeldungen und Nachhak-Termine im Blick behalten
          </p>
        </Link>
      </div>
    </div>
  );
}
