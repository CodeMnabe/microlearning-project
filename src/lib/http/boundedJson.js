import "server-only";

export class RequestBodyError extends Error {
  constructor(code, status) {
    super(code);
    this.name = "RequestBodyError";
    this.code = code;
    this.status = status;
  }
}

function isJsonContentType(value) {
  return /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
    String(value || "").trim(),
  );
}

export async function readBoundedJson(request, maximumBytes) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError("maximumBytes must be a positive integer");
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new RequestBodyError("unsupported_content_type", 415);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new RequestBodyError("invalid_content_length", 400);
    }
    if (parsed > maximumBytes) {
      throw new RequestBodyError("body_too_large", 413);
    }
  }

  if (!request.body) throw new RequestBodyError("invalid_json", 400);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError("body_too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("invalid_json", 400);
  }
}
