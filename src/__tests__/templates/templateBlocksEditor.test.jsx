import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import TemplateBlocksEditor from "@/app/[locale]/(app)/templates/components/TemplateBlocksEditor";
import {
  emptyTemplateForm,
  makeButton,
  presetForm,
  validateTemplateForm,
} from "@/app/[locale]/(app)/templates/lib/templateComponents";

function Harness({ initial = emptyTemplateForm(), errors = [], onForm }) {
  const [form, setForm] = useState(initial);
  return (
    <TemplateBlocksEditor
      form={form}
      errors={errors}
      context={{ companyName: "Digik" }}
      onChange={(next) => {
        setForm(next);
        onForm?.(next);
      }}
    />
  );
}

const openMenu = () => fireEvent.click(screen.getByText("+ builder.add.label"));
const menuItem = (key) =>
  screen.getByRole("menuitem", { name: new RegExp(`builder.blocks.${key}.title`) });

describe("TemplateBlocksEditor", () => {
  it("starts with only the message block", () => {
    render(<Harness />);

    expect(screen.getByText("builder.blocks.body.title")).toBeInTheDocument();
    expect(screen.queryByText("builder.blocks.footer.title")).toBeNull();
    expect(screen.queryByText("builder.blocks.quick.title")).toBeNull();
    expect(screen.queryByText("builder.blocks.link.title")).toBeNull();
  });

  it("adds and removes optional blocks through the menu", () => {
    let latest;
    render(<Harness onForm={(f) => (latest = f)} />);

    openMenu();
    fireEvent.click(menuItem("footer"));
    expect(screen.getByText("builder.blocks.footer.title")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("builder.blocks.footer.title"), {
      target: { value: "Responda STOP" },
    });
    expect(latest.footer).toBe("Responda STOP");

    fireEvent.click(
      screen.getByLabelText("builder.remove: builder.blocks.footer.title"),
    );
    expect(screen.queryByText("builder.blocks.footer.title")).toBeNull();
    expect(latest.footer).toBe("");
  });

  it("allows only one block on top", () => {
    render(<Harness />);

    openMenu();
    fireEvent.click(menuItem("image"));
    expect(screen.getByLabelText("builder.blocks.image.url")).toBeInTheDocument();

    openMenu();
    expect(menuItem("title")).toBeDisabled();
    expect(screen.getByText("builder.add.onlyOneTop")).toBeInTheDocument();
  });

  it("keeps quick replies before link buttons", () => {
    let latest;
    render(<Harness onForm={(f) => (latest = f)} />);

    openMenu();
    fireEvent.click(menuItem("link"));
    openMenu();
    fireEvent.click(menuItem("quick"));

    expect(latest.buttons.map((b) => b.type)).toEqual(["QUICK_REPLY", "URL"]);

    fireEvent.click(screen.getByText("+ builder.blocks.quick.add"));
    expect(latest.buttons.map((b) => b.type)).toEqual([
      "QUICK_REPLY",
      "QUICK_REPLY",
      "URL",
    ]);
  });

  it("toggles the per-contact suffix on link buttons", () => {
    let latest;
    const initial = emptyTemplateForm();
    initial.buttons = [makeButton("URL", { text: "Abrir", url: "https://x.com/q/" })];
    render(<Harness initial={initial} onForm={(f) => (latest = f)} />);

    fireEvent.click(screen.getByLabelText("builder.blocks.link.dynamic"));
    expect(latest.buttons[0].url).toBe("https://x.com/q/{{1}}");
    expect(screen.getByLabelText("builder.blocks.link.example")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("builder.blocks.link.url"), {
      target: { value: "https://x.com/quiz/" },
    });
    expect(latest.buttons[0].url).toBe("https://x.com/quiz/{{1}}");

    fireEvent.click(screen.getByLabelText("builder.blocks.link.dynamic"));
    expect(latest.buttons[0].url).toBe("https://x.com/quiz/");
  });

  it("inserts a variable chip with a default example and opens the inspector for free text", () => {
    let latest;
    render(<Harness onForm={(f) => (latest = f)} />);

    fireEvent.click(screen.getByText("+ builder.variables.kinds.company"));
    expect(latest.body.text).toBe("{{1}} ");
    expect(latest.body.kinds).toEqual(["company"]);
    expect(latest.body.examples).toEqual(["Digik"]);
    expect(screen.queryByTestId("variable-inspector")).toBeNull();

    fireEvent.click(screen.getByText("+ builder.variables.kinds.custom"));
    expect(latest.body.kinds).toEqual(["company", "custom"]);
    const inspector = screen.getByTestId("variable-inspector");
    expect(inspector).toBeInTheDocument();

    fireEvent.change(within(inspector).getByLabelText("builder.variables.inspector.example"), {
      target: { value: "Pneus" },
    });
    expect(latest.body.examples).toEqual(["Digik", "Pneus"]);

    fireEvent.click(within(inspector).getByText("builder.variables.inspector.remove"));
    expect(latest.body.text).toBe("{{1}} ");
    expect(latest.body.kinds).toEqual(["company"]);
    expect(screen.queryByTestId("variable-inspector")).toBeNull();
  });

  it("shows the preset blocks and places errors in the right block", () => {
    const form = presetForm("quiz_url_button");
    form.buttons[3].url = "not a url";
    const errors = validateTemplateForm(form);

    render(<Harness initial={form} errors={errors} />);

    expect(screen.getByText("builder.blocks.quick.title")).toBeInTheDocument();
    expect(screen.getByText("builder.blocks.link.title")).toBeInTheDocument();
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(
      within(alerts[0]).getByText("editor.errors.buttonUrlInvalid"),
    ).toBeInTheDocument();
  });
});
