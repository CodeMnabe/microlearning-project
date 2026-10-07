import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TokenTextEditor, {
  serializeEditor,
} from "@/app/[locale]/(app)/broadcast/components/TokenTextEditor";

function tokenLabel(key) {
  const k = key.toLowerCase();
  if (k === "nome") return "Nome";
  if (k === "empresa") return "Empresa";
  if (k.startsWith("link.")) return `Link: ${k.slice(5)}`;
  return null;
}

describe("TokenTextEditor", () => {
  it("renders known tokens as chips and keeps unknown tokens as text", () => {
    render(
      <TokenTextEditor
        value="Olá {{nome}}, vê {{link.curso}} e {{outro}}"
        tokenLabel={tokenLabel}
        onChange={() => {}}
        ariaLabel="Mensagem"
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    const chips = editor.querySelectorAll("[data-token]");

    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("Nome");
    expect(chips[0].getAttribute("data-token")).toBe("{{nome}}");
    expect(chips[1]).toHaveTextContent("Link: curso");
    expect(editor.textContent).toBe("Olá Nome, vê Link: curso e {{outro}}");
    expect(serializeEditor(editor)).toBe(
      "Olá {{nome}}, vê {{link.curso}} e {{outro}}",
    );
  });

  it("emits the text with tokens when the user types", () => {
    const onChange = vi.fn();

    render(
      <TokenTextEditor
        value="Olá {{nome}}"
        tokenLabel={tokenLabel}
        onChange={onChange}
        ariaLabel="Mensagem"
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    editor.appendChild(document.createTextNode(", tudo bem?"));
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledWith("Olá {{nome}}, tudo bem?");
  });

  it("inserts a chip through the ref and reports the new text", () => {
    const onChange = vi.fn();
    const ref = createRef();

    render(
      <TokenTextEditor
        ref={ref}
        value="Bem-vindo à "
        tokenLabel={tokenLabel}
        onChange={onChange}
        ariaLabel="Mensagem"
      />,
    );

    ref.current.insertToken("empresa");

    expect(onChange).toHaveBeenCalledWith("Bem-vindo à {{empresa}} ");

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    expect(editor.querySelector("[data-token]")).toHaveTextContent("Empresa");
  });

  it("usa o nome dado quando a pastilha ainda não é conhecida", () => {
    const ref = createRef();

    render(
      <TokenTextEditor
        ref={ref}
        value="Vê "
        tokenLabel={() => null}
        onChange={() => {}}
        ariaLabel="Mensagem"
      />,
    );

    ref.current.insertToken("link.ola", "Link: ola");

    const chip = screen
      .getByRole("textbox", { name: "Mensagem" })
      .querySelector("[data-token]");
    expect(chip).toHaveTextContent("Link: ola");
    expect(chip.getAttribute("data-token")).toBe("{{link.ola}}");
  });

  describe("formatação do WhatsApp", () => {
    function renderEditor(value = "", onChange = vi.fn()) {
      render(
        <TokenTextEditor
          value={value}
          tokenLabel={tokenLabel}
          onChange={onChange}
          ariaLabel="Mensagem"
        />,
      );

      return {
        editor: screen.getByRole("textbox", { name: "Mensagem" }),
        onChange,
      };
    }

    /* Simula o que o browser faz no DOM e devolve o texto que o editor emite. */
    function emitFrom(editor, onChange, html) {
      editor.innerHTML = html;
      fireEvent.input(editor);
      return onChange.mock.calls.at(-1)[0];
    }

    it("mostra o texto já formatado, sem os marcadores", () => {
      const { editor } = renderEditor(
        "*Olá* _tu_ ~não~ ```código``` {{nome}}",
      );

      expect(editor.querySelector("strong")).toHaveTextContent("Olá");
      expect(editor.querySelector("em")).toHaveTextContent("tu");
      expect(editor.querySelector("s")).toHaveTextContent("não");
      expect(editor.querySelector("code")).toHaveTextContent("código");
      expect(editor.querySelector("[data-token]")).toHaveTextContent("Nome");
      expect(editor.textContent).toBe("Olá tu não código Nome");
    });

    it("guarda a formatação com os marcadores do WhatsApp", () => {
      const { editor, onChange } = renderEditor();

      expect(
        emitFrom(
          editor,
          onChange,
          "<strong>Olá</strong> <em>tu</em> <b>x</b> <i>y</i> <s>z</s> <code>c</code>",
        ),
      ).toBe("*Olá* _tu_ *x* _y_ ~z~ ```c```");
    });

    it("põe fora dos marcadores os espaços das pontas", () => {
      const { editor, onChange } = renderEditor();

      expect(emitFrom(editor, onChange, "a<strong> Olá </strong>b")).toBe(
        "a *Olá* b",
      );
    });

    it("um negrito em várias linhas fica com marcadores em cada linha", () => {
      const { editor, onChange } = renderEditor();

      expect(emitFrom(editor, onChange, "<strong>a<br>b</strong>")).toBe(
        "*a*\n*b*",
      );
    });

    it("ignora formatação vazia", () => {
      const { editor, onChange } = renderEditor();

      expect(emitFrom(editor, onChange, "x<strong></strong>y")).toBe("xy");
    });

    it("mantém as pastilhas dentro da formatação", () => {
      const { editor, onChange } = renderEditor("*Olá {{nome}}*");

      expect(
        editor.querySelector("strong [data-token]"),
      ).toHaveTextContent("Nome");

      fireEvent.input(editor);
      expect(onChange).toHaveBeenLastCalledWith("*Olá {{nome}}*");
    });

    it("ler e guardar dá sempre o mesmo texto", () => {
      const value = "*_ambos_*\n- lista\n5*3*2 e nome_completo\n```a\nb```";
      const { editor, onChange } = renderEditor(value);

      fireEvent.input(editor);
      expect(onChange).toHaveBeenLastCalledWith(value);
    });

    it("ao sair, mostra formatados os marcadores escritos à mão", () => {
      const { editor, onChange } = renderEditor();

      emitFrom(editor, onChange, "Vê *isto*");
      fireEvent.blur(editor);

      expect(editor.querySelector("strong")).toHaveTextContent("isto");
    });

    it("ao sair, mostra como no WhatsApp o negrito a meio de uma palavra", () => {
      const { editor, onChange } = renderEditor();

      expect(emitFrom(editor, onChange, "<strong>ab</strong>cd")).toBe(
        "*ab*cd",
      );
      fireEvent.blur(editor);

      expect(editor.querySelector("strong")).toBeNull();
      expect(editor.textContent).toBe("*ab*cd");
    });

    it("ao sair sem diferenças, não volta a desenhar o balão", () => {
      const { editor, onChange } = renderEditor();

      emitFrom(editor, onChange, "Linha 1<div>Linha 2</div>");
      const line = editor.querySelector("div");
      fireEvent.blur(editor);

      expect(editor.querySelector("div")).toBe(line);
    });
  });

  describe("botões e atalhos de formatação", () => {
    function renderEditor(value) {
      const ref = createRef();
      const onChange = vi.fn();

      render(
        <TokenTextEditor
          ref={ref}
          value={value}
          tokenLabel={tokenLabel}
          onChange={onChange}
          ariaLabel="Mensagem"
        />,
      );

      return {
        ref,
        onChange,
        editor: screen.getByRole("textbox", { name: "Mensagem" }),
        lastText: () => onChange.mock.calls.at(-1)?.[0],
      };
    }

    /* Põe o cursor (ou a seleção) dentro de um nó de texto. */
    function select(node, start, end = start) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    it.each([
      ["bold", "Olá *mundo*"],
      ["italic", "Olá _mundo_"],
      ["strike", "Olá ~mundo~"],
      ["mono", "Olá ```mundo```"],
    ])("%s formata a palavra selecionada, mesmo só uma parte", (type, expected) => {
      const { ref, editor, lastText } = renderEditor("Olá mundo");

      /* Seleciona "un", a meio de "mundo". */
      select(editor.firstChild, 5, 7);
      ref.current.toggleFormat(type);

      expect(lastText()).toBe(expected);
    });

    it("alarga a seleção à palavra inteira e deixa os espaços de fora", () => {
      const { ref, editor, lastText } = renderEditor("Olá mundo fim");

      /* Seleciona "undo " (meia palavra e um espaço). */
      select(editor.firstChild, 5, 10);
      ref.current.toggleFormat("bold");

      expect(lastText()).toBe("Olá *mundo* fim");
    });

    it("tira a formatação quando a seleção já está dentro dela", () => {
      const { ref, editor, lastText } = renderEditor("Olá *mundo*");

      select(editor.querySelector("strong").firstChild, 1, 3);
      ref.current.toggleFormat("bold");

      expect(lastText()).toBe("Olá mundo");
      expect(editor.querySelector("strong")).toBeNull();
    });

    it("não repete o mesmo marcador dentro de si próprio", () => {
      const { ref, editor, lastText } = renderEditor("um *dois* três");

      select(editor.firstChild, 0);
      const range = document.createRange();
      range.setStart(editor.firstChild, 0);
      range.setEnd(editor.lastChild, editor.lastChild.length);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      ref.current.toggleFormat("bold");

      expect(lastText()).toBe("*um dois três*");
    });

    it("Ctrl+B e Ctrl+I formatam; Ctrl+U fica bloqueado", () => {
      const { editor, lastText } = renderEditor("Olá mundo");

      select(editor.firstChild, 5, 7);
      expect(fireEvent.keyDown(editor, { key: "b", ctrlKey: true })).toBe(
        false,
      );
      expect(lastText()).toBe("Olá *mundo*");

      select(editor.firstChild, 0, 2);
      fireEvent.keyDown(editor, { key: "i", ctrlKey: true });
      expect(lastText()).toBe("_Olá_ *mundo*");

      expect(fireEvent.keyDown(editor, { key: "u", ctrlKey: true })).toBe(
        false,
      );
      expect(editor.querySelector("u")).toBeNull();
    });

    describe("como interruptor, com o cursor sem seleção", () => {
      it("liga o negrito para o que se escreve a seguir", () => {
        const { ref, editor, lastText } = renderEditor("Olá ");

        select(editor.firstChild, 4);
        ref.current.toggleFormat("bold");
        ref.current.insertText("mundo");

        expect(lastText()).toBe("Olá *mundo*");
      });

      it("depois de um espaço, desliga o negrito e a palavra seguinte sai normal", () => {
        const { ref, editor, lastText } = renderEditor("");

        editor.appendChild(document.createTextNode(""));
        select(editor.firstChild, 0);
        ref.current.toggleFormat("bold");
        ref.current.insertText("palavra ");
        ref.current.toggleFormat("bold");
        ref.current.insertText("outra");

        expect(lastText()).toBe("*palavra* outra");
      });

      it("a meio de uma palavra a negrito, divide-a e escreve normal no meio", () => {
        const { ref, editor, lastText } = renderEditor("*abcd*");

        select(editor.querySelector("strong").firstChild, 2);
        ref.current.toggleFormat("bold");
        ref.current.insertText("X");

        expect(editor.querySelectorAll("strong")).toHaveLength(2);
        expect(lastText()).toBe("*ab*X*cd*");
      });

      it("o marcador invisível nunca vai para o texto guardado", () => {
        const { ref, editor, lastText } = renderEditor("Olá ");

        select(editor.firstChild, 4);
        ref.current.toggleFormat("italic");

        expect(lastText()).toBe("Olá ");
        expect(lastText()).not.toContain("​");
      });
    });

    describe("formatação em uso no cursor (botões ligados)", () => {
      it("diz que formatação há onde está o cursor", () => {
        const { ref, editor } = renderEditor("*Olá* _tu_ *_ambos_*");

        select(editor.querySelector("strong").firstChild, 1);
        expect(ref.current.getActiveFormats()).toMatchObject({
          bold: true,
          italic: false,
        });

        select(editor.querySelector("em").firstChild, 1);
        expect(ref.current.getActiveFormats()).toMatchObject({
          bold: false,
          italic: true,
        });

        select(editor.querySelector("strong em").firstChild, 1);
        expect(ref.current.getActiveFormats()).toMatchObject({
          bold: true,
          italic: true,
        });
      });

      it("liga o negrito logo depois de carregar no botão, antes de escrever", () => {
        const { ref, editor } = renderEditor("Olá ");

        select(editor.firstChild, 4);
        ref.current.toggleFormat("bold");

        expect(ref.current.getActiveFormats().bold).toBe(true);
      });

      it("diz se a linha do cursor é lista ou citação", () => {
        const { ref, editor } = renderEditor("- um\n1. dois\n> três\nnada");

        const lineStarts = [2, 7, 14, 21];
        const results = lineStarts.map((offset) => {
          select(editor.firstChild, offset);
          const active = ref.current.getActiveFormats();
          return [active.bullet, active.numbered, active.quote];
        });

        expect(results).toEqual([
          [true, false, false],
          [false, true, false],
          [false, false, true],
          [false, false, false],
        ]);
      });

      it("sem cursor no balão, nada está ligado", () => {
        const { ref } = renderEditor("*Olá*");

        window.getSelection().removeAllRanges();

        expect(Object.values(ref.current.getActiveFormats())).not.toContain(
          true,
        );
      });
    });

    it("põe e tira a lista com pontos na linha do cursor", () => {
      const { ref, editor, lastText } = renderEditor("a\nb\nc");

      select(editor.firstChild, 2);
      ref.current.toggleLinePrefix("bullet");
      expect(lastText()).toBe("a\n- b\nc");

      select(editor.firstChild, 4);
      ref.current.toggleLinePrefix("bullet");
      expect(lastText()).toBe("a\nb\nc");
    });

    it("numera as linhas selecionadas", () => {
      const { ref, editor, lastText } = renderEditor("a\nb\nc");

      select(editor.firstChild, 0, 3);
      ref.current.toggleLinePrefix("numbered");

      expect(lastText()).toBe("1. a\n2. b\nc");
    });

    it("troca a lista numerada por pontos sem ficar com os dois", () => {
      const { ref, editor, lastText } = renderEditor("1. a");

      select(editor.firstChild, 3);
      ref.current.toggleLinePrefix("bullet");

      expect(lastText()).toBe("- a");
    });

    it("põe a citação no início da linha", () => {
      const { ref, editor, lastText } = renderEditor("Olá");

      select(editor.firstChild, 1);
      ref.current.toggleLinePrefix("quote");

      expect(lastText()).toBe("> Olá");
    });

    it("põe a lista de tarefas e liga-a na barra", () => {
      const { ref, editor, lastText } = renderEditor("Comprar pão");

      select(editor.firstChild, 3);
      ref.current.toggleLinePrefix("task");

      expect(lastText()).toBe("☐ Comprar pão");
      expect(ref.current.getActiveFormats().task).toBe(true);
    });

    describe("Enter e Backspace nas listas, como no Teams", () => {
      const enter = (editor, options = {}) =>
        fireEvent.keyDown(editor, { key: "Enter", ...options });

      it("Enter no fim de um item começa outro, com o cursor depois do prefixo", () => {
        const { ref, editor, lastText } = renderEditor("- um");

        select(editor.firstChild, 4);
        expect(enter(editor)).toBe(false);
        ref.current.insertText("dois");

        expect(lastText()).toBe("- um\n- dois");
      });

      it("numa lista numerada, o item novo leva o número seguinte e empurra os outros", () => {
        const { ref, editor, lastText } = renderEditor("1. um\n2. dois");

        select(editor.firstChild, 5);
        enter(editor);
        ref.current.insertText("meio");

        expect(lastText()).toBe("1. um\n2. meio\n3. dois");
      });

      it("Enter num item vazio sai da lista e o cursor fica na linha nova", () => {
        const { ref, editor, lastText } = renderEditor("- um\n- ");

        select(editor.firstChild, 7);
        enter(editor);
        expect(lastText()).toBe("- um\n");

        ref.current.insertText("fim");
        expect(lastText()).toBe("- um\nfim");
      });

      it("a meio de um negrito, os dois itens ficam em negrito", () => {
        const { editor, lastText } = renderEditor("- *olá*");

        select(editor.querySelector("strong").firstChild, 1);
        enter(editor);

        expect(lastText()).toBe("- *o*\n- *lá*");
      });

      it("fora de uma lista, e com Shift+Enter, o Enter é o normal", () => {
        const { editor, onChange } = renderEditor("Olá\n- um");

        select(editor.firstChild, 3);
        expect(enter(editor)).toBe(true);

        select(editor.firstChild, 8);
        expect(enter(editor, { shiftKey: true })).toBe(true);

        expect(onChange).not.toHaveBeenCalled();
      });

      it("Backspace logo a seguir ao prefixo tira a linha da lista", () => {
        const { editor, lastText } = renderEditor("- um");

        select(editor.firstChild, 2);

        expect(fireEvent.keyDown(editor, { key: "Backspace" })).toBe(false);
        expect(lastText()).toBe("um");
      });

      it("Backspace noutro sítio apaga como sempre", () => {
        const { editor, onChange } = renderEditor("- um");

        select(editor.firstChild, 3);

        expect(fireEvent.keyDown(editor, { key: "Backspace" })).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
      });
    });
  });

  describe("inserir texto (emojis)", () => {
    function renderEditor(value) {
      const ref = createRef();
      const onChange = vi.fn();

      render(
        <TokenTextEditor
          ref={ref}
          value={value}
          tokenLabel={tokenLabel}
          onChange={onChange}
          ariaLabel="Mensagem"
        />,
      );

      return {
        ref,
        editor: screen.getByRole("textbox", { name: "Mensagem" }),
        lastText: () => onChange.mock.calls.at(-1)?.[0],
      };
    }

    function select(node, offset) {
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }

    it("põe o emoji onde está o cursor", () => {
      const { ref, editor, lastText } = renderEditor("Olá mundo");

      select(editor.firstChild, 4);
      ref.current.insertText("😀");

      expect(lastText()).toBe("Olá 😀mundo");
    });

    it("lembra-se do cursor depois de sair do balão (pesquisa do seletor)", () => {
      const { ref, editor, lastText } = renderEditor("Olá mundo");

      select(editor.firstChild, 3);
      fireEvent.blur(editor);
      window.getSelection().removeAllRanges();

      ref.current.insertText("👋");

      expect(lastText()).toBe("Olá👋 mundo");
    });

    it("sem cursor no balão, põe o emoji no fim", () => {
      const { ref, lastText } = renderEditor("Olá");

      window.getSelection().removeAllRanges();
      ref.current.insertText("🎉");

      expect(lastText()).toBe("Olá🎉");
    });
  });

  it("re-renders chips when the value changes from outside", () => {
    const { rerender } = render(
      <TokenTextEditor
        value="A"
        tokenLabel={tokenLabel}
        onChange={() => {}}
        ariaLabel="Mensagem"
      />,
    );

    rerender(
      <TokenTextEditor
        value="B {{nome}}"
        tokenLabel={tokenLabel}
        onChange={() => {}}
        ariaLabel="Mensagem"
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    expect(editor.textContent).toBe("B Nome");
  });
});
