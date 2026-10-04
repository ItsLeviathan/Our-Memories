import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  const notice = params.error === "no_space" ? "This account isn't part of a memory space yet." : null;

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-16">
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
    </main>
  );
}
