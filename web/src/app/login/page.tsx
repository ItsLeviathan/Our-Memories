import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  const notice =
    params.error === "no_space"
      ? "This account isn't part of a memory space yet."
      : params.error === "rate_limited"
        ? "Too many visits just now — please wait a few minutes."
        : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm rounded-[2.5rem] border-2 border-line bg-surface/85 p-7 shadow-soft backdrop-blur-sm sm:p-9">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent shadow-soft">
            <Icon name="heart" size={30} filled className="animate-heartbeat" />
          </span>
          <h1 className="text-gradient pb-1 text-4xl font-semibold sm:text-5xl">Our Memories</h1>
          <p className="mt-2 font-serif text-2xl">A little place for the two of us ♡</p>
        </div>
        <LoginForm next={next} notice={notice} />
      </div>
      <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-muted transition-colors hover:text-accent">
        <Icon name="arrowLeft" size={16} /> Back to our memories
      </Link>
    </main>
  );
}
