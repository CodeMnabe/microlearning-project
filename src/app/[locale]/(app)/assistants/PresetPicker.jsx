"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "./assistants.module.css";
import { ASSISTANT_PRESETS } from "./assistantPresets";

/**
 * O botão de informação de uma predefinição.
 *
 * A explicação vive aqui dentro e não debaixo do nome: as três opções
 * ficam lado a lado e ocupam três linhas de texto em vez de nove, o que
 * devolve o espaço às instruções — que é onde se decide o que o
 * assistente faz.
 *
 * Não guarda se está aberto: quem guarda é o grupo, para que abrir uma
 * bolha feche a anterior. O atributo `data-preset-info` marca a zona
 * onde um clique não conta como "clicou fora".
 */
function PresetInfo({ text, label, isOpen, onToggle }) {
  if (!text) return null;

  return (
    <span className={styles.presetInfoWrapper} data-preset-info>
      <button
        type="button"
        className={`${styles.presetInfoButton} ${
          isOpen ? styles.presetInfoButtonOpen : ""
        }`}
        onClick={onToggle}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <Info size={13} />
      </button>

      {isOpen && <span className={styles.presetInfoPopover}>{text}</span>}
    </span>
  );
}

/**
 * As três predefinições de comportamento, lado a lado.
 *
 * O mesmo componente serve a criação e a edição para que os dois ecrãs
 * não possam divergir. `value` é o id da predefinição ativa, ou `null`
 * num assistente afinado à mão — aí nenhuma aparece escolhida.
 *
 * @param {string} name  nome do grupo de rádios, único por ecrã.
 */
export default function PresetPicker({ value, onChange, name }) {
  const translation = useTranslations();

  /** Qual das bolhas está aberta. Só uma de cada vez. */
  const [openInfo, setOpenInfo] = useState(null);

  useEffect(() => {
    if (!openInfo) return undefined;

    /*
     * Fechar ao clicar fora.
     *
     * Um clique noutro botão de informação é deixado passar: o `onClick`
     * desse botão já troca a bolha, e fechá-la aqui primeiro faria a
     * nova abrir e fechar no mesmo gesto.
     *
     * `pointerdown` e não `click` para a bolha desaparecer assim que o
     * dedo toca, sem esperar que levante.
     */
    function handlePointerDown(event) {
      if (event.target.closest?.("[data-preset-info]")) return;
      setOpenInfo(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openInfo]);

  /*
   * O Escape fecha a bolha e fica por aí.
   *
   * Sem o `stopPropagation`, a mesma tecla chegava ao modal de criação,
   * que também ouve o Escape, e fechava o formulário inteiro por a
   * pessoa querer só dispensar uma ajuda.
   */
  function handleKeyDown(event) {
    if (event.key !== "Escape" || !openInfo) return;
    event.stopPropagation();
    setOpenInfo(null);
  }

  return (
    <div
      className={styles.presetGroup}
      role="radiogroup"
      onKeyDown={handleKeyDown}
    >
      {ASSISTANT_PRESETS.map((option) => {
        const optionName = translation(`AssistantPresets.${option.id}.name`);
        const isActive = value === option.id;

        return (
          <div key={option.id} className={styles.presetCell}>
            <label
              className={`${styles.presetOption} ${
                isActive ? styles.presetOptionActive : ""
              }`}
            >
              {/*
                O rádio continua a ser um rádio: fica escondido aos
                olhos, mas presente para o teclado e para os leitores de
                ecrã. O ponto ao lado é só desenho.
              */}
              <input
                type="radio"
                className={styles.presetInput}
                name={name}
                value={option.id}
                checked={isActive}
                onChange={() => {
                  onChange(option.id);
                  setOpenInfo(null);
                }}
              />
              <span className={styles.presetDot} aria-hidden="true" />
              <span className={styles.presetName}>{optionName}</span>
            </label>

            <PresetInfo
              label={optionName}
              text={translation(`AssistantPresets.${option.id}.description`)}
              isOpen={openInfo === option.id}
              onToggle={() =>
                setOpenInfo((current) =>
                  current === option.id ? null : option.id,
                )
              }
            />
          </div>
        );
      })}
    </div>
  );
}
