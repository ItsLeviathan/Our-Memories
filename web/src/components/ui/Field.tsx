import type { ComponentProps, ReactNode } from "react";

export const inputClasses =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-fg placeholder:text-muted/70 " +
  "transition-colors focus:border-fg/40 focus:outline-none focus-visible:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-medium text-fg-soft">
        {label}
        {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClasses} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClasses} resize-none ${props.className ?? ""}`} />;
}

/** Accessible on/off switch. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>
          <span className="block text-[0.95rem] font-medium">{label}</span>
          {description ? <span className="block text-sm text-muted">{description}</span> : null}
        </span>
      </span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-fg" : "bg-line-strong"}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}
