import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireOwnedOrg, handleApiError } from "@/lib/auth/guards";
import { getFileById } from "@/lib/repos/files.repo";
import { downloadWithLimit } from "@/lib/security/streamReader";
import { validateMagicBytes } from "@/lib/security/magicBytes";
import sharp from "sharp";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req) {
  try {
    const { orgId, fileId } = await req.json();

    if (!orgId || !fileId) {
      return NextResponse.json({ error: "Missing orgId or fileId" }, { status: 400 });
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const dbFile = await getFileById(fileId).catch(() => null);
    if (!dbFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    if (dbFile.organization_id !== orgAuth.orgId) {
      return NextResponse.json({ error: "File does not belong to this organization" }, { status: 403 });
    }

    if (dbFile.status !== "pending_upload" && dbFile.status !== "uploaded") {
      return NextResponse.json({ error: "File is not pending validation" }, { status: 400 });
    }

    const { data: signed, error: signErr } = await sb.storage
      .from("quarantine_images")
      .createSignedUrl(dbFile.object_path, 60);

    if (signErr) throw signErr;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(signed.signedUrl, { signal: controller.signal, redirect: "error" });
    clearTimeout(timeoutId);

    const MAX_SIZE = 5 * 1024 * 1024;
    const { buffer } = await downloadWithLimit(resp, MAX_SIZE);
    
    const validation = validateMagicBytes(buffer, dbFile.safe_extension);
    if (!validation.valid) {
      await sb.from("file").update({ status: "rejected", last_error_code: validation.error }).eq("id", dbFile.id);
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Reprocess image with sharp (strips metadata, validates full content)
    let processedBuffer;
    let format = dbFile.safe_extension === "png" ? "png" : dbFile.safe_extension === "webp" ? "webp" : "jpeg";
    try {
      processedBuffer = await sharp(buffer)
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .toFormat(format, { quality: 85 })
        .toBuffer();
    } catch (e) {
      await sb.from("file").update({ status: "rejected", last_error_code: "Image decoding failed" }).eq("id", dbFile.id);
      return NextResponse.json({ error: "Invalid image content" }, { status: 400 });
    }

    // Upload processed to public bucket
    const publicBucket = "images";
    const { error: uploadErr } = await sb.storage
      .from(publicBucket)
      .upload(dbFile.object_path, processedBuffer, {
        contentType: `image/${format}`,
        upsert: false
      });
      
    if (uploadErr) {
      throw new Error(`Failed to publish image: ${uploadErr.message}`);
    }

    // Delete from quarantine
    await sb.storage.from("quarantine_images").remove([dbFile.object_path]);

    const finalSize = processedBuffer.length;
    const sha256 = require("crypto").createHash("sha256").update(processedBuffer).digest("hex");

    await sb.from("file").update({
      status: "validated",
      bucket: publicBucket,
      size_bytes: finalSize,
      checksum_sha256: sha256,
      validation_completed_at: new Date().toISOString()
    }).eq("id", dbFile.id);

    return NextResponse.json({
      success: true,
      url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${publicBucket}/${dbFile.object_path}`
    }, { status: 200 });

  } catch (err) {
    return handleApiError(err, "Failed to finalize broadcast image");
  }
}
