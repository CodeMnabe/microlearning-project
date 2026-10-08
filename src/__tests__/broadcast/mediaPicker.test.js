import { describe, expect, it } from "vitest";
import { mediaForPicker } from "@/app/[locale]/(app)/broadcast/lib/mediaPicker";

const items = [
  { url: "u/a.png", name: "a.png", contentType: "image/png" },
  { url: "u/b.pdf", name: "b.pdf", contentType: "application/pdf" },
  { url: "u/c.mp4", name: "c.mp4", contentType: "video/mp4" },
  { url: "u/d.jpeg", name: "d.jpeg", contentType: "image/jpeg" },
];

describe("mediaForPicker", () => {
  it("só mostra os ficheiros do tipo escolhido no menu", () => {
    expect(mediaForPicker(items, "image").map((i) => i.name)).toEqual([
      "a.png",
      "d.jpeg",
    ]);
    expect(mediaForPicker(items, "document").map((i) => i.name)).toEqual([
      "b.pdf",
    ]);
  });

  it("marca os ficheiros que já estão na mensagem", () => {
    const result = mediaForPicker(items, "image", ["u/d.jpeg"]);
    expect(result.map((i) => i.attached)).toEqual([false, true]);
  });
});
