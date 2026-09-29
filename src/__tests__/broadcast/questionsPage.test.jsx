import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appMocks,
  registerAppModulePacks,
  resetAppMocks,
  setDefaultAppMockReturns,
} from "../utils/mocks";

registerAppModulePacks();

const alertMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/app/components/Alert/AlertProvider", () => ({
  useAlert: () => alertMock,
}));

import QuestionsPage from "@/app/[locale]/(app)/broadcast/questions/page.jsx";

const ORG_ID = 7;

const ITEMS = [
  {
    id: 2,
    kind: "open",
    body: "Como verificas os pneus?",
    recipientCount: 2,
    answeredCount: 1,
    responseRate: 50,
    correctCount: null,
    correctRate: null,
    verdicts: { completa: 1, parcial: 0, incompleta: 0, semVeredicto: 0 },
    reviewNeededCount: 1,
    sentAt: "2026-09-14T15:00:01Z",
  },
  {
    id: 1,
    kind: "quiz",
    body: "Qual é a pressão certa dos pneus?",
    recipientCount: 3,
    answeredCount: 2,
    responseRate: 66.7,
    correctCount: 1,
    correctRate: 50,
    verdicts: null,
    reviewNeededCount: 0,
    sentAt: "2026-09-12T13:26:04Z",
  },
];

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

describe("QuestionsPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetAppMocks();
    setDefaultAppMockReturns({
      org: { org: { id: ORG_ID, name: "Digik" }, loading: false },
    });

    fetchMock.mockImplementation((url) => {
      if (String(url).startsWith("/api/questions/reports")) {
        return makeResponse({ items: ITEMS });
      }
      return makeResponse({});
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists the questions with their totals and links to the detail", async () => {
    render(<QuestionsPage />);

    await screen.findByTestId("questions-table");

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/questions/reports?orgId=${ORG_ID}`,
      expect.anything(),
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);

    expect(rows[0]).toHaveTextContent("Como verificas os pneus?");
    expect(rows[0]).toHaveTextContent("Questions.kind.open");
    expect(rows[0]).toHaveTextContent("Questions.sentOn");
    expect(rows[0]).toHaveTextContent("Questions.answersOf");
    expect(rows[0]).toHaveTextContent("50%");
    expect(rows[0]).toHaveTextContent("Questions.verdictSummary");
    expect(rows[0]).toHaveTextContent("Questions.reviewCount");

    expect(rows[1]).toHaveTextContent("Qual é a pressão certa dos pneus?");
    expect(rows[1]).toHaveTextContent("Questions.kind.quiz");
    expect(rows[1]).toHaveTextContent("66.7%");
    expect(rows[1]).toHaveTextContent("Questions.correctRate");
    expect(rows[1]).not.toHaveTextContent("Questions.reviewCount");

    /* O texto da pergunta é a ligação para o detalhe. */
    expect(
      screen.getByRole("link", { name: "Como verificas os pneus?" }),
    ).toHaveAttribute("href", "/broadcast/questions/detail?questionId=2");
  });

  it("opens the detail when the row is clicked", async () => {
    render(<QuestionsPage />);

    await screen.findByTestId("questions-table");

    const rows = screen.getAllByRole("row").slice(1);

    /* Clique simples na célula dos números, fora da ligação. */
    fireEvent.click(rows[1].querySelectorAll("td")[1]);

    expect(appMocks.push).toHaveBeenCalledWith(
      "/broadcast/questions/detail?questionId=1",
    );

    /* Com modificador fica para o browser (nova aba pela ligação). */
    appMocks.push.mockClear();
    fireEvent.click(rows[1].querySelectorAll("td")[1], { ctrlKey: true });

    expect(appMocks.push).not.toHaveBeenCalled();
  });

  it("shows the number of answers to review and filters by text", async () => {
    render(<QuestionsPage />);

    await screen.findByTestId("questions-table");

    /* Cartão "para rever": soma das respostas marcadas. */
    expect(
      screen.getByText("Questions.toReview").nextSibling,
    ).toHaveTextContent("1");

    fireEvent.change(screen.getByPlaceholderText("Questions.search"), {
      target: { value: "pressão" },
    });

    await waitFor(() => {
      const table = screen.getByTestId("questions-table");
      expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
      expect(table).toHaveTextContent("Qual é a pressão certa dos pneus?");
    });
  });

  it("filters by question type", async () => {
    render(<QuestionsPage />);

    await screen.findByTestId("questions-table");

    fireEvent.click(
      screen.getByRole("button", { name: "Questions.filters.allKinds" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Questions.kind.quiz" }));

    await waitFor(() => {
      const table = screen.getByTestId("questions-table");
      expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
      expect(table).toHaveTextContent("Qual é a pressão certa dos pneus?");
    });

    /* "Limpar filtros" volta à lista completa. */
    fireEvent.click(
      screen.getByRole("button", { name: "Questions.filters.clear" }),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("questions-table").querySelectorAll("tbody tr"),
      ).toHaveLength(2);
    });
  });

  it("filters by the sent date range, inclusive", async () => {
    render(<QuestionsPage />);

    await screen.findByTestId("questions-table");

    /* Só a pergunta de 14/09 fica dentro do intervalo. */
    fireEvent.change(screen.getByLabelText("Questions.filters.from"), {
      target: { value: "2026-09-13" },
    });

    await waitFor(() => {
      const table = screen.getByTestId("questions-table");
      expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
      expect(table).toHaveTextContent("Como verificas os pneus?");
    });

    /* Limite superior antes das duas datas: sem resultados. */
    fireEvent.change(screen.getByLabelText("Questions.filters.to"), {
      target: { value: "2026-09-13" },
    });

    expect(await screen.findByText("Questions.noMatches")).toBeInTheDocument();

    /* Intervalo que apanha as duas perguntas (limites inclusivos). */
    fireEvent.change(screen.getByLabelText("Questions.filters.from"), {
      target: { value: "2026-09-12" },
    });
    fireEvent.change(screen.getByLabelText("Questions.filters.to"), {
      target: { value: "2026-09-14" },
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("questions-table").querySelectorAll("tbody tr"),
      ).toHaveLength(2);
    });
  });

  it("shows an empty state when there are no questions", async () => {
    fetchMock.mockImplementation(() => makeResponse({ items: [] }));

    render(<QuestionsPage />);

    expect(
      await screen.findByText("Questions.noQuestions"),
    ).toBeInTheDocument();
  });
});
