import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  const notice = params.error === "no_space" ? "This account isn't part of a memory space yet." : null;

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Our Memories</h1>
          <p className="mt-3 font-serif text-xl italic text-muted">A private place for the two of us.</p>
        </div>
        <LoginForm next={next} notice={notice} />
      </div>
    </main>
  );
}
