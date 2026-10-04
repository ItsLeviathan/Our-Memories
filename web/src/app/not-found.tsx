import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-6xl" aria-hidden="true">🥺</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Oops, nothing here</h1>
        <p className="mt-3 font-serif text-2xl">This page wandered off somewhere ♡</p>
        <ButtonLink href="/" icon="heart" className="mt-8">
          Take me home
        </ButtonLink>
      </div>
    </main>
  );
}
