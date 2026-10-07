import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getProfileByAuthUserId } from "@/services/identity";
import {
  Button,
  MetaRow,
  Rule,
  SectionNumber,
  StatusBadge,
} from "@/components/ui";
import { HomeClaimBox } from "@/components/home/HomeClaimBox";

interface HomePageProps {
  searchParams?: Promise<{
    public?: string;
    manifest?: string;
    claim?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { userId: authUserId } = await auth();
  const params = searchParams ? await searchParams : {};

  let profile = null;
  if (authUserId) {
    profile = await getProfileByAuthUserId(authUserId);

    // If logged in but hasn't claimed a handle yet, redirect directly to dashboard onboarding
    if (!profile) {
      const claimQuery = params?.claim ? `?claim=${encodeURIComponent(params.claim)}` : "";
      redirect(`/dashboard${claimQuery}`);
    }

    // If logged in with an existing profile and didn't explicitly request the public manifest view:
    // Seamlessly redirect directly to the Publishing Desk (workspace)
    if (params?.public !== "1" && params?.manifest !== "1") {
      redirect("/dashboard");
    }
  }

  return (
    <main className="mx-auto max-w-grid px-6 py-8 md:py-16">
      {/* Editorial Header / Top Navigation */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4">
        <div className="flex items-center gap-4">
          <SectionNumber number={1} label="System Manifest" />
          <span className="font-mono text-sm uppercase tracking-wider text-ink font-semibold">
            proof.so
          </span>
          <span className="hidden md:inline font-mono text-xs uppercase tracking-wider text-ink/60">
            Permanent Evidence Layer
          </span>
        </div>

        <nav className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider">
          <a
            href="#trust-posture"
            className="px-3 py-2 text-ink/80 hover:text-ink transition-colors hover:bg-warm-gray/20 rounded-sm"
          >
            Trust Posture
          </a>

          {profile ? (
            <>
              <Link
                href={`/@${profile.username}`}
                className="px-3 py-2 text-ink/80 hover:text-ink transition-colors hover:bg-warm-gray/20 rounded-sm font-semibold text-cobalt"
              >
                @{profile.username}
              </Link>
              <Link href="/dashboard">
                <Button variant="primary" size="sm" className="font-mono text-xs">
                  Publishing Desk &rarr;
                </Button>
              </Link>
              <div className="pl-2 border-l border-rule">
                <UserButton afterSignOutUrl="/" />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/u/elena"
                className="px-3 py-2 text-ink/80 hover:text-ink transition-colors hover:bg-warm-gray/20 rounded-sm"
              >
                Sample Profile
              </Link>
              <Link href="/dashboard">
                <Button variant="primary" size="sm" className="font-mono text-xs">
                  Publishing Desk &rarr;
                </Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <Rule variant="thin" />

      {/* Hero Section */}
      <section className="py-12 md:py-20" id="manifest">
        <p className="font-mono text-sm uppercase tracking-widest text-cobalt mb-3">
          Proof &bull; Editorial Utility
        </p>
        <h1 className="font-display text-4xl sm:text-6xl md:text-8xl leading-tight font-extrabold uppercase tracking-tight text-ink">
          Your work deserves evidence.
        </h1>
        <p className="mt-6 max-w-2xl font-body text-lg md:text-xl text-ink leading-relaxed">
          Proof turns certificates, achievements, documents, and project evidence into permanent,
          professional, shareable proof pages.
        </p>

        {/* Interactive Handle Claim & Navigation Box */}
        <div className="mt-8">
          <HomeClaimBox currentUsername={profile?.username} />
        </div>
      </section>

      <Rule variant="thick" />

      {/* Verification Trust Model Showcase */}
      <section className="py-12 md:py-16 scroll-mt-6" id="trust-posture">
        <div className="mb-8">
          <SectionNumber number={2} label="Trust Posture" />
          <h2 className="font-display text-2xl md:text-4xl font-bold uppercase mt-2 text-ink">
            Six Verification States
          </h2>
          <p className="font-body text-sm text-ink/80 max-w-xl mt-2 leading-relaxed">
            Proof is a presentation layer. Unverified user evidence is never labeled
            &ldquo;verified&rdquo;. Required editorial copy explains each state explicitly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 border border-rule-soft bg-paper rounded-sm">
            <StatusBadge status="SELF_REPORTED" showCopy />
          </div>
          <div className="p-6 border border-rule-soft bg-paper rounded-sm">
            <StatusBadge status="DOCUMENT_UPLOADED" showCopy />
          </div>
          <div className="p-6 border border-rule-soft bg-paper rounded-sm">
            <StatusBadge status="ISSUER_REFERENCED" showCopy />
          </div>
          <div className="p-6 border border-rule-soft bg-paper rounded-sm">
            <StatusBadge status="ISSUER_VERIFIED" showCopy />
          </div>
          <div className="p-6 border border-rule-soft bg-paper rounded-sm">
            <StatusBadge status="EXPIRED" showCopy />
          </div>
          <div className="p-6 border border-rule-soft bg-paper rounded-sm">
            <StatusBadge status="REVOKED" showCopy />
          </div>
        </div>
      </section>

      <Rule variant="thin" />

      {/* Metadata Specification Section */}
      <section className="py-12 md:py-16 scroll-mt-6" id="technical-metadata">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <SectionNumber number={3} label="Technical Metadata" />
            <h2 className="font-display text-2xl md:text-3xl font-bold uppercase mt-2 text-ink">
              Archival Document Hierarchy
            </h2>
          </div>
          <Link href="/u/elena" className="text-xs font-mono text-cobalt hover:underline uppercase">
            Browse Live Evidence Example &rarr;
          </Link>
        </div>

        <div className="border border-rule-soft p-6 bg-paper rounded-sm max-w-2xl">
          <dl>
            <MetaRow label="Canonical Route" value="/@akshay/aws-solutions-architect" />
            <MetaRow label="Format" value="PDF / 2.4 MB" helper="SHA-256 Verified" />
            <MetaRow label="Issued Date" value="06 OCT 2026" helper="UTC" />
            <MetaRow label="Verification Status" value="DOCUMENT_UPLOADED" />
            <MetaRow label="Storage Layout" value="r2://proof-assets/..." />
          </dl>
        </div>
      </section>

      <Rule variant="thin" />

      {/* Publishing Call-To-Action */}
      <section className="py-12 md:py-16 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 bg-paper border border-rule-soft p-8 rounded-sm my-8">
        <div>
          <h3 className="font-display text-xl sm:text-2xl font-bold uppercase text-ink">
            {profile ? `Publishing Desk Active: @${profile.username}` : "Ready to publish your evidence?"}
          </h3>
          <p className="font-body text-sm text-ink/70 mt-1">
            {profile
              ? "Open your publishing workspace to manage drafts, upload evidence documents, and organize public proofs."
              : "Claim your handle, attach verified documents, and share your archival page."}
          </p>
        </div>
        <Link href="/dashboard" className="shrink-0">
          <Button variant="primary" size="md">
            Open Publishing Desk &rarr;
          </Button>
        </Link>
      </section>

      <Rule variant="thin" />

      {/* Footer */}
      <footer className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-ink uppercase gap-4">
        <div>&copy; {new Date().getFullYear()} Proof. All rights reserved.</div>
        <div className="flex items-center gap-4 text-ink/60">
          <Link href="/healthz" className="hover:text-ink">
            System Health
          </Link>
          <span>&bull;</span>
          <Link href="/sitemap.xml" className="hover:text-ink">
            Sitemap
          </Link>
          <span>&bull;</span>
          <span>Swiss Editorial &times; Developer Tool</span>
        </div>
      </footer>
    </main>
  );
}
