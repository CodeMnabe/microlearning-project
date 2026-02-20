import { NextResponse } from "next/server";
import { getBotToken } from "@/lib/teams/auth";
import { getUserTeamsConversation } from "@/lib/repos/teamConversations.repo";
import { getOrganization } from "@/lib/repos/organizations.repo";

function isImageType(ct = "") {
  return String(ct).toLowerCase().startsWith("image/");
}
function isVideoType(ct = "") {
  return String(ct).toLowerCase().startsWith("video/");
}

function guessContentTypeFromUrl(url = "") {
  const u = String(url || "").toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".gif")) return "image/gif";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".pdf")) return "application/pdf";
  if (u.endsWith(".mp4")) return "video/mp4";
  if (u.endsWith(".mov")) return "video/quicktime";
  if (u.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

function filenameFromUrl(url = "") {
  try {
    const last = String(url).split("?")[0].split("#")[0].split("/").pop();
    return last || "file";
  } catch {
    return "file";
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      orgId,
      userIds = [],
      message = "",
      files = [], // [{ url, name, contentType, thumbnailUrl? }]
      imageUrls = [], // backwards compat
    } = body;

    if (!orgId || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "Missing orgId or userIds" },
        { status: 400 },
      );
    }

    // Normalize inputs into [{url,name,contentType,thumbnailUrl?}]
    const normalizedFiles = [
      ...(Array.isArray(files) ? files : []),
      ...(Array.isArray(imageUrls) ? imageUrls : []).map((url) => ({
        url,
        name: filenameFromUrl(url),
        contentType: guessContentTypeFromUrl(url),
      })),
    ]
      .filter((f) => f?.url)
      .map((f) => ({
        url: f.url,
        name: f.name || filenameFromUrl(f.url),
        contentType: f.contentType || guessContentTypeFromUrl(f.url),
        thumbnailUrl: f.thumbnailUrl || null, // for videos
      }));

    if (!String(message || "").trim() && normalizedFiles.length === 0) {
      return NextResponse.json(
        { error: "Message or files must be provided" },
        { status: 400 },
      );
    }

    const org = await getOrganization(orgId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 },
      );
    }

    const results = [];

    for (const userId of userIds) {
      const conv = await getUserTeamsConversation(userId);
      if (!conv) {
        results.push({
          userId,
          ok: false,
          error: "No Teams conversation found for this user.",
        });
        continue;
      }

      try {
        const token = await getBotToken(conv.tenant_id);

        const endpoint = `${conv.service_url.replace(/\/$/, "")}/v3/conversations/${conv.conversation_id}/activities`;

        const imageFiles = normalizedFiles.filter((f) =>
          isImageType(f.contentType),
        );
        const videoFiles = normalizedFiles.filter((f) =>
          isVideoType(f.contentType),
        );
        const otherFiles = normalizedFiles.filter(
          (f) => !isImageType(f.contentType) && !isVideoType(f.contentType),
        );

        // 1) inline images
        const imageAttachments = imageFiles.map((f) => ({
          contentType: f.contentType || "image/png",
          contentUrl: f.url,
          name: f.name || "image",
        }));

        // 2) video cards (Option B)
        // Works even without thumbnailUrl (card will just show title + button)
        const videoCardAttachments = videoFiles.map((f) => {
          const hasThumb = Boolean(f.thumbnailUrl);
          return {
            contentType: "application/vnd.microsoft.card.hero",
            content: {
              title: f.name || "Video",
              ...(hasThumb ? { images: [{ url: f.thumbnailUrl }] } : {}),
              buttons: [
                {
                  type: "openUrl",
                  title: "▶ Ver vídeo",
                  value: f.url,
                },
              ],
            },
          };
        });

        // 3) other files as clean links (no bullets, no “Files:”)
        let text = String(message || "").trim();

        if (otherFiles.length) {
          const links = otherFiles
            .map((f) => `[${f.name || "file"}](${f.url})`)
            .join("\n");
          text = [text, links].filter(Boolean).join("\n\n");
        }

        if (!text) text = " ";

        const payload = {
          type: "message",
          text,
          textFormat: "markdown",
          attachments: [...imageAttachments, ...videoCardAttachments],
        };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const raw = await res.text();
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }

        results.push({ userId, ok: res.ok, status: res.status, data });
      } catch (err) {
        results.push({ userId, ok: false, error: err.message });
      }
    }

    return NextResponse.json({
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    console.error("Teams broadcast error (top-level):", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
