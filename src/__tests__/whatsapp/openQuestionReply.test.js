import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/repos/messages.repo", () => ({ createMessage: vi.fn(), getMessageByProviderId: vi.fn(), getRecentQuestionMessagesForUser: vi.fn() }));
vi.mock("@/lib/repos/questions.repo", () => ({ createQuestionAnswer: vi.fn(), getQuestionAnswer: vi.fn(), getQuestionById: vi.fn(), updateQuestionAnswerEvaluation: vi.fn() }));
vi.mock("@/lib/services/questions/evaluateOpenQuestion", () => ({ evaluateOpenQuestion: vi.fn() }));
vi.mock("@/lib/services/questions/appendQuestionContext", () => ({ appendQuestionContext: vi.fn() }));
import { handleQuestionReply } from "@/lib/services/questions/handleQuestionReply";

describe("resposta a pergunta aberta", () => {
  const user = { id: 5700, organization_id: 1 };
  let question, deps, args;
  beforeEach(() => {
    question = { id: 10, organization_id: 1, kind: "open", body: "Como verificas os pneus?", expected_answer: "Com os pneus frios.", expires_at: "2099-01-01" };
    const message = { id: 20, user_id: 5700, question_id: 10, content: "João, como verificas os pneus?" };
    deps = {
      getMessageByProviderId: vi.fn(async () => message),
      getRecentQuestionMessagesForUser: vi.fn(async () => [message]),
      getQuestionById: vi.fn(async () => question),
      getQuestionAnswer: vi.fn(async () => null),
      createQuestionAnswer: vi.fn(async () => ({ id: 30 })),
      createMessage: vi.fn(async () => ({ id: 40 })),
      evaluateOpenQuestion: vi.fn(async () => ({ verdict: "parcial", missing_points: ["Temperatura"], feedback: "Falta indicar a temperatura dos pneus." })),
      appendQuestionContext: vi.fn(), updateQuestionAnswerEvaluation: vi.fn(),
    };
    args = { user, payload: { body: { text: { text: "Com um manómetro" } } }, deps,
      sendText: vi.fn(async () => ({ ok: true })),
      resolveThread: vi.fn(async () => ({ threadId: 2, assistant: { id: 7 }, conversationId: "conv_1" })),
    };
  });
  it("reserva a primeira resposta, avalia e envia feedback antes da resposta esperada", async () => {
    const result = await handleQuestionReply(args);
    expect(result).toMatchObject({ handled: true, verdict: "parcial", reviewNeeded: false });
    expect(deps.createQuestionAnswer.mock.invocationCallOrder[0]).toBeLessThan(deps.evaluateOpenQuestion.mock.invocationCallOrder[0]);
    expect(args.sendText.mock.calls.map(([text]) => text)).toEqual(["Falta indicar a temperatura dos pneus.", "Resposta esperada:\nCom os pneus frios."]);
    expect(deps.evaluateOpenQuestion.mock.calls[0][0].question.body).toBe("João, como verificas os pneus?");
    expect(deps.appendQuestionContext).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv_1", answerText: "Com um manómetro", replies: expect.any(Array) }));
    expect(deps.updateQuestionAnswerEvaluation).toHaveBeenCalledWith(30, { verdict: "parcial", aiFeedback: "Falta indicar a temperatura dos pneus.", reviewNeeded: false });
  });
  it("envia só a resposta esperada e marca revisão se a IA falhar", async () => {
    deps.evaluateOpenQuestion.mockRejectedValue(new Error("timeout"));
    expect(await handleQuestionReply(args)).toMatchObject({ reviewNeeded: true, verdict: null });
    expect(args.sendText.mock.calls).toEqual([["Resposta esperada:\nCom os pneus frios."]]);
  });
  it("não avalia quando a IA está desligada", async () => {
    question.options = { aiEvaluation: false };
    expect(await handleQuestionReply(args)).toMatchObject({ reviewNeeded: false, verdict: null });
    expect(deps.evaluateOpenQuestion).not.toHaveBeenCalled();
    expect(args.sendText).toHaveBeenCalledTimes(1);
  });
  it("ignora uma segunda resposta explícita sem avaliar outra vez", async () => {
    args.payload.replyTo = { id: "bird-question" };
    deps.createQuestionAnswer.mockResolvedValue(null);
    expect(await handleQuestionReply(args)).toMatchObject({ outcome: "duplicate" });
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.evaluateOpenQuestion).not.toHaveBeenCalled();
    expect(args.sendText).not.toHaveBeenCalled();
  });
  it("deixa continuar a conversa depois de uma resposta incompleta", async () => {
    deps.getQuestionAnswer.mockResolvedValue({ verdict: "incompleta" });
    expect(await handleQuestionReply(args)).toEqual({ handled: false });
    expect(deps.createQuestionAnswer).not.toHaveBeenCalled();
  });
  it("não envia uma repetição do mesmo evento Bird para o assistente", async () => {
    args.inboundMsgId = "bird-in-1";
    deps.getQuestionAnswer.mockResolvedValue({ inbound_message_id: "bird-in-1" });
    deps.createQuestionAnswer.mockResolvedValue(null);
    expect(await handleQuestionReply(args)).toMatchObject({ handled: true, outcome: "duplicate" });
    expect(deps.evaluateOpenQuestion).not.toHaveBeenCalled();
  });
  it("tenta enviar a resposta esperada mesmo se o envio do feedback lançar erro", async () => {
    args.sendText.mockRejectedValueOnce(new Error("Bird indisponível"));
    expect(await handleQuestionReply(args)).toMatchObject({ reviewNeeded: true });
    expect(args.sendText).toHaveBeenLastCalledWith("Resposta esperada:\nCom os pneus frios.");
  });
  it("avisa numa resposta explícita fora do prazo", async () => {
    question.expires_at = "2020-01-01";
    args.payload.replyTo = { id: "bird-question" };
    expect(await handleQuestionReply(args)).toMatchObject({ outcome: "expired" });
    expect(deps.evaluateOpenQuestion).not.toHaveBeenCalled();
  });
  it("não captura texto vazio, toques na abertura ou texto de pergunta expirada", async () => {
    args.payload.body.text.text = " ";
    expect(await handleQuestionReply(args)).toEqual({ handled: false });
    args.payload.body.text = { text: "Aceito", actions: [{ type: "postback", postback: { payload: "item_0" } }] };
    expect(await handleQuestionReply(args)).toEqual({ handled: false });
    args.payload.body.text = { text: "Olá" };
    question.expires_at = "2020-01-01";
    expect(await handleQuestionReply(args)).toEqual({ handled: false });
  });
  it("não associa a mensagem de outro contacto", async () => {
    args.payload.replyTo = { id: "outro" };
    deps.getMessageByProviderId.mockResolvedValue({ user_id: 8, question_id: 11 });
    deps.getRecentQuestionMessagesForUser.mockResolvedValue([]);
    expect(await handleQuestionReply(args)).toEqual({ handled: false });
    expect(deps.getQuestionById).not.toHaveBeenCalled();
  });
  it("mantém o feedback entregue se guardar o contexto falhar e marca revisão", async () => {
    deps.appendQuestionContext.mockRejectedValue(new Error("indisponível"));
    expect(await handleQuestionReply(args)).toMatchObject({ reviewNeeded: true, verdict: "parcial" });
    expect(args.sendText).toHaveBeenCalledTimes(2);
  });
});
