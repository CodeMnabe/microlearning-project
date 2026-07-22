import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireOwnedOrg, handleApiError } from "@/lib/auth/guards";
import {
  markFilePendingDelete,
  reserveFileCapacity,
} from "@/lib/repos/files.repo";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const QUARANTINE_BUCKET = "quarantine_images";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

function getSafeExtension(filename) {
  if (!filename) return "bin";
  const parts = filename.split(".");
  if (parts.length < 2) return "bin";
  const ext = parts.pop().toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return ext === "jpg" ? "jpeg" : ext;
  }
  return "bin";
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { orgId, files, reservationKey } = body;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    if (typeof reservationKey !== "string" || !UUID_PATTERN.test(reservationKey)) {
      return NextResponse.json({ error: "A valid reservationKey is required." }, { status: 400 });
    }

    if (!Array.isArray(files) || files.length === 0 || files.length > 5) {
      return NextResponse.json({ error: "Must provide between 1 and 5 files." }, { status: 400 });
    }

    const toInsert = [];
    const result = [];

    for (const [index, f] of files.entries()) {
      const size = Number(f.size);
      if (isNaN(size) || size <= 0 || size > MAX_SIZE) {
        return NextResponse.json({ error: `File size must be > 0 and <= 5MB for ${f.name}` }, { status: 400 });
      }

      const mimeType = f.type;
      if (!ALLOWED_MIME.includes(mimeType)) {
        return NextResponse.json({ error: `File type ${mimeType} not allowed. Use JPEG, PNG, or WebP.` }, { status: 400 });
      }

      const safeExt = getSafeExtension(f.name);
      const objectPath = `broadcasts/${orgAuth.orgId}/${reservationKey}-${index}.${safeExt}`;

      const rowPayload = {
        organization_id: orgAuth.orgId,
        bucket: QUARANTINE_BUCKET,
        object_path: objectPath,
        original_name: f.name,
        safe_extension: safeExt,
        mime_type: mimeType,
        size_bytes: size,
        reserved_bytes: MAX_SIZE,
        status: "pending_upload",
        upload_flow: "broadcast_intent",
        name: f.name,
        size: size,
      };
      toInsert.push(rowPayload);
    }

    const insertedRows = await reserveFileCapacity({
      organizationId: orgAuth.orgId,
      reservationKey,
      uploadFlow: "broadcast_intent",
      files: toInsert,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      requestedVectorStoreCount: 0,
    });

    try {
      for (const row of insertedRows) {
        const { data, error: signErr } = await sb.storage
          .from(QUARANTINE_BUCKET)
          .createSignedUploadUrl(row.object_path, { upsert: false });

        if (signErr) {
          throw new Error(`Failed to create signed upload url: ${signErr.message}`);
        }

        result.push({
          fileId: row.id,
          uploadUrl: data.signedUrl,
          name: row.original_name,
          size: row.size_bytes,
          type: row.mime_type
        });
      }
    } catch (error) {
      await Promise.allSettled(insertedRows.map((row) =>
        markFilePendingDelete(row.id, orgAuth.orgId, "signed_upload_url_failed")
      ));
      throw error;
    }

    return NextResponse.json({ reservationKey, files: result }, { status: 200 });

  } catch (err) {
    if (/LIMIT_EXCEEDED|reservation key conflicts/i.test(err?.message || "")) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (/FILE_CAPACITY_NOT_CONFIGURED/i.test(err?.message || "")) {
      return NextResponse.json({ error: "File capacity is not configured for this organization." }, { status: 503 });
    }
    return handleApiError(err, "Failed to create broadcast upload intent");
  }
}
