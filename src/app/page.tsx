import {
  Button,
  MetaRow,
  Rule,
  SectionNumber,
  StatusBadge,
} from "@/components/ui";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-grid px-6 py-12 md:py-24">
      {/* Editorial Header / Top Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2">
        <SectionNumber number={1} label="System Manifest" />
        <span className="font-mono text-xs uppercase tracking-wider text-ink">proof.so</span>
        <span className="font-mono text-xs uppercase tracking-wider text-ink/70">
          Permanent Evidence Layer
        </span>
      </div>

      <Rule variant="thin" />

      {/* Hero Section */}
      <section className="py-16 md:py-28">
        <p className="font-mono text-sm uppercase tracking-widest text-cobalt mb-4">
          Proof &bull; Editorial Utility
        </p>
        <h1 className="font-display text-4xl sm:text-6xl md:text-8xl leading-tight font-extrabold uppercase tracking-tight text-ink">
          Your work deserves evidence.
        </h1>
        <p className="mt-8 max-w-2xl font-body text-lg md:text-xl text-ink leading-relaxed">
          Proof turns certificates, achievements, documents, and project evidence into permanent,
          professional, shareable proof pages.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button variant="primary" size="md">
            Claim Your Handle
          </Button>
          <Button variant="secondary" size="md">
            Explore Documentation
          </Button>
        </div>
      </section>

      <Rule variant="thick" />

      {/* Verification Trust Model Showcase */}
      <section className="py-12 md:py-16">
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
      <section className="py-12 md:py-16">
        <div className="mb-6">
          <SectionNumber number={3} label="Technical Metadata" />
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase mt-2 text-ink">
            Archival Document Hierarchy
          </h2>
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

      {/* Footer */}
      <footer className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-ink uppercase">
        <div>&copy; {new Date().getFullYear()} Proof. All rights reserved.</div>
        <div className="mt-4 sm:mt-0">Swiss Editorial &times; Developer Tool</div>
      </footer>
    </main>
  );
}
