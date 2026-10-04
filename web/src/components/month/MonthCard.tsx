import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { monthLabel, pluralize } from "@/lib/months";
import type { MonthSummary } from "@/lib/types";

export function MonthCard({ month }: { month: MonthSummary }) {
  return (
    <Link href={`/months/${month.monthKey}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2">
        {month.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL
          <img
            src={month.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full place-items-center text-muted">
            <Icon name="image" size={28} />
          </span>
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
          {month.recapStatus === "ready" ? <Badge icon="play">Recap</Badge> : null}
          {month.shareActive ? <Badge icon="link">Shared</Badge> : null}
        </div>
      </div>
      <div className="mt-3.5 px-0.5">
        <h3 className="text-xl font-semibold tracking-tight">{monthLabel(month.monthKey)}</h3>
        <p className="mt-0.5 text-[0.95rem] text-muted">
          {pluralize(month.memoryCount, "memory", "memories")} · {pluralize(month.dayCount, "day")}
        </p>
      </div>
    </Link>
  );
}

function Badge({ icon, children }: { icon: "play" | "link"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
      <Icon name={icon} size={12} filled={icon === "play"} />
      {children}
    </span>
  );
}
