/**
 * Livro Excel da página das Perguntas (#105): uma folha com as perguntas
 * e outra com as respostas, no mesmo estilo das folhas das Métricas.
 *
 * Os textos chegam já traduzidos em `labels`, como nas Métricas.
 */
import {
  addDataSheet,
  downloadWorkbook,
} from "@/app/[locale]/(app)/analytics/lib/analytics.excel";

const PERCENT_FORMAT = "0.0%";

export function buildQuestionsWorkbook(workbook, data, labels) {
  workbook.creator = "MyDigitalBot";

  const kind = (value) => labels.kind[value] ?? value;
  const yesNo = (value) =>
    value == null ? null : value ? labels.yes : labels.no;

  addDataSheet(workbook, {
    name: labels.questionsSheet,
    columns: [
      { key: "sentAt", header: labels.sentAt, type: "date", width: 18 },
      { key: "kind", header: labels.kindColumn, width: 16 },
      { key: "question", header: labels.question, width: 48 },
      { key: "channels", header: labels.channels, width: 16 },
      { key: "recipients", header: labels.recipients, type: "number", width: 14 },
      { key: "answered", header: labels.answered, type: "number", width: 14 },
      {
        key: "responseRate",
        header: labels.responseRate,
        type: "number",
        format: PERCENT_FORMAT,
        width: 16,
      },
      {
        key: "correctRate",
        header: labels.correctRate,
        type: "number",
        format: PERCENT_FORMAT,
        width: 16,
      },
      { key: "correctOption", header: labels.correctOption, width: 24 },
      { key: "topOption", header: labels.topOption, width: 24 },
      { key: "expectedAnswer", header: labels.expectedAnswer, width: 36 },
      { key: "reviewNeeded", header: labels.reviewNeeded, type: "number", width: 14 },
      { key: "expiresAt", header: labels.expiresAt, type: "date", width: 18 },
      { key: "id", header: labels.questionId, type: "number", width: 12 },
    ],
    rows: data.questions.map((row) => ({ ...row, kind: kind(row.kind) })),
  });

  addDataSheet(workbook, {
    name: labels.answersSheet,
    columns: [
      { key: "answeredAt", header: labels.answeredAt, type: "date", width: 18 },
      { key: "kind", header: labels.kindColumn, width: 16 },
      { key: "question", header: labels.question, width: 40 },
      { key: "name", header: labels.name, width: 24 },
      { key: "email", header: labels.email, width: 28 },
      { key: "phone", header: labels.phone, width: 16 },
      { key: "tags", header: labels.tags, width: 24 },
      { key: "assistant", header: labels.assistant, width: 20 },
      { key: "channel", header: labels.channel, width: 12 },
      { key: "answer", header: labels.answer, width: 40 },
      { key: "isCorrect", header: labels.isCorrect, width: 10 },
      { key: "verdict", header: labels.verdict, width: 14 },
      { key: "feedback", header: labels.feedback, width: 40 },
      { key: "reviewNeeded", header: labels.reviewNeeded, width: 12 },
      { key: "questionId", header: labels.questionId, type: "number", width: 12 },
      { key: "userId", header: labels.userId, type: "number", width: 12 },
    ],
    rows: data.answers.map((row) => ({
      ...row,
      kind: kind(row.kind),
      isCorrect: yesNo(row.isCorrect),
      verdict: row.verdict ? (labels.verdicts[row.verdict] ?? row.verdict) : null,
      reviewNeeded: yesNo(row.reviewNeeded),
    })),
  });

  return workbook;
}

/** O ExcelJS só é carregado quando se exporta, como nas Métricas. */
export async function exportQuestionsExcel({ data, labels, fileName }) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  buildQuestionsWorkbook(workbook, data, labels);
  await downloadWorkbook(workbook, fileName);
}
