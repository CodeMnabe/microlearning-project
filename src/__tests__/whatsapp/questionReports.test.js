import { describe, expect, it } from "vitest";

import {
  buildQuestionDetail,
  buildQuestionReports,
  effectiveVerdict,
} from "@/lib/services/questions/questionReports";

const QUIZ = {
  id: 1,
  kind: "quiz",
  body: "Qual é a pressão certa?",
  options: [
    { label: "2,2 bar", correct: false },
    { label: "2,8 bar", correct: true },
  ],
  expected_answer: null,
  ai_evaluation: true,
  created_at: "2026-09-14T13:26:03Z",
  expires_at: "2026-09-21T13:26:02Z",
};

const OPEN = {
  id: 2,
  kind: "open",
  body: "Como verificas os pneus?",
  options: null,
  expected_answer: "Com os pneus frios.",
  ai_evaluation: true,
  created_at: "2026-09-14T15:00:00Z",
  expires_at: "2026-09-21T15:00:00Z",
};

const MESSAGES = [
  { question_id: 1, user_id: 10, created_at: "2026-09-14T13:26:04Z" },
  { question_id: 1, user_id: 11, created_at: "2026-09-14T13:26:05Z" },
  { question_id: 1, user_id: 12, created_at: "2026-09-14T13:26:06Z" },
  { question_id: 2, user_id: 10, created_at: "2026-09-14T15:00:01Z" },
  { question_id: 2, user_id: 11, created_at: "2026-09-14T15:00:02Z" },
];

const ANSWERS = [
  {
    id: 100,
    question_id: 1,
    user_id: 10,
    option_index: 1,
    is_correct: true,
    answer_text: "2,8 bar",
    review_needed: false,
    answered_at: "2026-09-14T13:30:00Z",
  },
  {
    id: 101,
    question_id: 1,
    user_id: 11,
    option_index: 0,
    is_correct: false,
    answer_text: "2,2 bar",
    review_needed: false,
    answered_at: "2026-09-14T13:31:00Z",
  },
  {
    id: 102,
    question_id: 2,
    user_id: 10,
    answer_text: "Com um manómetro",
    verdict: "parcial",
    admin_verdict: "completa",
    ai_feedback: "Falta a temperatura.",
    review_needed: true,
    answered_at: "2026-09-14T15:05:00Z",
  },
];

describe("effectiveVerdict", () => {
  it("prefers the admin correction over the AI verdict", () => {
    expect(
      effectiveVerdict({ verdict: "parcial", admin_verdict: "completa" }),
    ).toBe("completa");
    expect(effectiveVerdict({ verdict: "parcial", admin_verdict: null })).toBe(
      "parcial",
    );
    expect(effectiveVerdict({})).toBeNull();
  });
});

describe("buildQuestionReports", () => {
  it("summarises quizzes with response and correct rates", () => {
    const [open, quiz] = buildQuestionReports({
      questions: [QUIZ, OPEN],
      messages: MESSAGES,
      answers: ANSWERS,
    });

    expect(quiz).toMatchObject({
      id: 1,
      kind: "quiz",
      recipientCount: 3,
      answeredCount: 2,
      notAnsweredCount: 1,
      responseRate: 66.7,
      correctCount: 1,
      correctRate: 50,
      verdicts: null,
      reviewNeededCount: 0,
      sentAt: "2026-09-14T13:26:04Z",
    });

    /* A mais recente primeiro. */
    expect(open.id).toBe(2);
  });

  it("summarises open questions with the verdict distribution", () => {
    const [open] = buildQuestionReports({
      questions: [OPEN],
      messages: MESSAGES,
      answers: ANSWERS,
    });

    expect(open).toMatchObject({
      kind: "open",
      recipientCount: 2,
      answeredCount: 1,
      responseRate: 50,
      correctCount: null,
      correctRate: null,
      verdicts: { completa: 1, parcial: 0, incompleta: 0, semVeredicto: 0 },
      reviewNeededCount: 1,
    });
  });

  it("counts an answer without a delivery row as a recipient", () => {
    const [quiz] = buildQuestionReports({
      questions: [QUIZ],
      messages: [],
      answers: [ANSWERS[0]],
    });

    expect(quiz.recipientCount).toBe(1);
    expect(quiz.answeredCount).toBe(1);
    expect(quiz.responseRate).toBe(100);
  });
});

describe("buildQuestionDetail", () => {
  const users = new Map([
    [
      "10",
      { id: 10, name: "Ana", email: "ana@x.pt", phone_number: "+351910000010" },
    ],
    ["11", { id: 11, name: "Bruno", phone_number: "+351910000011" }],
    ["12", { id: 12, name: "Carla", phone_number: "+351910000012" }],
  ]);

  it("lists who answered, with the option label and result, and who did not", () => {
    const detail = buildQuestionDetail({
      question: QUIZ,
      messages: MESSAGES.filter((m) => m.question_id === 1),
      answers: ANSWERS.filter((a) => a.question_id === 1),
      users,
    });

    expect(detail.summary).toMatchObject({ id: 1, recipientCount: 3 });
    expect(detail.answered).toEqual([
      expect.objectContaining({
        answerId: 100,
        name: "Ana",
        optionIndex: 1,
        optionLabel: "2,8 bar",
        isCorrect: true,
        sentAt: "2026-09-14T13:26:04Z",
      }),
      expect.objectContaining({
        answerId: 101,
        name: "Bruno",
        optionLabel: "2,2 bar",
        isCorrect: false,
      }),
    ]);
    expect(detail.notAnswered).toEqual([
      expect.objectContaining({ userId: 12, name: "Carla" }),
    ]);
  });

  it("exposes the AI verdict, the admin correction and the feedback", () => {
    const detail = buildQuestionDetail({
      question: OPEN,
      messages: MESSAGES.filter((m) => m.question_id === 2),
      answers: ANSWERS.filter((a) => a.question_id === 2),
      users,
    });

    expect(detail.answered[0]).toMatchObject({
      answerText: "Com um manómetro",
      verdict: "parcial",
      adminVerdict: "completa",
      effectiveVerdict: "completa",
      aiFeedback: "Falta a temperatura.",
      reviewNeeded: true,
    });
    expect(detail.notAnswered.map((r) => r.name)).toEqual(["Bruno"]);
  });

  it("returns null without a question", () => {
    expect(buildQuestionDetail({ question: null })).toBeNull();
  });
});
