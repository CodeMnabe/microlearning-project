import { describe, expect, it } from "vitest";
import { buildBroadcastImageKey } from "@/lib/uploads/broadcastImages";

describe("buildBroadcastImageKey", () => {
  it("põe a organização na segunda pasta e limpa o nome do ficheiro", () => {
    const key = buildBroadcastImageKey(12, "relatório final.png");
    expect(key).toMatch(/^broadcasts\/12\/\d+-[a-z0-9]+-relatorio_final\.png$/);
  });

  it("recusa gerar caminho sem organização", () => {
    expect(() => buildBroadcastImageKey(undefined, "a.png")).toThrow();
  });

  it("recusa uma organização que tente sair da pasta", () => {
    expect(() => buildBroadcastImageKey("12/../13", "a.png")).toThrow();
  });
});
