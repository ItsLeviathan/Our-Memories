"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Modal built on the native <dialog> element: focus trapping, Escape to close
 * and an inert background come from the browser.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-xl" : "max-w-md"} max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-fg shadow-soft`}
      aria-labelledby="dialog-title"
    >
      {open ? (
        <div className="p-6 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="dialog-title" className="text-xl font-semibold tracking-tight">
                {title}
              </h2>
              {description ? <p className="mt-1.5 text-[0.95rem] text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Close"
            >
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
