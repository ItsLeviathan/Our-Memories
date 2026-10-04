"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field, Input, parseTags, Textarea, Toggle } from "@/components/ui/Field";
import { Icon, Spinner } from "@/components/ui/Icon";
import { ClientApiError } from "@/lib/client-api";
import { formatDay, monthLabel, pluralize } from "@/lib/months";
import { readCaptureTime, uploadPhoto, type UploadPhase } from "@/lib/upload-client";
import { MAX_CAPTION_LENGTH, MAX_LOCATION_LENGTH, resolveImageType, type AcceptedImageType } from "@/lib/uploads";

type Status = "ready" | UploadPhase | "done" | "duplicate" | "failed" | "cancelled";

interface Entry {
  id: string;
  file: File;
  type: AcceptedImageType | null;
  previewUrl: string;
  capture: { day: string; time: string } | null;
  status: Status;
  progress: number;
  error: string | null;
  monthKey: string | null;
}

const CONCURRENCY = 3;
const ACTIVE: Status[] = ["hashing", "uploading", "processing"];

export function Uploader({ defaultDay, maxMb }: { defaultDay: string; maxMb: number }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [day, setDay] = useState(defaultDay);
  const [useCaptureDates, setUseCaptureDates] = useState(true);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const entriesRef = useRef(entries);
  const dayTouchedRef = useRef(false);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  // Release preview object URLs on unmount.
  useEffect(() => () => entriesRef.current.forEach((e) => URL.revokeObjectURL(e.previewUrl)), []);

  // Warn before leaving mid-upload.
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  const addFiles = (files: FileList | File[]) => {
    const existing = new Set(entriesRef.current.map((e) => `${e.file.name}:${e.file.size}:${e.file.lastModified}`));
    const added: Entry[] = [];
    for (const file of Array.from(files)) {
      const sig = `${file.name}:${file.size}:${file.lastModified}`;
      if (existing.has(sig)) continue; // same file picked twice
      existing.add(sig);
      const type = resolveImageType(file);
      const tooLarge = file.size > maxMb * 1024 * 1024;
      added.push({
        id: crypto.randomUUID(),
        file,
        type,
        previewUrl: URL.createObjectURL(file),
        capture: null,
        status: !type || tooLarge ? "failed" : "ready",
        progress: 0,
        error: !type ? "Not a supported photo" : tooLarge ? `Larger than ${maxMb} MB` : null,
        monthKey: null,
      });
    }
    if (!added.length) return;
    setEntries((prev) => [...prev, ...added]);

    // Read capture dates in the background to suggest the date.
    Promise.all(
      added.filter((e) => e.type).map(async (e) => {
        const capture = await readCaptureTime(e.file);
        if (capture) update(e.id, { capture });
        return capture;
      }),
    ).then((captures) => {
      const days = captures.filter(Boolean).map((c) => c!.day);
      if (!days.length || dayTouchedRef.current) return;
      const counts = days.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d]: (acc[d] ?? 0) + 1 }), {});
      setDay(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    });
  };

  const remove = (id: string) =>
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });

  const start = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    const details = {
      caption,
      location,
      tags: parseTags(tags),
      isFavorite,
    };

    const queue = entriesRef.current.filter((e) => e.status === "ready");
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        if (controller.signal.aborted) return;
        const capture = useCaptureDates ? entry.capture : null;
        try {
          const result = await uploadPhoto(
            entry.file,
            entry.type!,
            { ...details, day: capture?.day ?? day, time: capture?.time ?? null },
            {
              signal: controller.signal,
              onPhase: (status) => update(entry!.id, { status, error: null }),
              onProgress: (progress) => update(entry!.id, { progress }),
            },
          );
          update(entry.id, { status: "done", progress: 1, monthKey: result.monthKey });
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            update(entry.id, { status: "cancelled", progress: 0 });
          } else if (err instanceof ClientApiError && err.code === "duplicate") {
            update(entry.id, { status: "duplicate", error: "Already in your memories" });
          } else {
            update(entry.id, { status: "failed", progress: 0, error: (err as Error).message });
          }
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    abortRef.current = null;
    router.refresh();
  };

  const cancel = () => {
    abortRef.current?.abort();
    // Entries not yet started are marked cancelled too.
    setEntries((prev) => prev.map((e) => (e.status === "ready" ? { ...e, status: "cancelled" } : e)));
  };

  const retry = () => {
    setEntries((prev) =>
      prev.map((e) =>
        (e.status === "failed" || e.status === "cancelled") && e.type ? { ...e, status: "ready", error: null, progress: 0 } : e,
      ),
    );
  };

  const counts = useMemo(() => {
    const c = { total: entries.length, ready: 0, active: 0, done: 0, duplicate: 0, failed: 0 };
    for (const e of entries) {
      if (e.status === "ready") c.ready++;
      else if (ACTIVE.includes(e.status)) c.active++;
      else if (e.status === "done") c.done++;
      else if (e.status === "duplicate") c.duplicate++;
      else if (e.type) c.failed++; // failed or cancelled, retryable
    }
    return c;
  }, [entries]);

  const doneMonth = useMemo(() => {
    const months = entries.filter((e) => e.monthKey).map((e) => e.monthKey!);
    if (!months.length) return null;
    const counts = months.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m]: (acc[m] ?? 0) + 1 }), {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [entries]);

  const hasCaptureDates = entries.some((e) => e.capture);
  const finished = !running && counts.total > 0 && counts.ready === 0 && counts.done + counts.duplicate > 0;
  const uploadable = entries.filter((e) => e.type).length;
  const progressOf = (e: Entry) =>
    e.status === "done" || e.status === "duplicate" ? 1 : e.status === "processing" ? 0.9 : e.status === "uploading" ? e.progress * 0.85 : 0;
  const overall = uploadable ? entries.reduce((sum, e) => sum + progressOf(e), 0) / uploadable : 0;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!running && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept="image/*,.heic,.heif"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        if (e.target.files) addFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (entries.length === 0) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex min-h-[52vh] flex-col items-center justify-center rounded-[2rem] border border-dashed px-6 py-16 text-center transition-colors duration-300 ${
          dragging ? "border-fg/50 bg-surface-2" : "border-line-strong bg-surface/60"
        }`}
      >
        {fileInput}
        <span className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-fg-soft">
          <Icon name="image" size={28} />
        </span>
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">Drop photos here</p>
        <p className="mt-2 text-muted">or</p>
        <Button size="lg" className="mt-4" onClick={() => inputRef.current?.click()}>
          Choose from your device
        </Button>
        <p className="mt-6 max-w-sm text-sm text-muted">
          JPEG, PNG, WebP, AVIF or HEIC, up to {maxMb} MB each. Photos are optimized automatically and stay private.
        </p>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!running) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14"
    >
      {fileInput}
      <section aria-label="Selected photos">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{pluralize(counts.total, "photo")} selected</h2>
            <p className="mt-1 text-sm text-muted" aria-live="polite">
              {running
                ? `Adding ${counts.done + counts.duplicate} of ${uploadable}…`
                : finished
                  ? `${pluralize(counts.done, "memory", "memories")} added${counts.duplicate ? ` · ${counts.duplicate} already saved` : ""}${counts.failed ? ` · ${counts.failed} failed` : ""}`
                  : "Review them, then add the details."}
            </p>
          </div>
          {!running && !finished ? (
            <Button variant="secondary" icon="plus" onClick={() => inputRef.current?.click()}>
              <span className="hidden sm:inline">Add more</span>
            </Button>
          ) : null}
        </div>

        {running || finished ? (
          <div className="mb-5 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(overall * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-fg transition-[width] duration-500" style={{ width: `${Math.max(2, overall * 100)}%` }} />
          </div>
        ) : null}

        <ul className={`grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-5 ${dragging ? "opacity-60" : ""}`}>
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <Thumb entry={entry} canRemove={!running && entry.status !== "done"} onRemove={() => remove(entry.id)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {finished ? (
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-7">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
              <Icon name="check" size={24} />
            </span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">
              {counts.done ? "Added to your memories" : "Nothing new to add"}
            </h3>
            <p className="mt-1.5 text-muted">
              {counts.done
                ? `${pluralize(counts.done, "photo")} optimized and saved.`
                : "These photos were already in your memories."}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {counts.failed ? (
                <Button variant="secondary" icon="retry" onClick={retry}>
                  Retry {counts.failed} failed
                </Button>
              ) : null}
              {doneMonth ? (
                <Link href={`/months/${doneMonth}`} className={buttonClasses()}>
                  View {monthLabel(doneMonth)}
                </Link>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => {
                  entries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
                  setEntries([]);
                  setCaption("");
                  setLocation("");
                  setTags("");
                  setIsFavorite(false);
                }}
              >
                Add more photos
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!running && counts.ready > 0) start();
            }}
          >
            <Field label="Date" hint={day ? formatDay(day, { weekday: false, withYear: true }) : undefined}>
              <Input
                type="date"
                required
                value={day}
                disabled={running}
                onChange={(e) => {
                  setDay(e.target.value);
                  dayTouchedRef.current = true;
                }}
              />
            </Field>
            {hasCaptureDates ? (
              <Toggle
                checked={useCaptureDates}
                onChange={setUseCaptureDates}
                label="Use each photo's own date"
                description="When the photo has one; otherwise the date above"
              />
            ) : null}
            <Field label="Caption" hint="Optional">
              <Textarea rows={2} maxLength={MAX_CAPTION_LENGTH} value={caption} disabled={running} onChange={(e) => setCaption(e.target.value)} placeholder="Sunday date" />
            </Field>
            <Field label="Location" hint="Optional">
              <Input maxLength={MAX_LOCATION_LENGTH} value={location} disabled={running} onChange={(e) => setLocation(e.target.value)} placeholder="Where was this?" />
            </Field>
            <Field label="Tags" hint="Optional, comma separated">
              <Input value={tags} disabled={running} onChange={(e) => setTags(e.target.value)} placeholder="beach, sunset" />
            </Field>
            <Toggle
              checked={isFavorite}
              onChange={setIsFavorite}
              label="Mark as favorites"
              icon={<Icon name="heart" filled={isFavorite} className={isFavorite ? "text-accent" : "text-muted"} />}
            />
            <div className="flex flex-col gap-2 pt-2">
              {running ? (
                <Button variant="secondary" onClick={cancel}>
                  Cancel
                </Button>
              ) : (
                <>
                  <Button type="submit" size="lg" disabled={counts.ready === 0}>
                    {counts.ready ? `Add ${pluralize(counts.ready, "memory", "memories")}` : "Add memories"}
                  </Button>
                  {counts.failed ? (
                    <Button variant="ghost" icon="retry" onClick={retry}>
                      Retry {counts.failed} failed
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}

function Thumb({ entry, canRemove, onRemove }: { entry: Entry; canRemove: boolean; onRemove: () => void }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const active = ACTIVE.includes(entry.status);
  const dimmed = active || entry.status === "ready" ? "" : entry.status === "done" ? "" : "opacity-60";

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2">
      {previewFailed ? (
        <span className="grid h-full w-full place-items-center text-muted">
          <Icon name="image" size={26} />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img
          src={entry.previewUrl}
          alt=""
          className={`h-full w-full object-cover transition-opacity ${dimmed}`}
          onError={() => setPreviewFailed(true)}
        />
      )}

      {active ? (
        <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
          <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
            <Spinner size={22} />
            {entry.status === "uploading" ? `${Math.round(entry.progress * 100)}%` : entry.status === "processing" ? "Optimizing" : "Preparing"}
          </span>
        </span>
      ) : null}

      {entry.status === "done" ? (
        <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Icon name="check" size={16} />
          <span className="sr-only">Added</span>
        </span>
      ) : null}

      {entry.status === "failed" || entry.status === "duplicate" || entry.status === "cancelled" ? (
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/65 px-2 py-1.5 text-[0.72rem] leading-tight text-white">
          <Icon name={entry.status === "duplicate" ? "check" : "alert"} size={14} className="shrink-0" />
          <span className="line-clamp-2">{entry.status === "cancelled" ? "Cancelled" : entry.error}</span>
        </span>
      ) : null}

      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          aria-label={`Remove ${entry.file.name}`}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}
