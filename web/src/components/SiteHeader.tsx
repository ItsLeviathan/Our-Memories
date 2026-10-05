import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CoupleMark } from "@/components/ui/CoupleMark";
import { Icon } from "@/components/ui/Icon";

/**
 * `displayName` is null for signed-out visitors, who get a sign-in button instead.
 * `names` are the two of us, written under the wordmark.
 */
export function SiteHeader({ displayName, names }: { displayName: string | null; names: string[] }) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line/70 bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/65">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="hover-wiggle flex min-w-0 items-center gap-2.5" aria-label="Our Memories — home">
          <span className="wiggle-target grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft shadow-soft">
            <CoupleMark size={30} className="animate-heartbeat" />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="text-gradient font-display text-xl font-semibold">Our Memories</span>
            {names.length === 2 ? (
              <span className="mt-0.5 truncate font-serif text-[1.05rem] leading-tight">
                {names[0]} <span className="text-lavender">&amp;</span> {names[1]}
              </span>
            ) : null}
          </span>
        </Link>
        {displayName === null ? (
          <ButtonLink href="/login" variant="secondary" icon="heart">
            Sign in
          </ButtonLink>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Visibility lives on wrappers: the button's own `inline-flex` would override `hidden`. */}
            <span className="hidden sm:contents">
              <ButtonLink href="/add" icon="plus">
                Add memories
              </ButtonLink>
            </span>
            <span className="contents sm:hidden">
              <ButtonLink href="/add" size="icon" icon="plus" aria-label="Add memories" />
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                aria-label={`Sign out (${displayName})`}
                title={`Signed in as ${displayName} — sign out`}
              >
                <Icon name="logout" />
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
