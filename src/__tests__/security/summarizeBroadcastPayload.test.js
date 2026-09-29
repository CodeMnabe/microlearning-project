import { describe, expect, it } from "vitest";
import { summarizeBroadcastPayload } from "@/lib/logging/summarizeBroadcastPayload";

describe("resumo do payload de broadcast", () => {
  it("devolve contagens sem incluir texto nem contactos", () => {
    const summary = summarizeBroadcastPayload({
      message: "Olá João",
      recipients: [{ phone: "+351..." }, { userId: 5 }],
      files: [{}],
    });
    expect(summary).toEqual({
      orgId: undefined,
      recipientCount: 2,
      userIdCount: 0,
      messageLength: 8,
      hasFiles: true,
      hasQuestion: false,
    });
    expect(JSON.stringify(summary)).not.toContain("+351");
    expect(JSON.stringify(summary)).not.toContain("Olá");
  });

  it("aceita um payload vazio", () => {
    expect(summarizeBroadcastPayload({})).toEqual({
      orgId: undefined,
      recipientCount: 0,
      userIdCount: 0,
      messageLength: 0,
      hasFiles: false,
      hasQuestion: false,
    });
  });
});
