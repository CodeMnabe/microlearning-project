import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
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
    sentAt: "2026-09-14T13:26:04Z",
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
    expect(rows[0]).toHaveTextContent("50%");
    expect(rows[0]).toHaveTextContent("Questions.verdictSummary");

    expect(rows[1]).toHaveTextContent("Qual é a pressão certa dos pneus?");
    expect(rows[1]).toHaveTextContent("Questions.kind.quiz");
    expect(rows[1]).toHaveTextContent("66.7%");
    expect(rows[1]).toHaveTextContent("Questions.correctRate");

    const links = screen.getAllByRole("link", { name: "Questions.view" });
    expect(links[0]).toHaveAttribute(
      "href",
      "/broadcast/questions/detail?questionId=2",
    );
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
      expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
    });
    expect(screen.getByRole("table")).toHaveTextContent(
      "Qual é a pressão certa dos pneus?",
    );
  });

  it("shows an empty state when there are no questions", async () => {
    fetchMock.mockImplementation(() => makeResponse({ items: [] }));

    render(<QuestionsPage />);

    expect(
      await screen.findByText("Questions.noQuestions"),
    ).toBeInTheDocument();
  });
});
