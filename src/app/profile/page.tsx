import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { toProfileData } from "@/lib/profile";
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { profile } = await getCurrentUser();
  const [full, cvs] = await Promise.all([
    db.profile.findUniqueOrThrow({ where: { id: profile.id }, include: { workAuth: true } }),
    db.cV.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, isPrimary: true, createdAt: true },
    }),
  ]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="page-title">CV and profile</h1>
        <p className="mt-1 text-muted">This is what match scores and cover letters are based on.</p>
      </header>
      <ProfileEditor
        profileId={profile.id}
        initial={toProfileData(full)}
        cvs={cvs.map((cv) => ({ ...cv, createdAt: cv.createdAt.toISOString() }))}
      />
    </div>
  );
}
