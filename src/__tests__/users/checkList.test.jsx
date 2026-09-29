import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-intl", () => ({
  useTranslations: () => (key) => key,
}));

import CheckList from "@/app/[locale]/(app)/users/CheckList/CheckList";

const ITEMS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: i === 6 ? "Segurança" : `Assistente ${i + 1}`,
}));

describe("CheckList", () => {
  it("mostra primeiro os selecionados ao abrir e marca a linha ao clicar no nome", async () => {
    const onToggle = vi.fn();

    render(
      <CheckList
        label="Assistentes"
        items={ITEMS}
        selectedIds={[7]}
        initialSelectedIds={[7]}
        onToggle={onToggle}
      />,
    );

    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Segurança");

    await userEvent.click(screen.getByText("Assistente 2"));
    expect(onToggle).toHaveBeenCalledWith(2);
  });

  it("filtra pela pesquisa sem acentos e deixa escolher o ativo", async () => {
    const onMakeActive = vi.fn();

    render(
      <CheckList
        label="Assistentes"
        items={ITEMS}
        selectedIds={[1, 7]}
        initialSelectedIds={[1, 7]}
        onToggle={() => {}}
        activeId={1}
        onMakeActive={onMakeActive}
      />,
    );

    await userEvent.type(screen.getByRole("searchbox"), "seguranca");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "makeActive" }));
    expect(onMakeActive).toHaveBeenCalledWith(7);
  });
});
