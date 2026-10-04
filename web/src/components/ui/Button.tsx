import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, Spinner, type IconName } from "@/components/ui/Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap select-none " +
  "transition-[background-color,color,border-color,transform,opacity,box-shadow,filter] duration-200 ease-out-soft " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "border-2 border-line-strong bg-surface/70 text-accent hover:border-accent/50 hover:bg-accent-soft",
  ghost: "text-fg-soft hover:bg-accent-soft hover:text-accent",
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
