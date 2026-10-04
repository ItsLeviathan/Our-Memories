import "server-only";
import { env } from "@/lib/env";

/**
 * Starts the recap worker immediately when it runs on GitHub Actions
 * (workflow_dispatch). Optional: without GITHUB_DISPATCH_TOKEN this is a no-op
 * and an always-on worker (or the workflow's schedule) picks the job up.
 * Never throws — a failed trigger only delays the recap until the next run.
 */
export async function triggerRecapWorker(): Promise<void> {
  const { GITHUB_DISPATCH_TOKEN, GITHUB_REPOSITORY, GITHUB_WORKFLOW, GITHUB_REF } = env();
  if (!GITHUB_DISPATCH_TOKEN || !GITHUB_REPOSITORY) return;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: GITHUB_REF }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) console.error("[worker-trigger] dispatch failed", res.status, (await res.text()).slice(0, 200));
  } catch (err) {
    console.error("[worker-trigger] dispatch error", err);
  }
}
