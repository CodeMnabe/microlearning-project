import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BroadcastHeader from "@/app/[locale]/(app)/broadcast/components/BroadcastHeader";

const translation = (key) => key;

function renderHeader(props = {}) {
  render(
    <BroadcastHeader
      channel="whatsapp"
      setChannel={vi.fn()}
      selectedCount={2}
      sending={false}
      canSend
      deliveryMode="now"
      onPrimaryClick={vi.fn()}
      translation={translation}
      {...props}
    />,
  );
}

describe("BroadcastHeader", () => {
  it("enquanto envia, o botão mostra a rodinha e fica desativado", () => {
    renderHeader({ sending: true });

    const button = screen.getByRole("button", { name: "Broadcast.sending" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("sending-spinner")).toBeInTheDocument();
  });

  it("sem envio a decorrer, o botão é o de enviar, sem rodinha", () => {
    renderHeader();

    const button = screen.getByRole("button", { name: "Broadcast.send" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("sending-spinner")).toBeNull();
  });
});
