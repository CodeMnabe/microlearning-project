import { openai } from "@/lib/openai/client";

/**
 * Upload a file to OpenAI.
 *
 * Files are still real OpenAI resources even though
 * OpenAI Assistants no longer exist in our architecture.
 */
export async function createOpenAiFile(file) {
  try {
    return await openai.files.create({
      file,
      purpose: "user_data",
    });
  } catch (err) {
    console.error("[OpenAI File Upload] failed:", err);

    throw err;
  }
}

/**
 * Create an OpenAI Vector Store from already
 * uploaded OpenAI file IDs.
 */
export async function createOpenAiVectorStore(storeName, uploadedFileIds) {
  const cleanName = typeof storeName === "string" ? storeName.trim() : "";

  if (!cleanName) {
    throw new Error("Vector store name cannot be empty");
  }

  if (!Array.isArray(uploadedFileIds) || uploadedFileIds.length === 0) {
    throw new Error("At least one OpenAI file ID is required");
  }

  const fileIds = uploadedFileIds
    .map((fileId) => String(fileId || "").trim())
    .filter(Boolean);

  if (!fileIds.length) {
    throw new Error("At least one valid OpenAI file ID is required");
  }

  try {
    return await openai.vectorStores.create({
      name: cleanName,

      file_ids: fileIds,
    });
  } catch (err) {
    console.error("[OpenAI Vector Store Create] failed:", err);

    throw err;
  }
}

/**
 * Delete an OpenAI Vector Store and the files
 * belonging to it.
 */
export async function deleteOpenAiVectorStoreAndFiles(
  vectorStoreId,
  fileIds = [],
) {
  const cleanFileIds = Array.isArray(fileIds)
    ? fileIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  /*
   * Delete the files first.
   */
  for (const fileId of cleanFileIds) {
    try {
      await openai.files.delete(fileId);
    } catch (err) {
      console.error(`[OpenAI File Delete] failed for ${fileId}:`, err);

      throw err;
    }
  }

  const cleanVectorStoreId = String(vectorStoreId || "").trim();

  if (!cleanVectorStoreId) {
    return;
  }

  /*
   * Delete the vector store itself.
   */
  try {
    await openai.vectorStores.delete(cleanVectorStoreId);
  } catch (err) {
    console.error(
      `[OpenAI Vector Store Delete] failed for ${cleanVectorStoreId}:`,
      err,
    );

    throw err;
  }
}
