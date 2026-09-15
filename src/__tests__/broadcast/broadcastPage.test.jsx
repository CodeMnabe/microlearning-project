import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  registerAppModulePacks,
  setDefaultAppMockReturns,
  resetAppMocks,
} from "../utils/mocks";

registerAppModulePacks();

const alertMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/app/components/Alert/AlertProvider", () => ({
  useAlert: () => alertMock,
}));

/* Carregamento de ficheiros: devolve um URL público sem tocar no Supabase. */
const storageMock = vi.hoisted(() => ({
  upload: vi.fn(() => Promise.resolve({ error: null })),
  getPublicUrl: vi.fn((key) => ({
    data: { publicUrl: `https://cdn.test/${key}` },
  })),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => storageMock } }),
}));

import BroadcastPage from "@/app/[locale]/(app)/broadcast/page.jsx";

const ORG_ID = 7;

const USERS = [
  { id: 1, name: "Pedro Silva", phone_number: "+351910000001", tags: [] },
  { id: 2, name: "Ana Costa", phone_number: "+351910000002", tags: [] },
];

const OPENING = {
  body: "Corpo guardado da organização",
  isDefault: false,
  defaultBody: "Texto por omissão",
  intro: "Olá {{nome}}!\n\nDesejas receber comunicações da {{empresa}}?",
  outro: "Confirma a tua escolha clicando no botão abaixo.",
  button: "Aceito",
  maxLength: 600,
};

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe("BroadcastPage", () => {
  const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

  beforeEach(() => {
    resetAppMocks();
    setDefaultAppMockReturns({
      org: { org: { id: ORG_ID, name: "Digik" }, loading: false },
    });

    mocks.fetch.mockImplementation((input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || "GET").toUpperCase();

      if (url.startsWith("/api/users")) return makeResponse({ items: USERS });
      if (url.startsWith("/api/assistants")) return makeResponse({ items: [] });
      if (url.startsWith("/api/tags")) return makeResponse({ items: [] });
      if (url.startsWith("/api/organizations/messaging-feature")) {
        return makeResponse({ item: { read_chains_enabled: false } });
      }
      if (url.startsWith("/api/organizations/opening-message")) {
        return makeResponse({ item: OPENING });
      }
      if (url === "/api/broadcast/whatsapp" && method === "POST") {
        return makeResponse({ ok: 1, failed: 0, results: [], note: null });
      }
      if (url === "/api/broadcast/teams" && method === "POST") {
        return makeResponse({ ok: 1, failed: 0, results: [] });
      }

      return makeResponse({});
    });

    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastPostTo(path) {
    const call = [...mocks.fetch.mock.calls]
      .reverse()
      .find(
        ([url, init]) =>
          url === path && (init?.method || "GET").toUpperCase() === "POST",
      );
    return call ? JSON.parse(call[1].body) : null;
  }

  async function openWhatsapp() {
    render(<BroadcastPage />);
    await screen.findByText("Pedro Silva");
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
  }

  /* O corpo escreve-se num editor contenteditable, não num textarea. */
  function typeInEditor(editor, text) {
    editor.appendChild(document.createTextNode(text));
    fireEvent.input(editor);
  }

  function pickFromPlusMenu(name) {
    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.composer.add" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name }));
  }

  it("shows the start menu for WhatsApp and the editor for Teams", async () => {
    render(<BroadcastPage />);
    await screen.findByText("Pedro Silva");

    expect(screen.queryByTestId("start-menu")).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Broadcast.message" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(screen.getByTestId("start-menu")).toBeInTheDocument();
    expect(
      screen.queryByText("Broadcast.start.opening"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Broadcast.start.blank")).toBeInTheDocument();
    expect(screen.getByText("Broadcast.start.survey")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Broadcast.send" }),
    ).toBeDisabled();
  });

  it("disponibiliza a pergunta aberta e o quiz", async () => {
    await openWhatsapp();

    const quiz = screen.getByTestId("start-card-quiz");
    const question = screen.getByTestId("start-card-question");
    expect(quiz).toBeEnabled();
    expect(quiz).not.toHaveTextContent("Broadcast.start.soon");
    expect(question).toBeEnabled();
    expect(question).not.toHaveTextContent("Broadcast.start.soon");

    fireEvent.click(question);
    expect(
      screen.getByLabelText("Broadcast.composer.openQuestionBody"),
    ).toBeInTheDocument();
  });

  it("exige resposta esperada e envia a pergunta com avaliação por omissão", async () => {
    await openWhatsapp();
    fireEvent.click(screen.getByTestId("start-card-question"));
    fireEvent.click(screen.getByText("Pedro Silva"));
    const send = screen.getByRole("button", { name: "Broadcast.send" });
    typeInEditor(
      screen.getByLabelText("Broadcast.composer.openQuestionBody"),
      "Como verificas os pneus?",
    );
    expect(send).toBeDisabled();
    expect(
      screen.getByLabelText("Broadcast.composer.aiEvaluation"),
    ).toBeChecked();
    fireEvent.change(
      screen.getByLabelText("Broadcast.composer.expectedAnswer"),
      { target: { value: "Com os pneus frios." } },
    );
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() =>
      expect(lastPostTo("/api/broadcast/whatsapp")).not.toBeNull(),
    );
    expect(lastPostTo("/api/broadcast/whatsapp").question).toEqual({
      kind: "open",
      body: "Como verificas os pneus?",
      expectedAnswer: "Com os pneus frios.",
      aiEvaluation: true,
    });
  });

  it("sends a quiz with its options, the correct one and the feedback", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByTestId("start-card-quiz"));

    const body = await screen.findByLabelText("Broadcast.composer.quizBody");
    typeInEditor(body, "Qual é a pressão certa dos pneus?");

    const optionInputs = screen.getAllByRole("textbox", {
      name: "Broadcast.composer.quizOption",
    });
    expect(optionInputs).toHaveLength(3);

    fireEvent.change(optionInputs[0], { target: { value: "2,2 bar" } });
    fireEvent.change(optionInputs[1], { target: { value: "2,8 bar" } });

    /* A terceira opção fica vazia: sai. */
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Broadcast.composer.quizRemoveOption",
      })[2],
    );

    /* A certa é a segunda. */
    fireEvent.click(
      screen.getAllByRole("radio", {
        name: "Broadcast.composer.quizMarkCorrect",
      })[1],
    );

    fireEvent.change(
      screen.getByLabelText("Broadcast.composer.quizFeedbackIncorrect"),
      { target: { value: "Quase. A certa é {{certa}}." } },
    );

    fireEvent.click(screen.getByText("Pedro Silva"));

    const send = screen.getByRole("button", { name: "Broadcast.send" });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => {
      expect(lastPostTo("/api/broadcast/whatsapp")).not.toBeNull();
    });

    expect(lastPostTo("/api/broadcast/whatsapp")).toMatchObject({
      orgId: ORG_ID,
      message: "",
      recipients: [{ userId: 1 }],
      question: {
        kind: "quiz",
        body: "Qual é a pressão certa dos pneus?",
        options: [
          { label: "2,2 bar", correct: false },
          { label: "2,8 bar", correct: true },
        ],
        feedbackCorrect: "",
        feedbackIncorrect: "Quase. A certa é {{certa}}.",
      },
    });
  });

  it("keeps the send button disabled while the quiz is incomplete", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByTestId("start-card-quiz"));
    fireEvent.click(screen.getByText("Pedro Silva"));

    const send = screen.getByRole("button", { name: "Broadcast.send" });
    expect(send).toBeDisabled();

    typeInEditor(
      await screen.findByLabelText("Broadcast.composer.quizBody"),
      "Pergunta",
    );

    /* Falta preencher as opções. */
    expect(send).toBeDisabled();
  });

  it("offers the + menu in the quiz, with only the name and company variables", async () => {
    await openWhatsapp();
    fireEvent.click(screen.getByTestId("start-card-quiz"));

    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.composer.add" }),
    );

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual([
      "Broadcast.composer.addImage",
      "Broadcast.composer.addVideo",
      "Broadcast.composer.addDocument",
      "Broadcast.composer.addLink",
      "Broadcast.composer.variableName",
      "Broadcast.composer.variableCompany",
    ]);
  });

  it("sends a quiz with a variable chip, a tracked link and an image", async () => {
    await openWhatsapp();
    fireEvent.click(screen.getByTestId("start-card-quiz"));

    const body = await screen.findByLabelText("Broadcast.composer.quizBody");
    typeInEditor(body, "Olá ");
    pickFromPlusMenu("Broadcast.composer.variableName");

    /* O link rastreado abre o painel; depois entra no balão como pastilha. */
    pickFromPlusMenu("Broadcast.composer.addLink");
    fireEvent.click(screen.getByRole("button", { name: "Broadcast.addLink" }));
    fireEvent.change(screen.getByPlaceholderText("training"), {
      target: { value: "curso" },
    });
    fireEvent.change(screen.getByPlaceholderText("Aceder à formação"), {
      target: { value: "Curso" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("https://example.com/course/123"),
      { target: { value: "https://x.test/curso" } },
    );
    pickFromPlusMenu("Link: Curso");

    /* A imagem aparece num balão antes da pergunta. */
    fireEvent.change(screen.getByTestId("file-input"), {
      target: {
        files: [new File(["x"], "foto.png", { type: "image/png" })],
      },
    });
    await screen.findByAltText("foto.png");

    const optionInputs = screen.getAllByRole("textbox", {
      name: "Broadcast.composer.quizOption",
    });
    fireEvent.change(optionInputs[0], { target: { value: "2,2 bar" } });
    fireEvent.change(optionInputs[1], { target: { value: "2,8 bar" } });
    fireEvent.change(optionInputs[2], { target: { value: "3,5 bar" } });

    fireEvent.click(screen.getByText("Pedro Silva"));
    fireEvent.click(screen.getByRole("button", { name: "Broadcast.send" }));

    await waitFor(() => {
      expect(lastPostTo("/api/broadcast/whatsapp")).not.toBeNull();
    });

    const payload = lastPostTo("/api/broadcast/whatsapp");
    expect(payload.question.body).toBe("Olá {{nome}} {{link.curso}} ");
    expect(payload.trackedLinks).toEqual([
      { key: "curso", label: "Curso", destinationUrl: "https://x.test/curso" },
    ]);
    expect(payload.files).toEqual([
      expect.objectContaining({ name: "foto.png", contentType: "image/png" }),
    ]);
    expect(payload.imageUrls).toEqual([payload.files[0].url]);
  });

  it("sends a survey with its options and thanks text, without a correct option", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByTestId("start-card-survey"));

    const body = await screen.findByLabelText("Broadcast.composer.surveyBody");
    typeInEditor(body, "Qual o melhor horário para a formação?");

    const optionInputs = screen.getAllByRole("textbox", {
      name: "Broadcast.composer.surveyOption",
    });
    expect(optionInputs).toHaveLength(3);
    fireEvent.change(optionInputs[0], { target: { value: "Manhã" } });
    fireEvent.change(optionInputs[1], { target: { value: "Tarde" } });
    fireEvent.change(optionInputs[2], { target: { value: "Noite" } });

    /* Não há resposta certa a marcar. */
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Broadcast.composer.surveyThanks"), {
      target: { value: "Obrigado, {{nome}}!" },
    });

    fireEvent.click(screen.getByText("Pedro Silva"));

    const send = screen.getByRole("button", { name: "Broadcast.send" });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => {
      expect(lastPostTo("/api/broadcast/whatsapp")).not.toBeNull();
    });

    expect(lastPostTo("/api/broadcast/whatsapp")).toMatchObject({
      orgId: ORG_ID,
      message: "",
      recipients: [{ userId: 1 }],
      question: {
        kind: "survey",
        body: "Qual o melhor horário para a formação?",
        options: [{ label: "Manhã" }, { label: "Tarde" }, { label: "Noite" }],
        thanksText: "Obrigado, {{nome}}!",
      },
    });
    expect(lastPostTo("/api/broadcast/whatsapp").openingOnly).toBeUndefined();
  });

  it("sends a blank message written in the bubble with a variable chip", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByText("Broadcast.start.blank"));

    const editor = screen.getByRole("textbox", { name: "Broadcast.message" });
    typeInEditor(editor, "Olá ");
    pickFromPlusMenu("Broadcast.composer.variableName");

    fireEvent.click(screen.getByText("Ana Costa"));
    fireEvent.click(screen.getByRole("button", { name: "Broadcast.send" }));

    await waitFor(() => {
      expect(lastPostTo("/api/broadcast/whatsapp")).not.toBeNull();
    });

    expect(lastPostTo("/api/broadcast/whatsapp")).toMatchObject({
      message: "Olá {{nome}} ",
      recipients: [{ userId: 2 }],
    });
    expect(lastPostTo("/api/broadcast/whatsapp").openingOnly).toBeUndefined();
  });

  it("goes back to the start menu from the editor", async () => {
    await openWhatsapp();

    fireEvent.click(screen.getByText("Broadcast.start.blank"));
    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.composer.back" }),
    );

    expect(screen.getByTestId("start-menu")).toBeInTheDocument();
  });
});
