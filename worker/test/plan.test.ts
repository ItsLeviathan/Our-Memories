import assert from "node:assert/strict";
import { test } from "node:test";
import { crossfadeArgs } from "../src/render/ffmpeg.js";
import { formatDayLabel, formatMonthLabel, photoDuration, planRecap, selectPhotos, type PlanPhoto } from "../src/render/plan.js";

function month(count: number, days = 30, favoriteEvery = 0): PlanPhoto[] {
  return Array.from({ length: count }, (_, i) => {
    const day = String(1 + Math.floor((i * days) / count)).padStart(2, "0");
    return { id: `p${i}`, day: `2026-10-${day}`, capturedAt: `2026-10-${day}T12:00:${String(i % 60).padStart(2, "0")}Z`, isFavorite: favoriteEvery > 0 && i % favoriteEvery === 0 };
  });
}

test("keeps every photo when under the cap", () => {
  const photos = month(12);
  assert.deepEqual(selectPhotos(photos, 80), photos);
});

test("caps large months, stays chronological, covers every day, keeps favorites", () => {
  const photos = month(300, 30, 37);
  const picked = selectPhotos(photos, 80);
  assert.equal(picked.length, 80);
  const indices = picked.map((p) => photos.indexOf(p));
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  assert.equal(new Set(picked.map((p) => p.day)).size, 30);
  for (const fav of photos.filter((p) => p.isFavorite)) assert.ok(picked.includes(fav), `favorite ${fav.id} kept`);
});

test("more days than slots still yields exactly max photos", () => {
  const photos = month(200, 31);
  assert.equal(selectPhotos(photos, 10).length, 10);
});

test("plan: durations adapt, dates shown once per day, total duration adds up", () => {
  const photos = month(10, 5);
  const plan = planRecap(photos, { maxPhotos: 80, showDates: true, formatDay: formatDayLabel });
  assert.equal(plan.slides.length, 10);
  assert.equal(plan.slides[0].duration, photoDuration(10));
  assert.equal(plan.slides.filter((s) => s.dateLabel).length, 5);
  assert.equal(plan.slides[0].dateLabel, "Thursday, October 1");
  assert.deepEqual(plan.stats, { memories: 10, days: 5 });
  const expected = plan.titleDuration + plan.endDuration + 10 * plan.slides[0].duration - 11 * plan.transition;
  assert.ok(Math.abs(plan.totalDuration - expected) < 0.01);
});

test("plan: a single memory works", () => {
  const plan = planRecap(month(1), { maxPhotos: 80, showDates: false, formatDay: formatDayLabel });
  assert.equal(plan.slides.length, 1);
  assert.equal(plan.slides[0].dateLabel, null);
});

test("plan: no memories is an error", () => {
  assert.throws(() => planRecap([], { maxPhotos: 80, showDates: true, formatDay: formatDayLabel }));
});

test("crossfade offsets account for each transition", () => {
  const { args, duration } = crossfadeArgs(
    [{ path: "a", duration: 4 }, { path: "b", duration: 3 }, { path: "c", duration: 3 }],
    1,
    "out.mp4",
    true,
  );
  assert.equal(duration, 8);
  const filter = args[args.indexOf("-filter_complex") + 1];
  assert.match(filter, /xfade=transition=fade:duration=1:offset=3\.000\[x1\]/);
  assert.match(filter, /xfade=transition=fade:duration=1:offset=5\.000\[x2\]/);
  assert.match(filter, /fade=t=out:st=6\.600:d=1\.4/);
});

test("labels", () => {
  assert.equal(formatMonthLabel("2026-10"), "October 2026");
  assert.equal(formatDayLabel("2026-10-04"), "Sunday, October 4");
});
