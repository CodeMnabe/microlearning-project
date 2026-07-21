import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireOrgForAssistant, handleApiError } from "@/lib/auth/guards";
import { createDBFiles } from "@/lib/repos/files.repo";
import { randomUUID } from "crypto";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILES = 10;
const DOCUMENT_STORAGE_BUCKET = "documents";

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/octet-stream"
];

function getSafeExtension(filename) {
  if (!filename) return "bin";
  const parts = filename.split(".");
  if (parts.length < 2) return "bin";
  const ext = parts.pop().toLowerCase();
  if (["pdf", "docx", "txt", "csv"].includes(ext)) {
    return ext;
  }
  return "bin";
}

export async function POST(req, ctx) {
  try {
    const { assistantId } = await ctx.params;
    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const body = await req.json();
    const files = body.files;

    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) {
      return NextResponse.json({ error: `Must provide between 1 and ${MAX_FILES} files.` }, { status: 400 });
    }

    const toInsert = [];
    for (const f of files) {
      const size = Number(f.size);
      if (isNaN(size) || size <= 0 || size > MAX_SIZE) {
        return NextResponse.json({ error: `File size must be > 0 and <= 20MB for ${f.name}` }, { status: 400 });
      }

      const mimeType = f.type || "application/octet-stream";
      if (!ALLOWED_MIME.includes(mimeType)) {
        return NextResponse.json({ error: `File type ${mimeType} not allowed.` }, { status: 400 });
      }

      const safeExt = getSafeExtension(f.name);
      const fileUuid = randomUUID();
      const objectPath = `${orgAuth.orgId}/${assistantId}/${fileUuid}.${safeExt}`;

      toInsert.push({
        organization_id: orgAuth.orgId,
        assistant_id: Number(assistantId),
        bucket: DOCUMENT_STORAGE_BUCKET,
        object_path: objectPath,
        original_name: f.name,
        safe_extension: safeExt,
        mime_type: mimeType,
        size_bytes: size,
        status: "pending_upload",
        upload_flow: "document_intent",
        // file.repo expects name and size for compatibility
        name: f.name,
        size: size,
      });
    }

    const insertedRows = await createDBFiles(toInsert, null);

    const result = [];
    for (const row of insertedRows) {
      // Generate Signed Upload URL
      const { data, error: signErr } = await sb.storage
        .from(DOCUMENT_STORAGE_BUCKET)
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

    return NextResponse.json({ files: result }, { status: 200 });

  } catch (err) {
    return handleApiError(err, "Failed to create upload intent");
  }
}
