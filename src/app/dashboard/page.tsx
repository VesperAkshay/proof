import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { listProofsForUser } from "@/services/proof";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import { ClaimHandleForm } from "./ClaimHandleForm";

export const metadata = {
  title: "Publishing Desk — Proof",
  description: "Editorial workspace for organizing and publishing credentials and proof artifacts.",
  robots: {
    index: false,
    follow: false,
  },
};

interface DashboardPageProps {
  searchParams?: Promise<{ claim?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { userId: authUserId } = await auth();
  if (!authUserId) {
    redirect("/");
  }

  const profile = await getProfileByAuthUserId(authUserId);
  if (!profile) {
    const params = searchParams ? await searchParams : {};
    return (
      <main className="min-h-screen bg-bg text-fg px-6 py-12 md:py-24 flex flex-col items-center justify-center">
        <ClaimHandleForm initialUsername={params?.claim || ""} />
      </main>
    );
  }

  const proofs = await listProofsForUser(profile.id);

  let avatarUrl: string | null = null;
  if (profile.avatarAssetId) {
    avatarUrl = `/api/assets/${profile.avatarAssetId}/view`;
  }

  return (
    <DashboardClient
      user={{
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl,
        bio: profile.bio,
      }}
      initialProofs={proofs}
    />
  );
}
