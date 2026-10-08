import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildQuestionExport } from "@/lib/services/questions/questionExport";
import { buildQuestionsWorkbook } from "@/app/[locale]/(app)/broadcast/questions/lib/questions.excel";

const QUIZ = {
  id: 1,
  kind: "quiz",
  body: "Qual é a pressão certa?",
  options: [
    { label: "2,2 bar", correct: false },
    { label: "2,8 bar", correct: true },
  ],
  created_at: "2026-09-14T13:26:03Z",
  expires_at: "2026-09-21T13:26:02Z",
};

const OPEN = {
  id: 2,
  kind: "open",
  body: "Como verificas os pneus?",
  options: null,
  expected_answer: "Com os pneus frios.",
  created_at: "2026-09-14T15:00:00Z",
  expires_at: "2026-09-21T15:00:00Z",
};

const MESSAGES = [
  { question_id: 1, user_id: 10, channel: "whatsapp", assistant_id: 5, created_at: "2026-09-14T13:26:04Z" },
  { question_id: 1, user_id: 11, channel: "teams", assistant_id: 6, created_at: "2026-09-14T13:26:05Z" },
  { question_id: 2, user_id: 10, channel: "whatsapp", assistant_id: 5, created_at: "2026-09-14T15:00:01Z" },
];

const ANSWERS = [
  { id: 100, question_id: 1, user_id: 11, option_index: 1, is_correct: true, answered_at: "2026-09-14T13:30:00Z" },
  { id: 101, question_id: 2, user_id: 10, answer_text: "Com eles frios", verdict: "parcial", admin_verdict: "completa", ai_feedback: "Boa!", review_needed: false, answered_at: "2026-09-14T15:10:00Z" },
];

const USERS = new Map([
  ["10", { id: 10, name: "Ana", email: "ana@x.pt", tags: "Lisboa" }],
  ["11", { id: 11, name: "Rui", email: "rui@x.pt", tags: "Porto, Turno A" }],
]);

const ASSISTANTS = new Map([
  ["5", "Assistente RH"],
  ["6", "Assistente Frota"],
]);

function build() {
  return buildQuestionExport({
    questions: [QUIZ, OPEN],
    messages: MESSAGES,
    answers: ANSWERS,
    users: USERS,
    assistantNames: ASSISTANTS,
  });
}

describe("exportação das perguntas", () => {
  it("resume cada pergunta e liga cada resposta ao envio e ao colaborador", () => {
    const { questions, answers } = build();
    const quiz = questions.find((row) => row.id === 1);

    expect(quiz).toMatchObject({
      channels: "whatsapp, teams",
      recipients: 2,
      answered: 1,
      responseRate: 0.5,
      correctRate: 1,
      correctOption: "2,8 bar",
      topOption: "2,8 bar (1)",
    });

    expect(answers).toEqual([
      expect.objectContaining({
        name: "Rui",
        tags: "Porto, Turno A",
        channel: "teams",
        assistant: "Assistente Frota",
        answer: "2,8 bar",
        isCorrect: true,
        verdict: null,
      }),
      expect.objectContaining({
        name: "Ana",
        assistant: "Assistente RH",
        answer: "Com eles frios",
        isCorrect: null,
        verdict: "completa",
        feedback: "Boa!",
      }),
    ]);
  });

  it("escreve as folhas Perguntas e Respostas com os textos traduzidos", () => {
    const labels = {
      questionsSheet: "Perguntas",
      answersSheet: "Respostas",
      yes: "Sim",
      no: "Não",
      kind: { quiz: "Quiz", open: "Pergunta aberta" },
      verdicts: { completa: "Completa" },
    };

    const workbook = buildQuestionsWorkbook(new ExcelJS.Workbook(), build(), labels);
    const [questionsSheet, answersSheet] = workbook.worksheets;

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Perguntas",
      "Respostas",
    ]);

    const rate = questionsSheet.getCell("G3");
    expect(rate.value).toBe(0.5);
    expect(rate.numFmt).toBe("0.0%");

    const answerValues = answersSheet.getRow(2).values.concat(
      answersSheet.getRow(3).values,
    );
    expect(answerValues).toEqual(
      expect.arrayContaining(["Quiz", "Sim", "Pergunta aberta", "Completa"]),
    );
  });
});
