import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repos/questions.repo", () => ({
  createQuestion: vi.fn(),
}));

import {
  attachChainStepQuestions,
  chainStepExpiryDate,
  parseChainStepQuestions,
} from "@/lib/services/broadcast/readChains/chainStepQuestions";

const QUIZ = {
  kind: "quiz",
  body: "Qual é a pressão certa?",
  options: [
    { label: "2,2 bar", correct: false },
    { label: "2,8 bar", correct: true },
  ],
  feedbackCorrect: "Boa!",
  feedbackIncorrect: "",
};

const OPEN = {
  kind: "open",
  body: "Como verificas os pneus?",
  expectedAnswer: "Com os pneus frios.",
  aiEvaluation: false,
};

describe("parseChainStepQuestions", () => {
  it("returns one entry per step, null for plain messages", () => {
    const { questions, error } = parseChainStepQuestions([
      { message: "Olá" },
      { message: "", question: QUIZ },
      { message: "", question: OPEN },
    ]);

    expect(error).toBeUndefined();
    expect(questions[0]).toBeNull();
    expect(questions[1]).toMatchObject({ kind: "quiz", body: QUIZ.body });
    expect(questions[2]).toMatchObject({
      kind: "open",
      expectedAnswer: "Com os pneus frios.",
      aiEvaluation: false,
    });
  });

  it("names the step when a question is invalid", () => {
    expect(
      parseChainStepQuestions([
        { message: "Olá" },
        { question: { kind: "quiz", body: "", options: [] } },
      ]).error,
    ).toMatch(/^Message 2:/);
  });

  it("accepts a question with attachments", () => {
    const { questions, error } = parseChainStepQuestions([
      { question: QUIZ, files: [{ url: "https://x/f.png" }] },
    ]);

    expect(error).toBeUndefined();
    expect(questions[0]).toMatchObject({ kind: "quiz" });
  });
});

describe("chainStepExpiryDate", () => {
  it("adds the cumulative delay and the margin to the start date", () => {
    const start = "2026-09-14T10:00:00Z";
    const expiry = chainStepExpiryDate({
      startAt: start,
      cumulativeDelayMinutes: 60,
    });

    /* 7 dias de validade + 30 de margem, mais 1 hora de atraso. */
    expect(expiry.toISOString()).toBe("2026-10-21T11:00:00.000Z");
  });
});

describe("attachChainStepQuestions", () => {
  it("creates one question per step with a question and stores its id in the step", async () => {
    const createQuestion = vi
      .fn()
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 12 });

    const image = { url: "https://x/f.png", contentType: "image/png" };
    const link = { key: "curso", label: "Curso", destinationUrl: "https://x" };

    const steps = [
      { message: "Olá", files: [], delayAfterPreviousReadMinutes: 0 },
      {
        message: "",
        files: [image],
        trackedLinks: [link],
        delayAfterPreviousReadMinutes: 30,
      },
      { message: "", files: [], delayAfterPreviousReadMinutes: 90 },
    ];

    const result = await attachChainStepQuestions({
      steps,
      questions: [null, QUIZ, OPEN],
      organizationId: 1,
      createdByUserId: "admin-uuid",
      startAt: "2026-09-14T10:00:00Z",
      deps: { createQuestion },
    });

    expect(result[0]).toMatchObject({ message: "Olá", questionId: null });
    /* Os anexos e os links do passo seguem com a pergunta. */
    expect(result[1]).toMatchObject({
      message: QUIZ.body,
      questionId: 11,
      question: { kind: "quiz" },
      files: [image],
      trackedLinks: [link],
    });
    expect(result[2]).toMatchObject({ message: OPEN.body, questionId: 12 });

    expect(createQuestion).toHaveBeenCalledTimes(2);
    expect(createQuestion.mock.calls[0][0]).toMatchObject({
      organizationId: 1,
      kind: "quiz",
      options: QUIZ.options,
      feedbackCorrect: "Boa!",
      expectedAnswer: null,
      aiEvaluation: true,
      createdByUserId: "admin-uuid",
    });
    expect(createQuestion.mock.calls[1][0]).toMatchObject({
      kind: "open",
      options: null,
      expectedAnswer: "Com os pneus frios.",
      aiEvaluation: false,
    });

    /* O prazo do passo 3 conta 30 + 90 minutos de atraso acumulado. */
    expect(createQuestion.mock.calls[1][0].expiresAt.toISOString()).toBe(
      "2026-10-21T12:00:00.000Z",
    );
  });
});
