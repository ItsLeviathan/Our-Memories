import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { monthLabel, pluralize } from "@/lib/months";
import type { MonthSummary } from "@/lib/types";

export function MonthCard({ month, isCurrent = false }: { month: MonthSummary; isCurrent?: boolean }) {
  return (
    <Link href={`/months/${month.monthKey}`} className="polaroid-item group block">
      <div className="polaroid relative">
        <span className="tape" aria-hidden="true" />
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
          {month.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL
            <img
              src={month.coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.04]"
            />
          ) : (
            <span className="grid h-full place-items-center text-accent/60">
              <Icon name="heart" size={32} />
            </span>
          )}
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex gap-1.5">
            {isCurrent ? <Badge icon="heart">This month</Badge> : null}
            {month.recapStatus === "ready" ? <Badge icon="play">Recap</Badge> : null}
            {month.shareActive ? <Badge icon="link">Shared</Badge> : null}
          </div>
        </div>
        <div className="mt-3 px-1 text-center">
          <h3 className="text-xl font-semibold">{monthLabel(month.monthKey)}</h3>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[0.95rem] text-muted">
            <Icon name="heart" size={13} filled className="text-accent/70" />
            {pluralize(month.memoryCount, "memory", "memories")} · {pluralize(month.dayCount, "day")}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Badge({ icon, children }: { icon: "play" | "link" | "heart"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-xs font-bold text-[#6d28d9] shadow-sm backdrop-blur-md">
      <Icon name={icon} size={12} filled={icon !== "link"} />
      {children}
    </span>
  );
}
