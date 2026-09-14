import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repos/messages.repo", () => ({
  createMessage: vi.fn(),
  getMessageByProviderId: vi.fn(),
  getRecentQuestionMessagesForUser: vi.fn(),
}));

vi.mock("@/lib/repos/questions.repo", () => ({
  createQuestionAnswer: vi.fn(),
  getQuestionAnswer: vi.fn(),
  getQuestionById: vi.fn(),
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
import { EXPIRED_QUESTION_TEXT } from "@/lib/whatsapp/question";

const USER = { id: 42, organization_id: 1, assistant_id: 7 };

const QUESTION = {
  id: 10,
  organization_id: 1,
  kind: "quiz",
  body: "Qual é a pressão certa dos pneus?",
  options: [
    { label: "2,2 bar", correct: false },
    { label: "2,8 bar", correct: true },
    { label: "3,5 bar", correct: false },
  ],
  feedback_correct: null,
  feedback_incorrect: null,
  expires_at: "2099-01-01T00:00:00Z",
};

const QUESTION_MESSAGE = {
  id: 500,
  message_id: "bird-out-1",
  question_id: 10,
  role: "assistant",
};

function tap(index, label, replyToId = "bird-out-1") {
  return {
    body: {
      type: "text",
      text: {
        text: label,
        actions: [
          { type: "postback", postback: { text: label, payload: `item_${index}` } },
        ],
      },
    },
    replyTo: { id: replyToId, order: 0, type: "click" },
  };
}

function typed(text) {
  return { body: { type: "text", text: { text } } };
}

describe("handleQuestionReply", () => {
  let sendText;
  let resolveThread;

  beforeEach(() => {
    vi.clearAllMocks();

    createMessage.mockImplementation(async (row) => ({ id: 900, ...row }));
    getMessageByProviderId.mockResolvedValue(null);
    getRecentQuestionMessagesForUser.mockResolvedValue([]);
    getQuestionById.mockResolvedValue(QUESTION);
    createQuestionAnswer.mockResolvedValue({ id: 77 });

    sendText = vi.fn(async () => ({ ok: true, providerMessageId: "bird-out-2" }));
    resolveThread = vi.fn(async () => ({ threadId: 3, assistantId: 7 }));
  });

  it("records a tap on a quiz button, sends the feedback and skips the assistant", async () => {
    getMessageByProviderId.mockResolvedValue(QUESTION_MESSAGE);

    const result = await handleQuestionReply({
      user: USER,
      payload: tap(1, "2,8 bar"),
      inboundMsgId: "bird-in-1",
      contactId: "contact-1",
      sendText,
      resolveThread,
    });

    expect(getMessageByProviderId).toHaveBeenCalledWith("bird-out-1", 1);
    expect(result).toMatchObject({
      handled: true,
      outcome: "answered",
      questionId: 10,
      optionIndex: 1,
      matchedBy: "postback",
      isCorrect: true,
      feedback: "Certo! ✅",
    });

    expect(createQuestionAnswer).toHaveBeenCalledWith({
      questionId: 10,
      organizationId: 1,
      userId: 42,
      messageId: 500,
      inboundMessageId: "bird-in-1",
      answerText: "2,8 bar",
      optionIndex: 1,
      isCorrect: true,
    });

    expect(sendText).toHaveBeenCalledWith("Certo! ✅");

    /* A resposta e o feedback ficam na thread do contacto. */
    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(createMessage.mock.calls[0][0]).toMatchObject({
      threadId: 3,
      role: "user",
      content: "2,8 bar",
      messageId: "bird-in-1",
    });
    expect(createMessage.mock.calls[1][0]).toMatchObject({
      threadId: 3,
      role: "assistant",
      content: "Certo! ✅",
      messageId: "bird-out-2",
      deliveryStatus: "accepted",
    });
  });

  it("sends the wrong-answer feedback with the correct option", async () => {
    getMessageByProviderId.mockResolvedValue(QUESTION_MESSAGE);

    const result = await handleQuestionReply({
      user: USER,
      payload: tap(2, "3,5 bar"),
      sendText,
      resolveThread,
    });

    expect(result).toMatchObject({ outcome: "answered", isCorrect: false });
    expect(sendText).toHaveBeenCalledWith(
      "Não é essa. A resposta certa é: 2,8 bar",
    );
  });

  it("keeps only the first answer: a second tap is stored but gets no feedback", async () => {
    getMessageByProviderId.mockResolvedValue(QUESTION_MESSAGE);
    createQuestionAnswer.mockResolvedValue(null);

    const result = await handleQuestionReply({
      user: USER,
      payload: tap(0, "2,2 bar"),
      inboundMsgId: "bird-in-2",
      sendText,
      resolveThread,
    });

    expect(result).toMatchObject({ handled: true, outcome: "duplicate" });
    expect(sendText).not.toHaveBeenCalled();
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage.mock.calls[0][0]).toMatchObject({ role: "user" });
  });

  it("tells the contact when the quiz no longer accepts answers", async () => {
    getMessageByProviderId.mockResolvedValue(QUESTION_MESSAGE);
    getQuestionById.mockResolvedValue({
      ...QUESTION,
      expires_at: "2020-01-01T00:00:00Z",
    });

    const result = await handleQuestionReply({
      user: USER,
      payload: tap(1, "2,8 bar"),
      sendText,
      resolveThread,
    });

    expect(result).toMatchObject({ handled: true, outcome: "expired" });
    expect(createQuestionAnswer).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(EXPIRED_QUESTION_TEXT);
  });

  it("ignores taps on buttons that are not a quiz, such as the opening 'Aceito'", async () => {
    getMessageByProviderId.mockResolvedValue({
      id: 1,
      message_id: "bird-opening",
      question_id: null,
    });

    const result = await handleQuestionReply({
      user: USER,
      payload: tap(0, "Aceito", "bird-opening"),
      sendText,
      resolveThread,
    });

    expect(result).toEqual({ handled: false });
    expect(getRecentQuestionMessagesForUser).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("accepts a typed answer equal to an option of the latest quiz", async () => {
    getRecentQuestionMessagesForUser.mockResolvedValue([QUESTION_MESSAGE]);

    const result = await handleQuestionReply({
      user: USER,
      payload: typed("2,8 BAR"),
      sendText,
      resolveThread,
    });

    expect(getRecentQuestionMessagesForUser).toHaveBeenCalledWith(42, 1);
    expect(result).toMatchObject({
      outcome: "answered",
      matchedBy: "text",
      optionIndex: 1,
      isCorrect: true,
    });
  });

  it("lets other text go on to the assistant", async () => {
    getRecentQuestionMessagesForUser.mockResolvedValue([QUESTION_MESSAGE]);

    const result = await handleQuestionReply({
      user: USER,
      payload: typed("Porquê 2,8?"),
      sendText,
      resolveThread,
    });

    expect(result).toEqual({ handled: false });
    expect(sendText).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("does not treat text as an answer when there is no quiz for the contact", async () => {
    const result = await handleQuestionReply({
      user: USER,
      payload: typed("2,8 bar"),
      sendText,
      resolveThread,
    });

    expect(result).toEqual({ handled: false });
    expect(getQuestionById).not.toHaveBeenCalled();
  });
});
