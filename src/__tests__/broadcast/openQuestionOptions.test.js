import { describe, expect, it } from "vitest";
import { parseQuestionOptions } from "@/lib/services/broadcast/questionOptions";

describe("opções de pergunta aberta", () => {
  const question = { kind: "open", body: " Pergunta\r\ntexto ", expectedAnswer: " Resposta " };
  it("normaliza e liga a IA por omissão, incluindo payloads agendados", () => {
    expect(parseQuestionOptions({ question })).toEqual({ question: { kind: "open", body: "Pergunta\ntexto", expectedAnswer: "Resposta", aiEvaluation: true } });
    expect(parseQuestionOptions({ question: { ...question, aiEvaluation: false } }).question.aiEvaluation).toBe(false);
  });
  it.each([{ body: "" }, { expectedAnswer: " " }, { body: "x".repeat(1025) }, { expectedAnswer: "x".repeat(1025) }, { aiEvaluation: "false" }])("rejeita campos inválidos (%j)", (patch) => {
    expect(parseQuestionOptions({ question: { ...question, ...patch } }).error).toBeTruthy();
  });
});
