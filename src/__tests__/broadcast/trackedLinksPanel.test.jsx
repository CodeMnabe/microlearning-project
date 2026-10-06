import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TrackedLinksPanel from "@/app/[locale]/(app)/broadcast/components/panels/TrackedLinksPanel";

const translation = (key) => key;

const GUIA = {
  key: "guia",
  label: "Guia MFA",
  destinationUrl: "https://exemplo.pt/mfa",
  lastUsedAt: "2026-10-01T10:00:00Z",
};

const CURSO = {
  key: "curso",
  label: "Formação Excel",
  destinationUrl: "https://cursos.pt/excel",
  lastUsedAt: "2026-09-20T10:00:00Z",
};

function renderPanel({ trackedLinks = [], library = {}, onUse = vi.fn() } = {}) {
  render(
    <TrackedLinksPanel
      trackedLinks={trackedLinks}
      trackedLinksValid
      addTrackedLink={vi.fn()}
      updateTrackedLink={vi.fn()}
      removeTrackedLink={vi.fn()}
      library={{
        items: [GUIA, CURSO],
        loading: false,
        failed: false,
        reload: vi.fn(),
        ...library,
      }}
      onUseLibraryLink={onUse}
      translation={translation}
    />,
  );

  return { onUse };
}

describe("TrackedLinksPanel: links já usados", () => {
  it("mostra os links já usados e escolhe um com Usar", () => {
    const { onUse } = renderPanel();

    expect(screen.getByText("Guia MFA")).toBeTruthy();
    expect(screen.getByText("https://cursos.pt/excel")).toBeTruthy();

    const [firstUse] = screen.getAllByRole("button", {
      name: "Broadcast.linkLibrary.use",
    });
    fireEvent.click(firstUse);

    expect(onUse).toHaveBeenCalledWith(GUIA);
  });

  it("marca como adicionado o link que já está na mensagem", () => {
    renderPanel({
      trackedLinks: [{ id: "1", key: "outra", ...GUIA }],
    });

    const added = screen.getByRole("button", {
      name: "Broadcast.linkLibrary.added",
    });
    expect(added.disabled).toBe(true);
    expect(
      screen.getAllByRole("button", { name: "Broadcast.linkLibrary.use" }),
    ).toHaveLength(1);
  });

  it("com um link na mensagem, não deixa juntar outro e explica porquê", () => {
    renderPanel({
      trackedLinks: [{ id: "1", key: "guia", ...GUIA }],
    });

    expect(
      screen.getByRole("button", { name: "Broadcast.addLink" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Broadcast.linkLibrary.use" }),
    ).toBeDisabled();
    expect(screen.getByText("Broadcast.linkLimitHint")).toBeTruthy();
  });

  it("sem links na mensagem, deixa juntar um", () => {
    renderPanel();

    expect(
      screen.getByRole("button", { name: "Broadcast.addLink" }),
    ).toBeEnabled();
    expect(screen.queryByText("Broadcast.linkLimitHint")).toBeNull();
  });

  it("filtra a lista pela pesquisa", () => {
    renderPanel();

    fireEvent.change(
      screen.getByPlaceholderText("Broadcast.linkLibrary.search"),
      { target: { value: "excel" } },
    );

    expect(screen.queryByText("Guia MFA")).toBeNull();
    expect(screen.getByText("Formação Excel")).toBeTruthy();
  });

  it("deixa tentar outra vez quando a lista não carrega", () => {
    const reload = vi.fn();
    renderPanel({ library: { items: [], failed: true, reload } });

    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.linkLibrary.retry" }),
    );

    expect(reload).toHaveBeenCalled();
  });

  it("não mostra a secção quando ainda não há links usados", () => {
    renderPanel({ library: { items: [] } });

    expect(screen.queryByText("Broadcast.linkLibrary.title")).toBeNull();
  });
});
