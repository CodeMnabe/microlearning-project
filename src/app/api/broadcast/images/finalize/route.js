import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireOwnedOrg, handleApiError } from "@/lib/auth/guards";
import {
  adjustFileReservedCapacity,
  getFileCapacityReservation,
  getFileById,
  markFilePendingDelete,
  transitionFileLifecycle,
} from "@/lib/repos/files.repo";
import { downloadWithLimit } from "@/lib/security/streamReader";
import { validateMagicBytes } from "@/lib/security/magicBytes";
import sharp from "sharp";
import { logger } from "@/lib/observability/logger";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function POST(req) {
  try {
    const { orgId, fileId, reservationKey } = await req.json();

    if (
      !orgId ||
      !fileId ||
      typeof reservationKey !== "string" ||
      !UUID_PATTERN.test(reservationKey)
    ) {
      return NextResponse.json(
        { error: "Missing orgId, fileId or valid reservationKey" },
        { status: 400 },
      );
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const dbFile = await getFileById(fileId, orgAuth.orgId).catch(() => null);
    if (!dbFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // prettier-ignore
    const reservation = await getFileCapacityReservation(orgAuth.orgId, reservationKey).catch(() => null);
    const expectedPathPrefix = `broadcasts/${orgAuth.orgId}/${reservationKey}-`;
    if (
      !reservation ||
      reservation.upload_flow !== "broadcast_intent" ||
      reservation.assistant_id !== null ||
      Number(dbFile.capacity_reservation_id) !== Number(reservation.id) ||
      dbFile.upload_flow !== "broadcast_intent" ||
      dbFile.bucket !== "quarantine_images" ||
      !dbFile.object_path?.startsWith(expectedPathPrefix)
    ) {
      return NextResponse.json(
        { error: "File does not belong to this broadcast reservation" },
        { status: 403 },
      );
    }

    if (dbFile.status !== "pending_upload" && dbFile.status !== "uploaded") {
      return NextResponse.json(
        { error: "File is not pending validation" },
        { status: 400 },
      );
    }

    try {
      await transitionFileLifecycle({
        fileId: dbFile.id,
        organizationId: orgAuth.orgId,
        from: [dbFile.status],
        to: "validating",
      });
    } catch (e) {
      return NextResponse.json(
        { error: "File already being processed or not found" },
        { status: 409 },
      );
    }

    const { data: signed, error: signErr } = await sb.storage
      .from("quarantine_images")
      .createSignedUrl(dbFile.object_path, 60);

    if (signErr) {
      await transitionFileLifecycle({
        fileId: dbFile.id,
        organizationId: orgAuth.orgId,
        from: "validating",
        to: "retryable_failed",
        metadata: { last_error_message: "Failed to get signed URL" },
      });
      throw signErr;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(signed.signedUrl, {
      signal: controller.signal,
      redirect: "error",
    });
    clearTimeout(timeoutId);

    const MAX_SIZE = 5 * 1024 * 1024;
    const { buffer } = await downloadWithLimit(resp, MAX_SIZE);

    const validation = validateMagicBytes(buffer, dbFile.safe_extension);
    if (!validation.valid) {
      await transitionFileLifecycle({
        fileId: dbFile.id,
        organizationId: orgAuth.orgId,
        from: "validating",
        to: "rejected",
        metadata: { last_error_code: validation.error },
      });
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Reprocess image with sharp (strips metadata, validates full content)
    let processedBuffer;
    let format =
      dbFile.safe_extension === "png"
        ? "png"
        : dbFile.safe_extension === "webp"
          ? "webp"
          : "jpeg";
    try {
      processedBuffer = await sharp(buffer)
        .resize({
          width: 2048,
          height: 2048,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat(format, { quality: 85 })
        .toBuffer();
    } catch (e) {
      await transitionFileLifecycle({
        fileId: dbFile.id,
        organizationId: orgAuth.orgId,
        from: "validating",
        to: "rejected",
        metadata: { last_error_code: "Image decoding failed" },
      });
      return NextResponse.json(
        { error: "Invalid image content" },
        { status: 400 },
      );
    }

    const publicBucket = "images";
    const finalSize = processedBuffer.length;

    try {
      await adjustFileReservedCapacity(orgAuth.orgId, dbFile.id, finalSize);
    } catch (capacityError) {
      await markFilePendingDelete(
        dbFile.id,
        orgAuth.orgId,
        "final_size_capacity_rejected",
      );
      if (/LIMIT_EXCEEDED|NOT_CONFIGURED/i.test(capacityError?.message || "")) {
        return NextResponse.json(
          { error: capacityError.message },
          { status: 409 },
        );
      }
      throw capacityError;
    }

    // Save reference before upload to compensate if upload succeeds but DB update fails later
    await transitionFileLifecycle({
      fileId: dbFile.id,
      organizationId: orgAuth.orgId,
      from: "validating",
      to: "processing",
      metadata: {
        public_bucket: publicBucket,
        public_object_path: dbFile.object_path,
      },
    });

    // Upload processed to public bucket
    const { error: uploadErr } = await sb.storage
      .from(publicBucket)
      .upload(dbFile.object_path, processedBuffer, {
        contentType: `image/${format}`,
        upsert: false,
      });

    if (uploadErr) {
      await transitionFileLifecycle({
        fileId: dbFile.id,
        organizationId: orgAuth.orgId,
        from: "processing",
        to: "retryable_failed",
        metadata: { last_error_message: uploadErr.message.substring(0, 200) },
      });
      throw new Error(`Failed to publish image: ${uploadErr.message}`);
    }

    const sha256 = require("crypto")
      .createHash("sha256")
      .update(processedBuffer)
      .digest("hex");

    try {
      await transitionFileLifecycle({
        fileId: dbFile.id,
        organizationId: orgAuth.orgId,
        from: "processing",
        to: "validated",
        metadata: {
          bucket: publicBucket,
          checksum_sha256: sha256,
          validation_completed_at: new Date().toISOString(),
        },
      });
    } catch (dbErr) {
      // DB failed after upload succeeded!
      // Attempt a compensating delete of the public object
      const { error: delErr } = await sb.storage
        .from(publicBucket)
        .remove([dbFile.object_path]);
      if (delErr) {
        // If we also can't delete it, the cron worker will eventually reconcile it
        // since the DB is stuck in "processing" and has public_bucket/path.
        logger.error(
          "file_cleanup_compensation_failed",
          {
            provider: "supabase",
            operation: "public_image_delete",
            outcome: "failed",
            fileId: dbFile.id,
            organizationId: orgAuth.orgId,
          },
          delErr,
        );
      }
      throw dbErr;
    }

    // Delete from quarantine (best effort, cron will sweep if fails)
    await sb.storage.from("quarantine_images").remove([dbFile.object_path]);

    return NextResponse.json(
      {
        success: true,
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${publicBucket}/${dbFile.object_path}`,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to finalize broadcast image");
  }
}
