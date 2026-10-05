"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, parseTags, Textarea, Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/client-api";
import type { GalleryItem } from "@/lib/types";
import { MAX_CAPTION_LENGTH, MAX_LOCATION_LENGTH } from "@/lib/uploads";

export function EditMemoryDialog({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: GalleryItem | null;
  onClose: () => void;
  onSaved: (item: GalleryItem, monthKey: string) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Dialog open={item !== null} onClose={onClose} title="Edit memory">
      {item ? <EditForm key={item.id} item={item} onSaved={onSaved} onDeleted={onDeleted} onCancel={onClose} /> : null}
    </Dialog>
  );
}

function EditForm({
  item,
  onSaved,
  onDeleted,
  onCancel,
}: {
  item: GalleryItem;
  onSaved: (item: GalleryItem, monthKey: string) => void;
  onDeleted: (id: string) => void;
  onCancel: () => void;
}) {
  const [day, setDay] = useState(item.day);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [location, setLocation] = useState(item.location ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));
  const [isFavorite, setIsFavorite] = useState(item.isFavorite);
  const [state, setState] = useState<"idle" | "saving" | "confirm-delete" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      const res = await api<{ item: GalleryItem; monthKey: string }>(`/api/memories/${item.id}`, {
        method: "PATCH",
        json: { day, caption, location, tags: parseTags(tags), isFavorite },
      });
      onSaved(res.item, res.monthKey);
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  const remove = async () => {
    setState("deleting");
    setError(null);
    try {
      await api(`/api/memories/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
    } catch (err) {
      setError((err as Error).message);
      setState("confirm-delete");
    }
  };

  if (state === "confirm-delete" || state === "deleting") {
    return (
      <div>
        <p className="text-fg-soft">This photo will be permanently removed. This can&apos;t be undone.</p>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setState("idle")} disabled={state === "deleting"}>
            Keep it
          </Button>
          <Button variant="danger" icon="trash" loading={state === "deleting"} onClick={remove}>
            Delete memory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Date">
        <Input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
      </Field>
      <Field label="Caption" hint="Optional">
        <Textarea rows={2} maxLength={MAX_CAPTION_LENGTH} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Random date day ♡" />
      </Field>
      <Field label="Location" hint="Optional">
        <Input maxLength={MAX_LOCATION_LENGTH} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where was this?" />
      </Field>
      <Field label="Tags" hint="Comma separated">
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="beach, sunset" />
      </Field>
      <Toggle
        checked={isFavorite}
        onChange={setIsFavorite}
        label="Favorite"
        description="Favorites are shown larger in the gallery"
        icon={<Icon name="heart" filled={isFavorite} className={isFavorite ? "text-accent" : "text-muted"} />}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" icon="trash" className="text-danger hover:text-danger" onClick={() => setState("confirm-delete")}>
          Delete
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={state === "saving"}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}
