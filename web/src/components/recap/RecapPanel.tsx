"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon, Spinner } from "@/components/ui/Icon";
import { RecapPlayer } from "@/components/recap/RecapPlayer";
import { api } from "@/lib/client-api";
import { monthName } from "@/lib/months";
import type { RecapInfo } from "@/lib/types";

const isWorking = (s: RecapInfo["status"]) => s === "queued" || s === "processing";

/** Polls recap status while a job is queued or processing. */
function useRecap(monthKey: string, initial: RecapInfo) {
  const router = useRouter();
  const [recap, setRecap] = useState(initial);
  const working = isWorking(recap.status);

  useEffect(() => {
    if (!working) return;
    let delay = 4000;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await api<RecapInfo>(`/api/recaps/${monthKey}`);
        if (cancelled) return;
        setRecap(next);
        if (!isWorking(next.status)) {
          router.refresh();
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      delay = Math.min(delay * 1.25, 15000);
      timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [working, monthKey, router]);

  return [recap, setRecap] as const;
}

function useGenerate(monthKey: string, setRecap: (r: RecapInfo) => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = async (force = false) => {
    setPending(true);
    setError(null);
    try {
      setRecap(await api<RecapInfo>(`/api/recaps/${monthKey}`, { method: "POST", json: { force } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return { generate, pending, error };
}

/** Compact control for the dashboard: one button reflecting the recap state. */
export function RecapButton({ monthKey, initial, disabled }: { monthKey: string; initial: RecapInfo; disabled?: boolean }) {
  const [recap, setRecap] = useRecap(monthKey, initial);
  const { generate, pending, error } = useGenerate(monthKey, setRecap);

  let control;
  if (isWorking(recap.status)) {
    control = (
      <Button variant="secondary" loading disabled>
        Generating…
      </Button>
    );
  } else if (recap.status === "ready") {
    control = (
      <a href={`/months/${monthKey}#recap`} className={buttonClasses({ variant: "secondary" })}>
        <Icon name="play" /> Watch recap
      </a>
    );
  } else if (recap.status === "failed") {
    control = (
      <Button variant="secondary" icon="retry" loading={pending} onClick={() => generate()}>
        Try again
      </Button>
    );
  } else {
    control = (
      <Button variant="secondary" icon="film" loading={pending} disabled={disabled} onClick={() => generate()}>
        Generate recap
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {control}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {recap.status === "failed" && !error ? <p className="text-sm text-danger">Generation failed</p> : null}
    </div>
  );
}

/** Full recap section for a month page. */
export function RecapPanel({ monthKey, initial, memoryCount }: { monthKey: string; initial: RecapInfo; memoryCount: number }) {
  const [recap, setRecap] = useRecap(monthKey, initial);
  const { generate, pending, error } = useGenerate(monthKey, setRecap);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const working = isWorking(recap.status);
  const name = monthName(monthKey);

  return (
    <section id="recap" aria-labelledby="recap-title" className="scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="recap-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {name} recap
          </h2>
          <p className="mt-1 text-muted" aria-live="polite">
            {working
              ? recap.status === "queued"
                ? "Waiting to start… This usually takes a few minutes. You can leave this page."
                : "Putting your month together… You can leave this page."
              : recap.status === "ready"
                ? `${recap.photoCount ?? memoryCount} photos${recap.durationSeconds ? ` · ${formatDuration(recap.durationSeconds)}` : ""}`
                : recap.status === "failed"
                  ? "Generation failed."
                  : "A short film of this month, made from your photos."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {working ? (
            <Button variant="secondary" disabled>
              <Spinner /> Generating…
            </Button>
          ) : recap.status === "ready" ? (
            <>
              <a href={`/api/recaps/${monthKey}/download`} className={buttonClasses({ variant: "secondary" })}>
                <Icon name="download" /> Download
              </a>
              {confirmRegenerate ? (
                <span className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => setConfirmRegenerate(false)}>
                    Cancel
                  </Button>
                  <Button
                    loading={pending}
                    onClick={async () => {
                      await generate(true);
                      setConfirmRegenerate(false);
                    }}
                  >
                    Regenerate
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" icon="retry" onClick={() => setConfirmRegenerate(true)}>
                  Regenerate
                </Button>
              )}
            </>
          ) : recap.status === "failed" ? (
            <Button icon="retry" loading={pending} onClick={() => generate()}>
              Try again
            </Button>
          ) : (
            <Button icon="film" loading={pending} disabled={memoryCount === 0} onClick={() => generate()}>
              Generate recap
            </Button>
          )}
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {recap.status === "failed" && recap.error ? (
        <p className="mb-4 flex items-center gap-2 text-sm text-danger">
          <Icon name="alert" size={16} /> {recap.error}
        </p>
      ) : null}
      {confirmRegenerate ? (
        <p className="mb-4 text-sm text-muted">
          A new version will be made with this month&apos;s current photos. The current film stays available until it&apos;s ready.
        </p>
      ) : null}

      {recap.videoUrl ? (
        <RecapPlayer src={recap.videoUrl} poster={recap.posterUrl} title={`${name} recap`} />
      ) : working ? (
        <div className="grid aspect-video w-full place-items-center rounded-2xl border border-line bg-surface-2/60 text-muted">
          <span className="flex flex-col items-center gap-3 text-sm">
            <Spinner size={26} />
            Generating…
          </span>
        </div>
      ) : null}
    </section>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m} min ${s ? `${s} s` : ""}`.trim() : `${s} s`;
}
