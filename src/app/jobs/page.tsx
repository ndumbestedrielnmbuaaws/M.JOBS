import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import JobSearch from "@/components/JobSearch";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { profile } = await getCurrentUser();
  const firstCountry = await db.workAuthorization.findFirst({
    where: { profileId: profile.id },
    select: { countryCode: true },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="page-title">Find jobs</h1>
        <p className="mt-1 text-muted">
          Search listings from LinkedIn, Indeed and other sites, then score the ones worth a look.
        </p>
      </header>
      <JobSearch
        defaults={{
          query: profile.headline ?? "",
          location: "",
          country: firstCountry?.countryCode ?? "GB",
        }}
      />
    </div>
  );
}
