import type { Metadata } from "next";
import { Uploader } from "@/components/upload/Uploader";
import { requirePageSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { currentMonthKeyIn, isMonthKey, todayIn } from "@/lib/months";

export const metadata: Metadata = { title: "Add memories" };

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  await requirePageSession();
  const { APP_TIMEZONE, UPLOAD_MAX_MB } = env();
  const { month } = await searchParams;
  const today = todayIn(APP_TIMEZONE);

  // Adding from a past month's page defaults the date into that month.
  const defaultDay =
    typeof month === "string" && isMonthKey(month) && month < currentMonthKeyIn(APP_TIMEZONE) ? `${month}-01` : today;

  return (
    <div>
      <header className="mb-10 sm:mb-14">
        <h1 className="text-gradient pb-1 text-4xl font-semibold sm:text-5xl">Add to our memories</h1>
        <p className="mt-2 font-serif text-2xl sm:text-3xl">A few sweet photos from your day ♡</p>
      </header>
      <Uploader defaultDay={defaultDay} maxMb={UPLOAD_MAX_MB} />
    </div>
  );
}
