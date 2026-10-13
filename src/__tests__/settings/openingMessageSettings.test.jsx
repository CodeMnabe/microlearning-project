import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { registerAppModulePacks, resetAppMocks } from "../utils/mocks";

registerAppModulePacks();

import OpeningMessageSettings from "@/app/[locale]/(app)/settings/components/OpeningMessageSettings";

describe("OpeningMessageSettings", () => {
  const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

  beforeEach(() => {
    resetAppMocks();
    mocks.fetch.mockClear();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the approved message and updates the organization sample", () => {
    const { rerender } = render(
      <OpeningMessageSettings orgId={7} orgName="Digik" />,
    );

    const preview = screen.getByTestId("whatsapp-phone");
    expect(preview).toHaveTextContent(
      "O teu acesso ao assistente MyDigitalBot, disponibilizado por Digik, foi ativado.",
    );
    expect(preview).toHaveTextContent("Para o abrir, toca no botão abaixo.");
    expect(preview).toHaveTextContent("Aceder ao Assistente");
    expect(preview).not.toHaveTextContent("{{nome}}");
    expect(preview).not.toHaveTextContent("{{empresa}}");

    rerender(<OpeningMessageSettings orgId={7} orgName="ASP" />);
    expect(preview).toHaveTextContent("disponibilizado por ASP");
    expect(preview).not.toHaveTextContent("disponibilizado por Digik");
  });

  it("offers no editor or save controls and does not load or save a custom body", () => {
    render(<OpeningMessageSettings orgId={7} orgName="Digik" />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("counter")).not.toBeInTheDocument();
    expect(screen.queryByText("Aceito")).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
