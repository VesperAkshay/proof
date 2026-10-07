import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { listProofsForUser } from "@/services/proof";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardClient } from "./DashboardClient";

export const metadata = {
  title: "Publishing Desk — Proof",
  description: "Editorial workspace for organizing and publishing credentials and proof artifacts.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardPage() {
  const { userId: authUserId } = await auth();
  if (!authUserId) {
    redirect("/");
  }

  const profile = await getProfileByAuthUserId(authUserId);
  if (!profile) {
    // User needs to claim a handle first
    return (
      <main className="min-h-screen bg-paper text-ink p-8 flex flex-col items-center justify-center">
        <h1 className="font-display text-3xl font-bold mb-4 uppercase">Claim Your Handle</h1>
        <p className="font-body text-base text-ink/70 mb-6 max-w-md text-center">
          You need to claim a unique handle before publishing credentials or evidence on Proof.
        </p>
        <Link
          href="/"
          className="font-mono text-sm uppercase px-4 py-2 border border-ink bg-cobalt text-paper hover:bg-cobalt/90 transition-colors"
        >
          Claim Handle on Homepage &rarr;
        </Link>
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
