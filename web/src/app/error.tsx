"use client";

import { Button } from "@/components/ui/Button";

/** Friendly fallback — never shows raw errors or stack traces. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-6xl" aria-hidden="true">🙈</p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Oopsie, something went wrong</h1>
        <p className="mt-3 font-serif text-2xl">It&apos;s not you ♡ Please try again in a moment.</p>
        <Button className="mt-8" onClick={reset} icon="retry">
          Try again
        </Button>
      </div>
    </main>
  );
}
