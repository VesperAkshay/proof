import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Record Not Found / Proof",
  description: "The requested profile or proof does not exist or is not public.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col justify-between p-6 sm:p-12 md:p-16 max-w-grid mx-auto font-body selection:bg-cobalt selection:text-paper">
      {/* Top Bar */}
      <header className="flex justify-between items-center border-b border-rule pb-4">
        <Link
          href="/"
          className="font-display font-bold text-xl tracking-tight text-ink hover:text-cobalt transition-colors focus-visible:outline-2 focus-visible:outline-focus"
        >
          PROOF
        </Link>
        <span className="font-mono text-xs uppercase tracking-mono text-vermilion">
          404 / NOT FOUND
        </span>
      </header>

      {/* Middle Content */}
      <section className="my-auto py-16 sm:py-24 max-w-xl">
        <div className="font-mono text-xs uppercase tracking-widest text-cobalt mb-3">
          ERROR 404
        </div>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight leading-tight text-ink mb-6">
          Record Not Found.
        </h1>
        <p className="font-body text-base sm:text-lg text-ink/80 leading-relaxed mb-8">
          The profile or proof you requested does not exist, has been removed, or is not public.
        </p>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-6 font-mono text-xs uppercase tracking-wider font-semibold bg-ink text-paper rounded-sm hover:bg-cobalt transition-colors focus-visible:outline-2 focus-visible:outline-focus"
          >
            &larr; Return to Proof
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs uppercase tracking-mono text-ink/50">
        <span>Proof Presentation Layer</span>
        <span>Archive Record Index</span>
      </footer>
    </main>
  );
}
