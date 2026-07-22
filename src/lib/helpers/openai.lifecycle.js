import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createOpenAiFileLifecycle(file) {
  try {
    const uploadedFile = await client.files.create({
      file, 
      purpose: "assistants",
    });
    return { ok: true, value: uploadedFile };
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      if (err.status >= 500 || err.status === 429) {
        return { ok: false, outcome: "retryable_failed", code: err.code || err.status.toString(), message: err.message };
      }
      return { ok: false, outcome: "permanent_failed", code: err.code || err.status.toString(), message: err.message };
    }
    return { ok: false, outcome: "unknown_outcome", code: "network_error", message: err.message };
  }
}

export async function deleteOpenAiFileLifecycle(fileId) {
  if (!fileId) return { ok: true, value: { deleted: true } };
  
  try {
    let res;
    if (client.files?.del) res = await client.files.del(fileId); 
    else if (client.files?.delete) res = await client.files.delete(fileId);
    else {
      const response = await client.core.fetch(
        `https://api.openai.com/v1/files/${fileId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        if (response.status === 404) return { ok: true, value: { deleted: true } };
        throw new Error(`HTTP ${response.status}`);
      }
      res = await response.json();
    }
    return { ok: true, value: res };
  } catch (err) {
    if (err instanceof OpenAI.APIError && err.status === 404) {
      return { ok: true, value: { deleted: true } };
    }
    if (err.status === 404) {
      return { ok: true, value: { deleted: true } };
    }
    if (err instanceof OpenAI.APIError) {
      if (err.status >= 500 || err.status === 429) {
        return { ok: false, outcome: "retryable_failed", code: err.code || err.status.toString(), message: err.message };
      }
      return { ok: false, outcome: "permanent_failed", code: err.code || err.status.toString(), message: err.message };
    }
    return { ok: false, outcome: "unknown_outcome", code: "network_error", message: err.message };
  }
}
