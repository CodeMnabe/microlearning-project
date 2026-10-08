import { describe, expect, it } from "vitest";

import {
  filterTrackedLinkLibrary,
  isSameTrackedLink,
  makeTrackedLinkFromLibrary,
  uniqueTrackedKey,
} from "@/app/[locale]/(app)/broadcast/lib/helpers";

const GUIA = {
  key: "guia",
  label: "Guia MFA",
  destinationUrl: "https://exemplo.pt/mfa",
};

describe("isSameTrackedLink", () => {
  it("compara nome e destino, ignorando espaços à volta", () => {
    expect(
      isSameTrackedLink(GUIA, {
        key: "outra_chave",
        label: " Guia MFA ",
        destinationUrl: "https://exemplo.pt/mfa ",
      }),
    ).toBe(true);
  });

  it("trata o mesmo destino com outro nome como outro link", () => {
    expect(isSameTrackedLink(GUIA, { ...GUIA, label: "Guia" })).toBe(false);
  });
});

describe("uniqueTrackedKey", () => {
  it("mantém a chave quando está livre", () => {
    expect(uniqueTrackedKey("guia", ["curso"])).toBe("guia");
  });

  it("acrescenta um número quando a chave já está a ser usada", () => {
    expect(uniqueTrackedKey("guia", ["guia", "guia_2"])).toBe("guia_3");
  });

  it("limpa a chave e usa 'link' quando não sobra nada", () => {
    expect(uniqueTrackedKey("Guia MFA", [])).toBe("guia_mfa");
    expect(uniqueTrackedKey("!!!", [])).toBe("link");
  });
});

describe("makeTrackedLinkFromLibrary", () => {
  it("cria um link novo no composer com o nome e o destino escolhidos", () => {
    const draft = makeTrackedLinkFromLibrary(GUIA, []);

    expect(draft).toMatchObject({
      key: "guia",
      label: "Guia MFA",
      destinationUrl: "https://exemplo.pt/mfa",
    });
    expect(draft.id).toBeTruthy();
  });

  it("não repete uma chave que já está no composer", () => {
    const draft = makeTrackedLinkFromLibrary(GUIA, [
      { id: "1", key: "guia", label: "Outro", destinationUrl: "https://o.pt" },
    ]);

    expect(draft.key).toBe("guia_2");
  });

  it("tira a chave do nome quando o link antigo não a tem", () => {
    expect(makeTrackedLinkFromLibrary({ ...GUIA, key: "" }, []).key).toBe(
      "guia_mfa",
    );
  });
});

describe("filterTrackedLinkLibrary", () => {
  const ITEMS = [
    GUIA,
    { key: "curso", label: "Formação Excel", destinationUrl: "https://c.pt" },
  ];

  it("devolve tudo sem pesquisa", () => {
    expect(filterTrackedLinkLibrary(ITEMS, "  ")).toEqual(ITEMS);
  });

  it("procura no nome e no destino, sem ligar a maiúsculas nem acentos", () => {
    expect(filterTrackedLinkLibrary(ITEMS, "formacao")).toEqual([ITEMS[1]]);
    expect(filterTrackedLinkLibrary(ITEMS, "EXEMPLO.pt")).toEqual([GUIA]);
  });
});
