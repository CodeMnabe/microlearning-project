import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LinkButtonPreview from "@/app/[locale]/(app)/broadcast/components/LinkButtonPreview";
import { pickLinkButton } from "@/lib/whatsapp/linkButton";

const translation = (key) => key;

const LINKS = [{ key: "guia", label: "Guia passo a passo" }];

describe("LinkButtonPreview", () => {
  it("mostra o botão com o nome do link quando o link vai como botão", () => {
    const linkButton = pickLinkButton({
      message: "Ativa a MFA: {{link.guia}}",
      trackedLinks: LINKS,
    });

    render(
      <LinkButtonPreview linkButton={linkButton} translation={translation} />,
    );

    expect(screen.getByText("Guia passo a passo")).toBeTruthy();
    expect(
      screen.getByText("Broadcast.composer.linkButtonHint"),
    ).toBeTruthy();
  });

  it("não mostra nada quando o link fica no texto", () => {
    const linkButton = pickLinkButton({
      message: "Leste o guia? {{link.guia}}",
      trackedLinks: LINKS,
      hasReplyButtons: true,
    });

    const { container } = render(
      <LinkButtonPreview linkButton={linkButton} translation={translation} />,
    );

    expect(container.textContent).toBe("");
  });
});
