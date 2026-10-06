export default function HomePage() {
  return (
    <main className="mx-auto max-w-grid px-6 py-12 md:py-24">
      {/* Editorial Header / Top Meta */}
      <div className="flex items-center justify-between border-b border-rule pb-4 text-xs font-mono uppercase tracking-wider text-ink">
        <span>01 / System Manifest</span>
        <span>proof.so</span>
        <span>Permanent Evidence Layer</span>
      </div>

      {/* Hero Section */}
      <section className="py-16 md:py-28 border-b border-rule">
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
      </section>

      {/* Editorial Index Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-rule border-b border-rule">
        <div className="p-8">
          <span className="font-mono text-xs text-cobalt uppercase">01 / Presentation</span>
          <h2 className="font-display text-2xl font-bold uppercase mt-3 mb-2">Canonical Pages</h2>
          <p className="font-body text-sm text-ink leading-relaxed">
            Every proof is published to a permanent, canonical URL at proof.so/@username/slug.
          </p>
        </div>

        <div className="p-8">
          <span className="font-mono text-xs text-cobalt uppercase">02 / Trust Posture</span>
          <h2 className="font-display text-2xl font-bold uppercase mt-3 mb-2">Clear Evidence</h2>
          <p className="font-body text-sm text-ink leading-relaxed">
            Proof separates user-uploaded evidence from issuer-verified credentials with unyielding
            editorial clarity.
          </p>
        </div>

        <div className="p-8">
          <span className="font-mono text-xs text-cobalt uppercase">03 / Privacy-First</span>
          <h2 className="font-display text-2xl font-bold uppercase mt-3 mb-2">Durable Storage</h2>
          <p className="font-body text-sm text-ink leading-relaxed">
            Files land in quarantine, undergo automated security audits, and are safely published to
            private object storage.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-ink uppercase">
        <div>&copy; {new Date().getFullYear()} Proof. All rights reserved.</div>
        <div className="mt-4 sm:mt-0">Swiss Editorial &times; Developer Tool</div>
      </footer>
    </main>
  );
}
