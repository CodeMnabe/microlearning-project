import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import TemplatePreview from "@/app/[locale]/(app)/templates/components/TemplatePreview";
import {
  emptyTemplateForm,
  makeButton,
  presetForm,
} from "@/app/[locale]/(app)/templates/lib/templateComponents";

describe("TemplatePreview", () => {
  it("shows the empty hint for a blank form", () => {
    render(<TemplatePreview form={emptyTemplateForm()} time="10:00" />);
    expect(screen.getByText("preview.empty")).toBeInTheDocument();
  });

  it("renders the preset with example values in place of variables", () => {
    render(
      <TemplatePreview form={presetForm("image_header_quickreplies")} time="10:00" />,
    );

    expect(screen.getByText("preview.image")).toBeInTheDocument();
    expect(
      screen.getByText("Olá João! 🎓 Dica de hoje: Verificar pressão dos pneus"),
    ).toBeInTheDocument();
    expect(screen.getByText("Responda para saber mais")).toBeInTheDocument();
    expect(screen.getByText("Quiz rápido")).toBeInTheDocument();
    expect(screen.getByText("Parar")).toBeInTheDocument();
    expect(screen.getByText("10:00 ✓✓")).toBeInTheDocument();
  });

  it("lists the resolved URL under the frame for link buttons", () => {
    const form = emptyTemplateForm();
    form.body.text = "Olá";
    form.buttons = [
      makeButton("URL", {
        text: "Abrir",
        url: "https://x.com/{{1}}",
        urlExample: "abc",
      }),
    ];
    render(<TemplatePreview form={form} time="10:00" />);

    expect(screen.getByText("Abrir: https://x.com/abc")).toBeInTheDocument();
  });
});
