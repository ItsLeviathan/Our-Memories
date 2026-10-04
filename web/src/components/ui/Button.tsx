import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, Spinner, type IconName } from "@/components/ui/Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none " +
  "transition-[background-color,color,border-color,transform,opacity] duration-200 ease-out-soft " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:bg-fg-soft",
  secondary: "border border-line-strong text-fg hover:border-fg/40 hover:bg-surface-2/60",
  ghost: "text-fg-soft hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
  icon: "h-11 w-11",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

export function buttonClasses({ variant = "primary", size = "md", className = "" }: CommonProps = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({
  variant,
  size,
  icon,
  loading,
  children,
  className,
  disabled,
  type = "button",
  ...props
}: CommonProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  children,
  className,
  ...props
}: CommonProps & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}
