import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { deleteStorageObjectLifecycle } from "@/lib/helpers/storage.lifecycle";
import { deleteOpenAiFileLifecycle } from "@/lib/helpers/openai.lifecycle";
import { completeFileCleanup } from "@/lib/repos/files.repo";
import { reconcilePendingFileCapacityReservations } from "@/lib/services/fileCapacityReconciliation.service";
import { logger } from "@/lib/observability/logger";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authorization = req.headers.get("authorization") || "";
  return (
    authorization === `Bearer ${cronSecret}` ||
    req.headers.get("x-cron-secret") === cronSecret
  );
}

export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reconciliationResults =
      await reconcilePendingFileCapacityReservations(20);

    const { data: files, error: claimErr } = await sb.rpc(
      "claim_files_for_cleanup",
      {
        p_batch_size: 50,
        p_claim_duration: "10 minutes",
      },
    );

    if (claimErr) throw claimErr;
    const results = [];

    for (const file of files ?? []) {
      let storageDeleted = !file.object_path || !file.bucket;
      let publicObjectDeleted = !file.public_object_path || !file.public_bucket;
      let openaiDeleted = !file.open_ai_id;
      let lastError = null;

      // Try delete Storage
      if (!storageDeleted) {
        const result = await deleteStorageObjectLifecycle(
          file.bucket,
          file.object_path,
        );
        if (result.ok) storageDeleted = true;
        else lastError = result.message;
      }

      const sameStorageObject =
        file.public_bucket === file.bucket &&
        file.public_object_path === file.object_path;
      if (!publicObjectDeleted && sameStorageObject && storageDeleted) {
        publicObjectDeleted = true;
      } else if (!publicObjectDeleted) {
        const result = await deleteStorageObjectLifecycle(
          file.public_bucket,
          file.public_object_path,
        );
        if (result.ok) publicObjectDeleted = true;
        else lastError = result.message;
      }

      // Try delete OpenAI
      if (!openaiDeleted) {
        const res = await deleteOpenAiFileLifecycle(file.open_ai_id);
        if (res.ok) openaiDeleted = true;
        else lastError = res.message;
      }

      // Determine outcome
      if (storageDeleted && publicObjectDeleted && openaiDeleted) {
        await completeFileCleanup({
          organizationId: file.organization_id,
          fileId: file.id,
          storageDeleted,
          publicObjectDeleted,
          openAiDeleted: openaiDeleted,
        });
        results.push({ id: file.id, status: "deleted" });
      } else {
        // Retryable failure
        const retryCount = (file.retry_count || 0) + 1;
        const nextRetry = new Date();
        nextRetry.setMinutes(
          nextRetry.getMinutes() + Math.min(5 * Math.pow(2, retryCount), 1440),
        ); // Backoff up to 24h

        await sb
          .from("file")
          .update({
            status: "delete_retryable_failed",
            last_error_message: lastError
              ? lastError.substring(0, 200)
              : "Delete failed",
            retry_count: retryCount,
            next_retry_at: nextRetry.toISOString(),
            claim_expires_at: null,
            claimed_at: null,
          })
          .eq("id", file.id)
          .eq("organization_id", file.organization_id);
        results.push({ id: file.id, status: "failed", error: lastError });
      }
    }

    logger.info("file_cleanup_completed", {
      provider: "internal",
      operation: "file_cleanup_batch",
      outcome: "completed",
      processed: files?.length ?? 0,
      succeeded: results.filter((item) => item.status === "deleted").length,
      failed: results.filter((item) => item.status === "failed").length,
    });
    return NextResponse.json(
      {
        processed: files?.length ?? 0,
        results,
        reconciliations: reconciliationResults,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error(
      "file_cleanup_failed",
      {
        provider: "internal",
        operation: "file_cleanup_batch",
        outcome: "failed",
      },
      err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
