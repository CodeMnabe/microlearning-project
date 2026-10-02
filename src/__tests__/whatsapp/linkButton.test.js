import { describe, expect, it } from "vitest";
import {
  LINK_BUTTON_TEXT_MAX_LENGTH,
  buildLinkButtonActions,
  linkButtonText,
  pickLinkButton,
} from "@/lib/whatsapp/linkButton";

const GUIA = {
  key: "guia",
  label: "Guia passo a passo",
  trackedUrl: "https://www.mydigitalbot.com/r/abc",
};

const CURSO = {
  key: "curso",
  label: "Curso completo",
  trackedUrl: "https://www.mydigitalbot.com/r/def",
};

describe("pickLinkButton", () => {
  it("tira o link do texto e devolve-o como botão", () => {
    const result = pickLinkButton({
      message: "Ativa hoje a MFA.\nGuia: {{link.guia}}\nSe tiveres dúvidas, responde.",
      trackedLinks: [GUIA],
    });

    expect(result).toEqual({
      link: GUIA,
      buttonText: "Guia passo a passo",
      message: "Ativa hoje a MFA.\nGuia:\nSe tiveres dúvidas, responde.",
    });
  });

  it("escolhe o primeiro link pela ordem do texto e deixa os outros no texto", () => {
    const result = pickLinkButton({
      message: "Primeiro {{link.curso}} e depois {{link.guia}}",
      trackedLinks: [GUIA, CURSO],
    });

    expect(result.link).toBe(CURSO);
    expect(result.message).toBe("Primeiro e depois {{link.guia}}");
  });

  it("não deixa linhas vazias a mais onde estava o link", () => {
    const result = pickLinkButton({
      message: "Olá!\n\n{{link.guia}}\n\nAté já.",
      trackedLinks: [GUIA],
    });

    expect(result.message).toBe("Olá!\n\nAté já.");
  });

  it.each([
    ["quiz ou sondagem", { hasReplyButtons: true }],
    ["mensagem com imagem", { hasImages: true }],
  ])("deixa o link no texto numa %s", (_, flags) => {
    expect(
      pickLinkButton({
        message: "Vê o guia: {{link.guia}}",
        trackedLinks: [GUIA],
        ...flags,
      }),
    ).toBeNull();
  });

  it("deixa o link no texto quando a mensagem é só o link", () => {
    expect(
      pickLinkButton({ message: "  {{link.guia}}\n", trackedLinks: [GUIA] }),
    ).toBeNull();
  });

  it("ignora links que não estão no texto", () => {
    expect(
      pickLinkButton({ message: "Sem links aqui.", trackedLinks: [GUIA] }),
    ).toBeNull();
  });

  it("ignora links sem nome, porque o botão ficaria sem texto", () => {
    expect(
      pickLinkButton({
        message: "Vê: {{link.guia}}",
        trackedLinks: [{ ...GUIA, label: "   " }],
      }),
    ).toBeNull();
  });
});

describe("linkButtonText", () => {
  it("mantém um nome curto", () => {
    expect(linkButtonText("Abrir guia")).toBe("Abrir guia");
  });

  it("corta um nome longo no limite do WhatsApp", () => {
    const text = linkButtonText("Guia passo a passo da autenticação");

    expect(text).toBe("Guia passo a passo…");
    expect(text.length).toBeLessThanOrEqual(LINK_BUTTON_TEXT_MAX_LENGTH);
  });
});

describe("buildLinkButtonActions", () => {
  it("monta a ação de link no formato do Bird", () => {
    expect(buildLinkButtonActions("Abrir guia", GUIA.trackedUrl)).toEqual([
      { type: "link", link: { text: "Abrir guia", url: GUIA.trackedUrl } },
    ]);
  });
});
