import { describe, expect, it } from "vitest";
import {
  LINK_BUTTON_TEXT_MAX_LENGTH,
  buildLinkButtonActions,
  chooseButtonLink,
  followUpBodies,
  isOnlyTrackedLinks,
  linkButtonText,
  pickLinkButton,
  planLinkMessages,
  withButtonLinksInText,
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

describe("link marcado como botão", () => {
  const BOTAO = { ...GUIA, button: true };

  it("vai como botão sem estar no texto, que fica como está", () => {
    expect(
      pickLinkButton({
        message: "Ativa hoje a MFA.\nSe tiveres dúvidas, responde.",
        trackedLinks: [BOTAO],
      }),
    ).toEqual({
      link: BOTAO,
      buttonText: "Guia passo a passo",
      message: "Ativa hoje a MFA.\nSe tiveres dúvidas, responde.",
    });
  });

  it("ganha ao primeiro link do texto, que fica no texto", () => {
    const result = pickLinkButton({
      message: "Vê também {{link.curso}}",
      trackedLinks: [CURSO, BOTAO],
    });

    expect(result.link).toBe(BOTAO);
    expect(result.message).toBe("Vê também {{link.curso}}");
  });

  it("sem texto não há botão, porque o WhatsApp exige corpo", () => {
    expect(
      pickLinkButton({ message: "  ", trackedLinks: [BOTAO] }),
    ).toBeNull();
  });

  it("chooseButtonLink escolhe o link mesmo com o texto vazio", () => {
    expect(chooseButtonLink("", [BOTAO])).toEqual({
      link: BOTAO,
      key: "guia",
      buttonText: "Guia passo a passo",
    });
  });

  it("um link marcado sem nome não serve de botão", () => {
    expect(
      chooseButtonLink("Texto", [{ ...BOTAO, label: " " }]),
    ).toBeNull();
  });
});

describe("planLinkMessages", () => {
  const BOTAO = { ...GUIA, button: true };
  const EXTRA = { ...CURSO, button: true };

  it("o primeiro link vai na mensagem e o outro num balão à parte", () => {
    expect(
      planLinkMessages({ message: "Boas, Leo!", trackedLinks: [BOTAO, EXTRA] }),
    ).toEqual({
      message: "Boas, Leo!",
      button: { link: BOTAO, buttonText: "Guia passo a passo" },
      extras: [{ link: EXTRA, buttonText: "Curso completo", text: "Curso completo" }],
    });
  });

  it("o balão à parte usa o texto escrito para ele", () => {
    const { extras } = planLinkMessages({
      message: "Boas!",
      trackedLinks: [BOTAO, { ...EXTRA, buttonMessage: "  Já viste o curso?  " }],
    });

    expect(extras[0].text).toBe("Já viste o curso?");
  });

  it.each([
    ["com imagem", { hasImages: true }],
    ["num quiz", { hasReplyButtons: true }],
  ])("%s, todos os links vão em balões à parte", (_, flags) => {
    const plan = planLinkMessages({
      message: "Vê isto.",
      trackedLinks: [BOTAO, EXTRA],
      ...flags,
    });

    expect(plan.message).toBe("Vê isto.");
    expect(plan.button).toBeNull();
    expect(plan.extras.map((extra) => extra.link)).toEqual([BOTAO, EXTRA]);
  });

  it("sem texto, o primeiro balão passa a ser a própria mensagem", () => {
    expect(
      planLinkMessages({ message: " ", trackedLinks: [BOTAO, EXTRA] }),
    ).toEqual({
      message: "Guia passo a passo",
      button: { link: BOTAO, buttonText: "Guia passo a passo" },
      extras: [{ link: EXTRA, buttonText: "Curso completo", text: "Curso completo" }],
    });
  });

  it("um link antigo no texto continua a ser o botão, sem balões", () => {
    const plan = planLinkMessages({
      message: "Guia: {{link.guia}}",
      trackedLinks: [GUIA],
    });

    expect(plan.message).toBe("Guia:");
    expect(plan.button.link).toBe(GUIA);
    expect(plan.extras).toEqual([]);
  });
});

describe("followUpBodies", () => {
  it("monta um balão de texto com botão para cada um", () => {
    const actions = buildLinkButtonActions("Curso", CURSO.trackedUrl);

    expect(followUpBodies([{ message: "Já viste?", actions }])).toEqual([
      { type: "text", text: { text: "Já viste?", actions } },
    ]);
  });

  it("ignora entradas sem texto ou sem botão", () => {
    expect(
      followUpBodies([
        { message: "", actions: [{ type: "link" }] },
        { message: "Sem botão", actions: [] },
        null,
      ]),
    ).toEqual([]);
    expect(followUpBodies(undefined)).toEqual([]);
  });
});

describe("withButtonLinksInText", () => {
  const BOTAO = { ...GUIA, button: true };
  const EXTRA = { ...CURSO, button: true };

  it("põe os links dos botões no fim do texto", () => {
    expect(withButtonLinksInText("Leste o guia?", [BOTAO, EXTRA])).toBe(
      "Leste o guia?\n\n{{link.guia}}\n{{link.curso}}",
    );
  });

  it("em Markdown, mostra o nome do link (Teams)", () => {
    expect(
      withButtonLinksInText("Olá", [BOTAO], { markdown: true }),
    ).toBe("Olá\n\n[Guia passo a passo]({{link.guia}})");
  });

  it("não repete um link que já está no texto", () => {
    expect(withButtonLinksInText("Guia: {{link.guia}}", [BOTAO])).toBe(
      "Guia: {{link.guia}}",
    );
  });

  it("não mexe no texto sem links marcados como botão", () => {
    expect(withButtonLinksInText("Olá", [GUIA])).toBe("Olá");
  });

  it("com o texto vazio, o texto passa a ser os links", () => {
    expect(withButtonLinksInText("", [BOTAO])).toBe("{{link.guia}}");
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

describe("isOnlyTrackedLinks", () => {
  it.each([
    ["{{link.guia}}"],
    ["  {{link.guia}}\n"],
    ["{{link.guia}} {{link.curso}}"],
  ])("deteta uma mensagem só com links: %j", (message) => {
    expect(isOnlyTrackedLinks(message)).toBe(true);
  });

  it.each([
    ["Guia: {{link.guia}}"],
    ["{{nome}} {{link.guia}}"],
    ["Sem links"],
    [""],
  ])("não bloqueia uma mensagem com texto ou sem links: %j", (message) => {
    expect(isOnlyTrackedLinks(message)).toBe(false);
  });
});

describe("buildLinkButtonActions", () => {
  it("monta a ação de link no formato do Bird", () => {
    expect(buildLinkButtonActions("Abrir guia", GUIA.trackedUrl)).toEqual([
      { type: "link", link: { text: "Abrir guia", url: GUIA.trackedUrl } },
    ]);
  });
});
