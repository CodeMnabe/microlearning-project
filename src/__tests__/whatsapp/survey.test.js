import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repos/messages.repo", () => ({
  createMessage: vi.fn(),
  getMessageByProviderId: vi.fn(),
  getRecentQuestionMessagesForUser: vi.fn(),
}));

vi.mock("@/lib/repos/questions.repo", () => ({
  createQuestionAnswer: vi.fn(),
  updateQuestionAnswerEvaluation: vi.fn(),
  getQuestionAnswer: vi.fn(),
  getQuestionById: vi.fn(),
}));

vi.mock("@/lib/services/questions/evaluateOpenQuestion", () => ({
  evaluateOpenQuestion: vi.fn(),
}));

vi.mock("@/lib/services/questions/appendQuestionContext", () => ({
  appendQuestionContext: vi.fn(),
}));

import {
  createMessage,
  getMessageByProviderId,
  getRecentQuestionMessagesForUser,
} from "@/lib/repos/messages.repo";
import {
  createQuestionAnswer,
  getQuestionById,
} from "@/lib/repos/questions.repo";
import { handleQuestionReply } from "@/lib/services/questions/handleQuestionReply";
import { parseQuestionOptions } from "@/lib/services/broadcast/questionOptions";
import { buildQuestionReports } from "@/lib/services/questions/questionReports";
import {
  DEFAULT_SURVEY_THANKS,
  hasReplyButtons,
  makeEmptySurvey,
  normalizeSurvey,
  surveyThanksText,
} from "@/lib/whatsapp/question";

const OPTIONS = [{ label: "Manhã" }, { label: "Tarde" }, { label: "Noite" }];

describe("normalizeSurvey", () => {
  it("accepts a question with 2 to 3 options and an optional thanks text", () => {
    const { survey, error } = normalizeSurvey({
      body: " Qual o melhor horário? ",
      options: [{ label: " Manhã " }, { label: "Tarde", correct: true }],
      thanksText: " Obrigado! ",
    });

    expect(error).toBeUndefined();
    expect(survey).toEqual({
      kind: "survey",
      body: "Qual o melhor horário?",
      options: [{ label: "Manhã" }, { label: "Tarde" }],
      thanksText: "Obrigado!",
    });
  });

  it("rejects empty questions, bad option counts and duplicates", () => {
    expect(normalizeSurvey({ body: "", options: OPTIONS }).error).toMatch(
      /empty/,
    );
    expect(normalizeSurvey({ body: "Q", options: [OPTIONS[0]] }).error).toMatch(
      /between 2 and 3/,
    );
    expect(
      normalizeSurvey({
        body: "Q",
        options: [{ label: "Manhã" }, { label: "manhã" }],
      }).error,
    ).toMatch(/different/);
  });

  it("starts empty and invalid, and is a button kind", () => {
    expect(normalizeSurvey(makeEmptySurvey()).error).toBeTruthy();
    expect(hasReplyButtons("survey")).toBe(true);
    expect(hasReplyButtons("open")).toBe(false);
  });

  it("is accepted by the request parser", () => {
    expect(
      parseQuestionOptions({
        question: { kind: "survey", body: "Q", options: OPTIONS },
      }).question,
    ).toMatchObject({ kind: "survey", thanksText: "" });
  });
});

describe("surveyThanksText", () => {
  it("uses the admin text stored in feedback_correct, else the default", () => {
    expect(surveyThanksText({ feedback_correct: "Obrigado!" })).toBe(
      "Obrigado!",
    );
    expect(surveyThanksText({ feedback_correct: null })).toBe(
      DEFAULT_SURVEY_THANKS,
    );
  });
});

describe("handleQuestionReply for a survey", () => {
  const USER = { id: 42, organization_id: 1, name: "Pedro" };
  const QUESTION = {
    id: 20,
    organization_id: 1,
    kind: "survey",
    body: "Qual o melhor horário?",
    options: OPTIONS,
    feedback_correct: "Obrigado pela escolha, {{nome}}!",
    expires_at: "2099-01-01T00:00:00Z",
  };
  const MESSAGE = {
    id: 600,
    user_id: 42,
    message_id: "bird-out-1",
    question_id: 20,
    created_at: "2026-09-14T10:00:00Z",
  };

  let sendText;

  beforeEach(() => {
    vi.clearAllMocks();
    createMessage.mockImplementation(async (row) => ({ id: 901, ...row }));
    getMessageByProviderId.mockResolvedValue(MESSAGE);
    getRecentQuestionMessagesForUser.mockResolvedValue([]);
    getQuestionById.mockResolvedValue(QUESTION);
    createQuestionAnswer.mockResolvedValue({ id: 88 });
    sendText = vi.fn(async () => ({
      ok: true,
      providerMessageId: "bird-out-2",
    }));
  });

  it("records the choice without right or wrong and sends the thanks text", async () => {
    const result = await handleQuestionReply({
      user: USER,
      payload: {
        body: {
          type: "text",
          text: {
            text: "Tarde",
            actions: [
              {
                type: "postback",
                postback: { text: "Tarde", payload: "item_1" },
              },
            ],
          },
        },
        replyTo: { id: "bird-out-1", order: 0, type: "click" },
      },
      inboundMsgId: "bird-in-1",
      sendText,
      resolveThread: async () => ({ threadId: 3, assistantId: 7 }),
    });

    expect(result).toMatchObject({
      handled: true,
      outcome: "answered",
      optionIndex: 1,
      isCorrect: null,
      feedback: "Obrigado pela escolha, Pedro!",
    });
    expect(createQuestionAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 20,
        optionIndex: 1,
        isCorrect: null,
        answerText: "Tarde",
      }),
    );
    expect(sendText).toHaveBeenCalledWith("Obrigado pela escolha, Pedro!");
  });

  it("keeps only the first choice", async () => {
    createQuestionAnswer.mockResolvedValue(null);

    const result = await handleQuestionReply({
      user: USER,
      payload: {
        body: {
          type: "text",
          text: {
            text: "Noite",
            actions: [
              {
                type: "postback",
                postback: { text: "Noite", payload: "item_2" },
              },
            ],
          },
        },
        replyTo: { id: "bird-out-1" },
      },
      sendText,
      resolveThread: async () => null,
    });

    expect(result).toMatchObject({ handled: true, outcome: "duplicate" });
    expect(sendText).not.toHaveBeenCalled();
  });
});

describe("buildQuestionReports for a survey", () => {
  it("counts the choices per option and has no correct rate", () => {
    const [report] = buildQuestionReports({
      questions: [
        {
          id: 20,
          kind: "survey",
          body: "Qual o melhor horário?",
          options: OPTIONS,
          created_at: "2026-09-14T10:00:00Z",
        },
      ],
      messages: [
        { question_id: 20, user_id: 1, created_at: "2026-09-14T10:00:01Z" },
        { question_id: 20, user_id: 2, created_at: "2026-09-14T10:00:02Z" },
        { question_id: 20, user_id: 3, created_at: "2026-09-14T10:00:03Z" },
      ],
      answers: [
        { question_id: 20, user_id: 1, option_index: 1, answered_at: "a" },
        { question_id: 20, user_id: 2, option_index: 1, answered_at: "b" },
        { question_id: 20, user_id: 3, option_index: 0, answered_at: "c" },
      ],
    });

    expect(report).toMatchObject({
      kind: "survey",
      recipientCount: 3,
      answeredCount: 3,
      optionCounts: [1, 2, 0],
      correctCount: null,
      correctRate: null,
      verdicts: null,
    });
  });
});
