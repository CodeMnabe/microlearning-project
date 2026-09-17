import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORG_ID = 7;

/* Funções estáveis entre renders: a página depende delas em efeitos. */
const navMocks = vi.hoisted(() => ({
  push: vi.fn(),
  questionId: "10",
  startLoading: vi.fn(),
  stopLoading: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navMocks.push, replace: vi.fn() }),
  useSearchParams: () =>
    new URLSearchParams(
      navMocks.questionId ? { questionId: navMocks.questionId } : {},
    ),
}));

vi.mock("@/app/LoadingScreen/GlobalLoaderContext", () => ({
  useGlobalLoader: () => ({
    startLoading: navMocks.startLoading,
    stopLoading: navMocks.stopLoading,
  }),
}));

vi.mock("@/app/AuthContext", () => ({
  useAuth: () => ({ user: { id: "auth_user_1" }, loading: false }),
}));

vi.mock("@/app/hooks/useOrganization", () => ({
  default: () => ({ org: { id: ORG_ID, name: "Digik" }, loading: false }),
}));

const alertMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/app/components/Alert/AlertProvider", () => ({
  useAlert: () => alertMock,
}));

import QuestionDetailPage from "@/app/[locale]/(app)/broadcast/questions/detail/page.jsx";

const SURVEY = {
  summary: {
    id: 10,
    kind: "survey",
    body: "Qual o melhor horário para a formação?",
    options: [{ label: "Manhã" }, { label: "Tarde" }, { label: "Noite" }],
    optionCounts: [0, 1, 0],
    expectedAnswer: null,
    aiEvaluation: true,
    sentAt: "2026-09-14T15:52:30Z",
    expiresAt: "2026-09-21T16:52:28Z",
    recipientCount: 1,
    answeredCount: 1,
    notAnsweredCount: 0,
    responseRate: 100,
    correctCount: null,
    correctRate: null,
    verdicts: null,
    reviewNeededCount: 0,
  },
  answered: [
    {
      answerId: 1,
      userId: 5700,
      name: "João Lima",
      phoneNumber: "+351965001989",
      answerText: "Tarde",
      optionLabel: "Tarde",
      isCorrect: null,
      answeredAt: "2026-09-14T16:59:22Z",
    },
  ],
  notAnswered: [],
};

const OPEN = {
  summary: {
    id: 11,
    kind: "open",
    body: "Como verificas os pneus?",
    options: [],
    optionCounts: null,
    expectedAnswer: "Com um manómetro, a frio.",
    aiEvaluation: true,
    sentAt: "2026-09-14T15:00:01Z",
    expiresAt: "2026-09-21T15:00:01Z",
    recipientCount: 2,
    answeredCount: 2,
    notAnsweredCount: 0,
    responseRate: 100,
    correctCount: null,
    correctRate: null,
    verdicts: { completa: 1, parcial: 0, incompleta: 0, semVeredicto: 1 },
    reviewNeededCount: 1,
  },
  answered: [
    {
      answerId: 21,
      userId: 5700,
      name: "João Lima",
      phoneNumber: "+351965001989",
      answerText: "Com o manómetro",
      verdict: "completa",
      adminVerdict: null,
      effectiveVerdict: "completa",
      aiFeedback: "Certo.",
      reviewNeeded: false,
      answeredAt: "2026-09-14T16:00:00Z",
    },
    {
      answerId: 22,
      userId: 5701,
      name: "Ana Silva",
      phoneNumber: "+351960000000",
      answerText: "Olho para eles",
      verdict: null,
      adminVerdict: null,
      effectiveVerdict: null,
      aiFeedback: null,
      reviewNeeded: true,
      answeredAt: "2026-09-14T16:05:00Z",
    },
  ],
  notAnswered: [],
};

function makeResponse(data, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

describe("QuestionDetailPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    navMocks.questionId = "10";
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the summary, the choices per option and who answered a survey", async () => {
    fetchMock.mockImplementation(() => makeResponse(SURVEY));

    render(<QuestionDetailPage />);

    await screen.findByTestId("question-stats");

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/questions/report-detail?orgId=${ORG_ID}&questionId=10`,
      expect.anything(),
    );

    expect(
      screen.getByRole("heading", {
        name: "Qual o melhor horário para a formação?",
      }),
    ).toBeInTheDocument();

    /* Números principais em linha; sem taxa de acertos nem "para rever". */
    const stats = screen.getByTestId("question-stats");
    expect(stats).toHaveTextContent("Questions.detail.recipients1");
    expect(stats).toHaveTextContent("Questions.detail.answered1");
    expect(stats).toHaveTextContent("Questions.detail.responseRate100%");
    expect(stats).not.toHaveTextContent("Questions.detail.correctRate");
    expect(stats).not.toHaveTextContent("Questions.detail.toReview");

    /* Distribuição: cada opção com contagem e percentagem. */
    const rows = screen
      .getByTestId("question-distribution")
      .querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Manhã00%");
    expect(rows[1]).toHaveTextContent("Tarde1100%");

    /* Sondagem: a resposta é a escolha; não há coluna de resultado. */
    const table = screen.getByTestId("answered-table");
    expect(table.querySelectorAll("thead th")).toHaveLength(4);
    expect(table).toHaveTextContent("João Lima");
    expect(table).toHaveTextContent("Tarde");

    expect(screen.getByText("Questions.detail.allAnswered")).toBeInTheDocument();
  });

  it("lets the admin correct the verdict of an open answer", async () => {
    fetchMock.mockImplementation((url, init) => {
      if (String(url).startsWith("/api/questions/answers/22")) {
        expect(init.method).toBe("PATCH");
        expect(JSON.parse(init.body)).toEqual({
          orgId: ORG_ID,
          adminVerdict: "parcial",
        });
        return makeResponse({ ok: true });
      }
      return makeResponse(OPEN);
    });

    render(<QuestionDetailPage />);

    await screen.findByTestId("question-stats");

    const stats = screen.getByTestId("question-stats");
    expect(stats).toHaveTextContent("Questions.detail.toReview1");
    expect(screen.getByText("Com um manómetro, a frio.")).toBeInTheDocument();

    const distribution = screen.getByTestId("question-distribution");
    expect(distribution.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(distribution).toHaveTextContent("Questions.detail.verdicts.none150%");

    const selects = screen.getAllByRole("combobox", {
      name: "Questions.detail.table.verdict",
    });
    expect(selects).toHaveLength(2);

    fireEvent.change(selects[1], { target: { value: "parcial" } });

    await waitFor(() => {
      expect(stats).toHaveTextContent("Questions.detail.toReview0");
    });

    expect(distribution).toHaveTextContent(
      "Questions.detail.verdicts.parcial150%",
    );
    expect(distribution).toHaveTextContent("Questions.detail.verdicts.none00%");
  });

  it("filters who answered by contact and by answer", async () => {
    fetchMock.mockImplementation(() => makeResponse(OPEN));

    render(<QuestionDetailPage />);

    const table = await screen.findByTestId("answered-table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Questions.detail.filters.search" }),
      { target: { value: "ana" } },
    );

    expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(table).toHaveTextContent("Ana Silva");

    fireEvent.click(screen.getByRole("button", { name: "Questions.filters.clear" }));
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);

    /* Por resposta: numa pergunta aberta filtra pelo veredicto em vigor. */
    fireEvent.click(
      screen.getByRole("button", {
        name: "Questions.detail.filters.allAnswers",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", {
        name: "Questions.detail.verdicts.completa",
      }),
    );

    await waitFor(() => {
      expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
    });
    expect(table).toHaveTextContent("João Lima");
    expect(
      screen.queryByText("Questions.detail.allAnswered"),
    ).not.toBeInTheDocument();
  });

  it("shows an error when the question id is missing", async () => {
    navMocks.questionId = "";

    render(<QuestionDetailPage />);

    expect(
      await screen.findByText(
        "Questions.detail.alerts.missingQuestion.message",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
