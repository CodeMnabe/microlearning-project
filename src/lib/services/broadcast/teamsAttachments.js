import { isImageType, isVideoType } from "./shared";

/**
 * Ficheiros de uma mensagem do Teams, iguais para pessoas e grupos (#166):
 * imagens como anexo, vídeos num cartão com botão e o resto como links no
 * fim do texto.
 */
export function buildTeamsFileParts(normalizedFiles = []) {
  const imageAttachments = normalizedFiles
    .filter((f) => isImageType(f.contentType))
    .map((f) => ({
      contentType: f.contentType || "image/png",
      contentUrl: f.url,
      name: f.name || "image",
    }));

  const videoCardAttachments = normalizedFiles
    .filter((f) => isVideoType(f.contentType))
    .map((f) => ({
      contentType: "application/vnd.microsoft.card.hero",
      content: {
        title: f.name || "Video",
        ...(f.thumbnailUrl ? { images: [{ url: f.thumbnailUrl }] } : {}),
        buttons: [{ type: "openUrl", title: "▶ Ver vídeo", value: f.url }],
      },
    }));

  const linksText = normalizedFiles
    .filter((f) => !isImageType(f.contentType) && !isVideoType(f.contentType))
    .map((f) => `[${f.name || "file"}](${f.url})`)
    .join("\n");

  return {
    attachments: [...imageAttachments, ...videoCardAttachments],
    linksText,
  };
}
