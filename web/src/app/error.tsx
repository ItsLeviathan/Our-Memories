"use client";

import { Button } from "@/components/ui/Button";

/** Friendly fallback — never shows raw errors or stack traces. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Something went wrong.</h1>
        <p className="mt-3 text-muted">It&apos;s not you. Please try again in a moment.</p>
        <Button className="mt-8" onClick={reset} icon="retry">
          Try again
        </Button>
      </div>
    </main>
  );
}
