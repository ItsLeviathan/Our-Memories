"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/client-api";
import { monthLabel } from "@/lib/months";
import type { ShareInfo } from "@/lib/types";

type Expiry = null | 7 | 30 | 90;

/** Share button + dialog to create, copy, regenerate or turn off a month's link. */
export function ShareButton({ monthKey, initial, disabled }: { monthKey: string; initial: ShareInfo | null; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState(initial);
  const [allowDownloads, setAllowDownloads] = useState(initial?.allowDownloads ?? false);
  const [expiry, setExpiry] = useState<Expiry>(null);
  const [state, setState] = useState<"idle" | "creating" | "revoking" | "confirm-regenerate" | "confirm-revoke">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);

  const create = async () => {
    setState("creating");
    setError(null);
    try {
      const next = await api<ShareInfo>(`/api/shares/${monthKey}`, {
        method: "POST",
        json: { allowDownloads, expiresInDays: expiry },
      });
      setShare(next);
      setRevoked(false);
      setState("idle");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  const revoke = async () => {
    setState("revoking");
    setError(null);
    try {
      await api(`/api/shares/${monthKey}`, { method: "DELETE" });
      setShare(null);
      setRevoked(true);
      setState("idle");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
    } catch {
      // Clipboard API unavailable (e.g. insecure context): select the text instead.
      (document.getElementById("share-url") as HTMLInputElement | null)?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button variant="secondary" icon="share" disabled={disabled} onClick={() => setOpen(true)}>
        {share ? "Shared" : "Share"}
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setState("idle");
          setError(null);
        }}
        title={`Share ${monthLabel(monthKey)}`}
        description="Anyone with the link can view this month's photos and recap. They can't change anything or see other months."
      >
        {share ? (
          <div className="space-y-5">
            <div>
              <label htmlFor="share-url" className="mb-1.5 block text-sm font-medium text-fg-soft">
                Private link
              </label>
              <div className="flex gap-2">
                <input
                  id="share-url"
                  readOnly
                  value={share.url}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-sm text-fg-soft focus:outline-none"
                />
                <Button onClick={copy} icon={copied ? "check" : "copy"} aria-live="polite">
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted">
                {share.allowDownloads ? "Downloads allowed" : "View only"}
                {" · "}
                {share.expiresAt
                  ? `Expires ${new Date(share.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                  : "Never expires"}
              </p>
            </div>

            {state === "confirm-regenerate" ? (
              <Confirm
                text="The current link will stop working immediately, and a new one will be created."
                action="Create new link"
                onCancel={() => setState("idle")}
                onConfirm={create}
              />
            ) : state === "confirm-revoke" ? (
              <Confirm
                text="The link will stop working immediately for everyone who has it."
                action="Turn off link"
                danger
                onCancel={() => setState("idle")}
                onConfirm={revoke}
              />
            ) : (
              <div className="flex flex-col gap-2 border-t border-line pt-5 sm:flex-row">
                <Button variant="ghost" icon="retry" loading={state === "creating"} onClick={() => setState("confirm-regenerate")}>
                  New link
                </Button>
                <Button variant="ghost" className="text-danger hover:text-danger" loading={state === "revoking"} onClick={() => setState("confirm-revoke")}>
                  Turn off link
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {revoked ? (
              <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-soft">
                <Icon name="check" size={16} /> The link has been turned off.
              </p>
            ) : null}
            <Toggle
              checked={allowDownloads}
              onChange={setAllowDownloads}
              label="Allow downloads"
              description="Viewers can save HD photos and the recap"
            />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg-soft">Link expires</legend>
              <div className="grid grid-cols-4 gap-2">
                {([null, 7, 30, 90] as Expiry[]).map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setExpiry(value)}
                    aria-pressed={expiry === value}
                    className={`h-11 rounded-2xl border-2 text-sm font-bold transition-colors ${
                      expiry === value ? "btn-primary border-transparent" : "border-line text-fg-soft hover:border-line-strong"
                    }`}
                  >
                    {value === null ? "Never" : `${value} days`}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button className="w-full" size="lg" icon="link" loading={state === "creating"} onClick={create}>
              Create link
            </Button>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      </Dialog>
    </>
  );
}

function Confirm({
  text,
  action,
  danger,
  onCancel,
  onConfirm,
}: {
  text: string;
  action: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
      <p className="text-sm text-fg-soft">{text}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {action}
        </Button>
      </div>
    </div>
  );
}
