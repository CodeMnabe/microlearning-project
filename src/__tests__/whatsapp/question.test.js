import { describe, expect, it } from "vitest";

import {
  DEFAULT_QUIZ_FEEDBACK_CORRECT,
  buildQuizActions,
  extractInboundReply,
  isQuestionExpired,
  makeEmptyQuiz,
  normalizeQuiz,
  quizFeedbackText,
  resolveQuizOption,
} from "@/lib/whatsapp/question";

const OPTIONS = [
  { label: "2,2 bar", correct: false },
  { label: "2,8 bar", correct: true },
  { label: "3,5 bar", correct: false },
];

/* Toque real num botão, tal como o Bird o entrega (issue #101). */
const TAP_PAYLOAD = {
  body: {
    type: "text",
    text: {
      text: "2,8 bar",
      actions: [
        { type: "postback", postback: { text: "2,8 bar", payload: "item_1" } },
      ],
    },
  },
  replyTo: { id: "2635e77b-8ead-4668-9650-5a0bacadcb97", order: 0, type: "click" },
};

describe("normalizeQuiz", () => {
  it("accepts a complete quiz and cleans the labels", () => {
    const { quiz, error } = normalizeQuiz({
      body: "  Qual é a pressão certa?\r\n",
      options: [
        { label: "  2,2   bar ", correct: false },
        { label: "2,8 bar", correct: true },
      ],
      feedbackCorrect: " Boa! ",
    });

    expect(error).toBeUndefined();
    expect(quiz.body).toBe("Qual é a pressão certa?");
    expect(quiz.options).toEqual([
      { label: "2,2 bar", correct: false },
      { label: "2,8 bar", correct: true },
    ]);
    expect(quiz.feedbackCorrect).toBe("Boa!");
    expect(quiz.feedbackIncorrect).toBe("");
  });

  it("rejects an empty question, missing labels and wrong option counts", () => {
    expect(normalizeQuiz({ body: "", options: OPTIONS }).error).toMatch(/empty/);
    expect(
      normalizeQuiz({ body: "Q", options: [OPTIONS[1]] }).error,
    ).toMatch(/between 2 and 3/);
    expect(
      normalizeQuiz({ body: "Q", options: [...OPTIONS, OPTIONS[0]] }).error,
    ).toMatch(/between 2 and 3/);
    expect(
      normalizeQuiz({
        body: "Q",
        options: [{ label: "", correct: true }, OPTIONS[0]],
      }).error,
    ).toMatch(/label/);
  });

  it("enforces the WhatsApp button limit, unique labels and one correct option", () => {
    expect(
      normalizeQuiz({
        body: "Q",
        options: [{ label: "x".repeat(21), correct: true }, OPTIONS[0]],
      }).error,
    ).toMatch(/20 characters/);
    expect(
      normalizeQuiz({
        body: "Q",
        options: [
          { label: "2,2 bar", correct: true },
          { label: "2,2 BAR", correct: false },
        ],
      }).error,
    ).toMatch(/different/);
    expect(
      normalizeQuiz({
        body: "Q",
        options: OPTIONS.map((o) => ({ ...o, correct: false })),
      }).error,
    ).toMatch(/exactly one correct/);
  });

  it("starts empty with the first option marked as correct", () => {
    const quiz = makeEmptyQuiz();

    expect(quiz.options).toHaveLength(3);
    expect(quiz.options[0].correct).toBe(true);
    expect(normalizeQuiz(quiz).error).toBeTruthy();
  });
});

describe("buildQuizActions", () => {
  it("builds one reply action per option, in order", () => {
    expect(buildQuizActions(OPTIONS)).toEqual([
      { type: "reply", reply: { text: "2,2 bar" } },
      { type: "reply", reply: { text: "2,8 bar" } },
      { type: "reply", reply: { text: "3,5 bar" } },
    ]);
  });
});

describe("extractInboundReply", () => {
  it("reads a button tap with its index and the referenced message", () => {
    expect(extractInboundReply(TAP_PAYLOAD)).toEqual({
      text: "2,8 bar",
      isTap: true,
      tappedIndex: 1,
      tappedText: "2,8 bar",
      replyToMessageId: "2635e77b-8ead-4668-9650-5a0bacadcb97",
    });
  });

  it("treats a typed message as plain text", () => {
    expect(
      extractInboundReply({ body: { type: "text", text: { text: "Olá" } } }),
    ).toEqual({
      text: "Olá",
      isTap: false,
      tappedIndex: null,
      tappedText: null,
      replyToMessageId: null,
    });
  });
});

describe("resolveQuizOption", () => {
  it("uses the tapped index first", () => {
    const reply = extractInboundReply(TAP_PAYLOAD);

    expect(resolveQuizOption({ reply, options: OPTIONS })).toEqual({
      index: 1,
      matchedBy: "postback",
    });
  });

  it("falls back to the typed text, ignoring case and spacing", () => {
    const reply = extractInboundReply({
      body: { type: "text", text: { text: "  3,5   BAR " } },
    });

    expect(resolveQuizOption({ reply, options: OPTIONS })).toEqual({
      index: 2,
      matchedBy: "text",
    });
  });

  it("returns null when nothing matches", () => {
    const reply = extractInboundReply({
      body: { type: "text", text: { text: "não sei" } },
    });

    expect(resolveQuizOption({ reply, options: OPTIONS })).toBeNull();
  });
});

describe("quizFeedbackText", () => {
  it("uses the default texts and fills in the correct option", () => {
    const question = { options: OPTIONS };

    expect(quizFeedbackText(question, true)).toBe(DEFAULT_QUIZ_FEEDBACK_CORRECT);
    expect(quizFeedbackText(question, false)).toBe(
      "Não é essa. A resposta certa é: 2,8 bar",
    );
  });

  it("prefers the texts written by the admin", () => {
    const question = {
      options: OPTIONS,
      feedback_correct: "Boa, {{certa}} é mesmo isso.",
      feedback_incorrect: "Quase.",
    };

    expect(quizFeedbackText(question, true)).toBe("Boa, 2,8 bar é mesmo isso.");
    expect(quizFeedbackText(question, false)).toBe("Quase.");
  });
});

describe("isQuestionExpired", () => {
  it("compares expires_at with now", () => {
    const now = Date.parse("2026-09-14T12:00:00Z");

    expect(
      isQuestionExpired({ expires_at: "2026-09-21T12:00:00Z" }, now),
    ).toBe(false);
    expect(
      isQuestionExpired({ expires_at: "2026-09-14T11:59:59Z" }, now),
    ).toBe(true);
    expect(isQuestionExpired({}, now)).toBe(false);
  });
});
