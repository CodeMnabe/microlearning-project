import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTrackedLinkLibraryByOrg: vi.fn(),
}));

vi.mock("@/lib/repos/trackedLinks.repo", () => ({
  createTrackedLink: vi.fn(),
  getTrackedLinkLibraryByOrg: (...args) =>
    mocks.getTrackedLinkLibraryByOrg(...args),
}));

import { listReusableTrackedLinks } from "@/lib/services/broadcast/trackedLinks";

function row(overrides = {}) {
  return {
    link_key: "guia",
    link_label: "Guia MFA",
    destination_url: "https://exemplo.pt/mfa",
    last_used_at: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

describe("listReusableTrackedLinks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve os links da organização no formato do composer", async () => {
    mocks.getTrackedLinkLibraryByOrg.mockResolvedValue([row()]);

    const items = await listReusableTrackedLinks(7);

    expect(mocks.getTrackedLinkLibraryByOrg).toHaveBeenCalledWith(7);
    expect(items).toEqual([
      {
        key: "guia",
        label: "Guia MFA",
        destinationUrl: "https://exemplo.pt/mfa",
        lastUsedAt: "2026-10-01T10:00:00Z",
      },
    ]);
  });

  it("junta links que só diferem em espaços, ficando com o mais recente", async () => {
    mocks.getTrackedLinkLibraryByOrg.mockResolvedValue([
      row({ link_key: "novo" }),
      row({
        link_key: "antigo",
        link_label: " Guia MFA ",
        last_used_at: "2026-09-01T10:00:00Z",
      }),
    ]);

    const items = await listReusableTrackedLinks(7);

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("novo");
  });

  it("esconde links sem nome ou com um destino que o envio recusaria", async () => {
    mocks.getTrackedLinkLibraryByOrg.mockResolvedValue([
      row({ link_label: "" }),
      row({ destination_url: "javascript:alert(1)" }),
      row({ link_label: "Válido", destination_url: "http://ok.pt" }),
    ]);

    const items = await listReusableTrackedLinks(7);

    expect(items.map((item) => item.label)).toEqual(["Válido"]);
  });
});
