import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Nothing to see here.</h1>
        <p className="mt-4 font-serif text-xl italic text-muted">This page doesn&apos;t exist.</p>
        <Link href="/" className="mt-8 inline-block text-fg underline underline-offset-4">
          Go home
        </Link>
      </div>
    </main>
  );
}
