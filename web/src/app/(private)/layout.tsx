import { SiteHeader } from "@/components/SiteHeader";
import { requirePageSession } from "@/lib/auth";

export default async function PrivateLayout({ children }: LayoutProps<"/">) {
  const session = await requirePageSession();
  return (
    <>
      <SiteHeader displayName={session.displayName} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-10">{children}</main>
    </>
  );
}
