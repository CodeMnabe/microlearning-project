import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import TemplateComponentsEditor from "@/app/[locale]/(app)/templates/components/TemplateComponentsEditor";
import {
  emptyTemplateForm,
  makeButton,
  validateTemplateForm,
} from "@/app/[locale]/(app)/templates/lib/templateComponents";

// Small stateful wrapper so the editor behaves like it does inside the page.
function Harness({ initial = emptyTemplateForm(), errors = [], onForm }) {
  const [form, setForm] = useState(initial);
  return (
    <TemplateComponentsEditor
      form={form}
      errors={errors}
      onChange={(next) => {
        setForm(next);
        onForm?.(next);
      }}
    />
  );
}

describe("TemplateComponentsEditor", () => {
  it("shows an example input for each body variable", () => {
    render(<Harness />);

    const body = screen.getByLabelText("editor.body.title");
    fireEvent.change(body, { target: { value: "Olá {{1}}, dica {{2}}" } });

    expect(screen.getByText("{{1}}")).toBeInTheDocument();
    expect(screen.getByText("{{2}}")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/editor\.body\.exampleFor/)).toHaveLength(2);
  });

  it("appends the next variable with the add button", () => {
    let latest;
    render(<Harness onForm={(f) => (latest = f)} />);

    const body = screen.getByLabelText("editor.body.title");
    fireEvent.change(body, { target: { value: "Olá" } });
    fireEvent.click(screen.getByText("editor.body.addVariable"));
    fireEvent.click(screen.getByText("editor.body.addVariable"));

    expect(latest.body.text).toBe("Olá {{1}} {{2}}");
    expect(latest.body.examples).toEqual(["", ""]);
  });

  it("reveals header fields only for the chosen header type", () => {
    render(<Harness />);

    expect(screen.queryByLabelText("editor.header.text")).toBeNull();

    fireEvent.change(screen.getByLabelText("editor.header.title"), {
      target: { value: "text" },
    });
    expect(screen.getByLabelText("editor.header.text")).toBeInTheDocument();
    expect(screen.queryByLabelText("editor.header.example")).toBeNull();

    fireEvent.change(screen.getByLabelText("editor.header.text"), {
      target: { value: "Olá {{1}}" },
    });
    expect(screen.getByLabelText("editor.header.example")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("editor.header.title"), {
      target: { value: "image" },
    });
    expect(screen.getByLabelText("editor.header.imageUrl")).toBeInTheDocument();
    expect(screen.queryByLabelText("editor.header.text")).toBeNull();
  });

  it("adds and removes buttons, showing the URL example only when needed", () => {
    let latest;
    render(<Harness onForm={(f) => (latest = f)} />);

    fireEvent.click(screen.getByText("editor.buttons.addQuickReply"));
    fireEvent.click(screen.getByText("editor.buttons.addUrl"));

    expect(latest.buttons.map((b) => b.type)).toEqual(["QUICK_REPLY", "URL"]);
    expect(screen.getAllByLabelText("editor.buttons.text")).toHaveLength(2);

    const urlInput = screen.getByLabelText("editor.buttons.url");
    fireEvent.change(urlInput, { target: { value: "https://x.com/{{1}}" } });
    expect(screen.getByLabelText("editor.buttons.urlExample")).toBeInTheDocument();

    // The next-intl mock drops interpolation params, so both buttons share a label.
    fireEvent.click(screen.getAllByLabelText("editor.buttons.remove")[0]);
    expect(latest.buttons.map((b) => b.type)).toEqual(["URL"]);
  });

  it("disables adding a third URL button", () => {
    const initial = emptyTemplateForm();
    initial.buttons = [
      makeButton("URL", { text: "A", url: "https://a.com" }),
      makeButton("URL", { text: "B", url: "https://b.com" }),
    ];
    render(<Harness initial={initial} />);

    expect(screen.getByText("editor.buttons.addUrl")).toBeDisabled();
    expect(screen.getByText("editor.buttons.addQuickReply")).toBeEnabled();
  });

  it("renders validation errors next to the field they belong to", () => {
    const form = emptyTemplateForm();
    const button = makeButton("QUICK_REPLY", { text: "" });
    form.buttons = [button];
    const errors = validateTemplateForm(form);

    render(<Harness initial={form} errors={errors} />);

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(
      within(alerts[0]).getByText("editor.errors.bodyRequired"),
    ).toBeInTheDocument();
    expect(
      within(alerts[1]).getByText("editor.errors.buttonTextRequired"),
    ).toBeInTheDocument();
  });
});
