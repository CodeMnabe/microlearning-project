import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ScheduledEditModal from "@/app/[locale]/(app)/broadcast/scheduled/components/ScheduledEditModal";
import {
  normalizeUser,
} from "@/app/[locale]/(app)/broadcast/scheduled/helpers/recipient.helpers";
import { normalizeBroadcast } from "@/app/[locale]/(app)/broadcast/scheduled/helpers/scheduled.helpers";

const translation = (key) => key;

const orgUsers = [
  { id: 5704, name: "Diogo", phone_number: "+351933000001" },
  { id: 5703, name: "Beatriz", phone_number: "+351938000002" },
  { id: 5702, name: "Alexandre", phone_number: "+351935000003" },
].map(normalizeUser);

function renderModal(payload, { channel = "whatsapp", onSave = vi.fn() } = {}) {
  const item = normalizeBroadcast({
    id: "b-1",
    channel,
    status: "queued",
    scheduled_for: "2099-01-01T12:00:00Z",
    timezone: "Europe/Lisbon",
    payload,
  });

  render(
    <ScheduledEditModal
      item={item}
      orgUsers={orgUsers}
      usersLoading={false}
      translation={translation}
      isEditModalOpen
      closeEditModal={vi.fn()}
      onSave={onSave}
      saving={false}
    />,
  );

  return { onSave };
}

describe("ScheduledEditModal: perguntas", () => {
  it("quiz: mostra a pergunta, as opções e o feedback preenchidos", () => {
    renderModal({
      message: "",
      recipients: [{ userId: 5704 }],
      question: {
        kind: "quiz",
        body: "Qual é a capital?",
        options: [
          { label: "Lisboa", correct: true },
          { label: "Porto", correct: false },
        ],
        feedbackCorrect: "Certo!",
        feedbackIncorrect: "Errado",
      },
    });

    expect(screen.getByDisplayValue("Qual é a capital?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lisboa")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Porto")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Certo!")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Errado")).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
  });

  it("sondagem: mostra a pergunta, as opções e o agradecimento", () => {
    renderModal({
      message: "",
      recipients: [{ userId: 5704 }],
      question: {
        kind: "survey",
        body: "Gostaste?",
        options: [{ label: "Sim" }, { label: "Não" }],
        thanksText: "Obrigado!",
      },
    });

    expect(screen.getByDisplayValue("Gostaste?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sim")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Obrigado!")).toBeInTheDocument();
  });

  it("pergunta aberta: mostra a pergunta e a resposta esperada", () => {
    renderModal({
      message: "",
      recipients: [{ userId: 5704 }],
      question: {
        kind: "open",
        body: "Explica o processo",
        expectedAnswer: "Três passos",
        aiEvaluation: true,
      },
    });

    expect(screen.getByDisplayValue("Explica o processo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Três passos")).toBeInTheDocument();
  });

  it("guardar devolve a pergunta editada", () => {
    const { onSave } = renderModal({
      message: "",
      recipients: [{ userId: 5704 }],
      question: {
        kind: "open",
        body: "Explica o processo",
        expectedAnswer: "Três passos",
        aiEvaluation: true,
      },
    });

    fireEvent.change(screen.getByDisplayValue("Três passos"), {
      target: { value: "Quatro passos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "EditModal.save" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].question).toMatchObject({
      kind: "open",
      expectedAnswer: "Quatro passos",
    });
  });

  it("mensagem em branco continua com o campo de mensagem", () => {
    renderModal({ message: "Olá equipa", recipients: [{ userId: 5704 }] });

    expect(screen.getByDisplayValue("Olá equipa")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});
