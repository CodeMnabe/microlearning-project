/**
 * Anexos e upload da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */
/**
 * Verifica se um content type representa uma imagem.
 *
 * Usado para separar anexos por tipo e preparar previews/payloads.
 */
export function isImageContentType(contentType = "") {
  return String(contentType).toLowerCase().startsWith("image/");
}

/**
 * Verifica se um content type representa um vídeo.
 *
 * Usado para permitir tratamento específico, como thumbnails.
 */
export function isVideoContentType(contentType = "") {
  return String(contentType).toLowerCase().startsWith("video/");
}

/**
 * Tenta inferir o content type a partir do nome do ficheiro.
 *
 * Usado como fallback quando o browser não fornece `file.type`.
 */
export function guessContentTypeFromName(name = "") {
  const normalizedName = String(name || "").toLowerCase();

  if (normalizedName.endsWith(".png")) return "image/png";
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalizedName.endsWith(".gif")) return "image/gif";
  if (normalizedName.endsWith(".webp")) return "image/webp";
  if (normalizedName.endsWith(".pdf")) return "application/pdf";
  if (normalizedName.endsWith(".mp4")) return "video/mp4";
  if (normalizedName.endsWith(".mov")) return "video/quicktime";
  if (normalizedName.endsWith(".webm")) return "video/webm";

  return "application/octet-stream";
}

/**
 * Converte o nome de um ficheiro num formato seguro para storage.
 *
 * Remove acentos e substitui caracteres problemáticos por underscores.
 */
export function makeSafeFileName(name) {
  let safe = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!safe) safe = "file";

  return safe;
}

/**
 * Cria a key usada no storage para ficheiros de Broadcast.
 *
 * Inclui timestamp e valor aleatório para reduzir colisões.
 */
export function makeBroadcastStorageKey(fileName) {
  const safeName = makeSafeFileName(fileName);

  return `broadcasts/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${safeName}`;
}

/**
 * Faz upload de ficheiros do Broadcast para o storage.
 *
 * Esta função devolve objetos normalizados com os dados necessários
 * para envio, como url, nome e contentType.
 */
export async function uploadBroadcastFiles({
  supabase,
  files,
  bucket = "images",
}) {
  const uploaded = [];

  for (const file of files || []) {
    const key = makeBroadcastStorageKey(file.name);
    const contentType = file.type || guessContentTypeFromName(file.name);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(key, file, {
        upsert: true,
        contentType,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(key);

    if (publicData?.publicUrl) {
      uploaded.push({
        url: publicData.publicUrl,
        name: file.name || makeSafeFileName(file.name),
        contentType: contentType || "application/octet-stream",
      });
    }
  }

  return uploaded;
}
