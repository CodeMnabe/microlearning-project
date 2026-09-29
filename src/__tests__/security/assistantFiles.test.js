import { describe, expect, it } from "vitest";
import { resolveAssistantFileType } from "@/lib/uploads/assistantFiles";

describe("resolveAssistantFileType", () => {
  it("resolve Markdown pela extensão quando o MIME está vazio", () => {
    expect(resolveAssistantFileType({ name: "manual.md", type: "" })).toBe("text/markdown");
  });

  it("rejeita uma extensão não aceite com MIME genérico", () => {
    expect(resolveAssistantFileType({ name: "sessao.har", type: "application/octet-stream" })).toBeNull();
  });
});
