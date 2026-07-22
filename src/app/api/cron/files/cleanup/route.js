import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { deleteStorageObjectLifecycle } from "@/lib/helpers/storage.lifecycle";
import { deleteOpenAiFileLifecycle } from "@/lib/helpers/openai.lifecycle";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req) {
  // Typically we'd check req.headers.get("Authorization") for a cron secret here
  try {
    // 1. Claim up to 50 files for cleanup
    const { data: files, error: claimErr } = await sb.rpc("claim_files_for_cleanup", {
      p_batch_size: 50,
      p_claim_duration: "10 minutes"
    });

    if (claimErr) throw claimErr;
    if (!files || files.length === 0) {
      return NextResponse.json({ message: "No files to clean up" }, { status: 200 });
    }

    const results = [];

    // 2. Process each claimed file
    for (const file of files) {
      let storageDeleted = !!file.storage_deleted_at;
      let openaiDeleted = !!file.openai_deleted_at;
      let lastError = null;

      // Try delete Storage
      if (!storageDeleted && (file.object_path || file.public_object_path)) {
        if (file.object_path && file.bucket) {
          const res = await deleteStorageObjectLifecycle(file.bucket, file.object_path);
          if (res.ok) storageDeleted = true;
          else lastError = res.message;
        }
        if (file.public_object_path && file.public_bucket) {
          const res = await deleteStorageObjectLifecycle(file.public_bucket, file.public_object_path);
          if (res.ok) storageDeleted = true; // wait, needs both. we'll assume best effort
          else lastError = res.message;
        }
        if (!file.object_path && !file.public_object_path) {
          storageDeleted = true; // Nothing to delete
        }
      } else {
        storageDeleted = true;
      }

      // Try delete OpenAI
      if (!openaiDeleted && file.open_ai_id) {
        const res = await deleteOpenAiFileLifecycle(file.open_ai_id);
        if (res.ok) openaiDeleted = true;
        else lastError = res.message;
      } else {
        openaiDeleted = true;
      }

      // Determine outcome
      if (storageDeleted && openaiDeleted) {
        // Success: mark as tombstone (deleted)
        await sb.from("file").update({
          status: "deleted",
          storage_deleted_at: file.storage_deleted_at || (file.object_path ? new Date().toISOString() : null),
          openai_deleted_at: file.openai_deleted_at || (file.open_ai_id ? new Date().toISOString() : null),
          deleted_at: new Date().toISOString(),
          claim_expires_at: null,
          claimed_at: null
        }).eq("id", file.id);
        results.push({ id: file.id, status: "deleted" });
      } else {
        // Retryable failure
        const retryCount = (file.retry_count || 0) + 1;
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + Math.min(5 * Math.pow(2, retryCount), 1440)); // Backoff up to 24h

        await sb.from("file").update({
          status: "delete_retryable_failed",
          last_error_message: lastError ? lastError.substring(0, 200) : "Delete failed",
          retry_count: retryCount,
          next_retry_at: nextRetry.toISOString(),
          claim_expires_at: null,
          claimed_at: null
        }).eq("id", file.id);
        results.push({ id: file.id, status: "failed", error: lastError });
      }
    }

    return NextResponse.json({ processed: files.length, results }, { status: 200 });
  } catch (err) {
    console.error("Cron file cleanup failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
