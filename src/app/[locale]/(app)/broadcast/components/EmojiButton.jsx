"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Smile } from "lucide-react";

import styles from "../broadcast.module.css";

/*
 * O seletor (emoji-picker-react) só é descarregado quando se abre pela
 * primeira vez. Com a aplicação em português, usa as palavras de pesquisa
 * em português; a biblioteca só tem as do Brasil (não há pt-PT). Em inglês,
 * usa as que já vêm com ela.
 *
 * Os dados em português importam-se pelo .json: sem extensão, o Turbopack
 * escolhe o emojis-pt.ts do pacote e não o consegue compilar.
 */
const PickerEn = lazy(() => import("emoji-picker-react"));

const PickerPt = lazy(() =>
  Promise.all([
    import("emoji-picker-react"),
    import("emoji-picker-react/dist/data/emojis-pt.json"),
  ]).then(([picker, data]) => {
    const Picker = picker.default;

    function PickerWithPortuguese(props) {
      return <Picker emojiData={data.default} {...props} />;
    }

    return { default: PickerWithPortuguese };
  }),
);

/*
 * Categorias pela ordem do seletor, com os nossos nomes (pt-PT e en). Sem
 * bandeiras: a fonte de emojis do Windows desenha-as como duas letras ("PT",
 * "FR"), e quem escreve não percebe o que escolhe. A pesquisa só procura nas
 * categorias desta lista, por isso também não as encontra.
 */
const CATEGORIES = [
  "suggested",
  "smileys_people",
  "animals_nature",
  "food_drink",
  "travel_places",
  "activities",
  "objects",
  "symbols",
];

/* Não tira o cursor do balão ao carregar no botão. */
const keepSelection = (e) => e.preventDefault();

/**
 * Botão de emojis na barra do telemóvel. O emoji escolhido entra no balão
 * onde estava o cursor (editorRef.current.insertText).
 */
export default function EmojiButton({ editorRef, translation }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function onDocumentMouseDown(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const Picker = String(locale).startsWith("pt") ? PickerPt : PickerEn;

  return (
    <div className={styles.emojiWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.formatBtn}
        aria-label={translation("Broadcast.emoji.open")}
        title={translation("Broadcast.emoji.open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={() => setOpen((value) => !value)}
      >
        <Smile size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.emojiPopover}>
          <Suspense
            fallback={
              <div className={styles.emojiLoading}>
                {translation("Broadcast.emoji.loading")}
              </div>
            }
          >
            <Picker
              emojiStyle="native"
              searchPlaceholder={translation("Broadcast.emoji.search")}
              searchClearButtonLabel={translation("Broadcast.emoji.clear")}
              categories={CATEGORIES.map((category) => ({
                category,
                name: translation(`Broadcast.emoji.categories.${category}`),
              }))}
              previewConfig={{ showPreview: false }}
              width={320}
              height={380}
              onEmojiClick={(data) => {
                editorRef?.current?.insertText?.(data.emoji);
                setOpen(false);
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
