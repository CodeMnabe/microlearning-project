/**
 * Predefinições de comportamento de um assistente.
 *
 * Na criação não mostramos `temperature` nem `top_p`: quem cria um
 * assistente pela primeira vez não sabe o que são, e obrigá-lo a
 * escolher é empurrar-lhe uma decisão que não consegue tomar. Escolhe
 * um dos três feitios; os números ficam aqui.
 *
 * Só a `temperature` varia. A OpenAI recomenda alterar a `temperature`
 * OU o `top_p`, nunca os dois: controlam aleatoriedade por mecanismos
 * diferentes — a `temperature` achata ou afia a distribuição de
 * probabilidades, o `top_p` corta-lhe a cauda — e mexer nos dois na
 * mesma direção multiplica o efeito de forma imprevisível.
 *
 * Os valores estão dentro da gama em que a qualidade se mantém. Acima
 * de 1.3 o texto começa a divagar; abaixo de 0.2 torna-se repetitivo.
 *
 * Nota: a `temperature` aceita 0 a 2 e o `top_p` aceita 0 a 1. Não são
 * a mesma escala, e é por isso que isto não se define em percentagem.
 */

// O `top_p` fica no valor por omissão em todas as predefinições.
export const ASSISTANT_PRESET_TOP_P = 1;

/*
 * A ordem desta lista e a ordem no ecra.
 *
 * O Normal vem primeiro por ser a escolha de omissao e a que serve a
 * maioria dos casos: quem nao quer decidir encontra logo a certa.
 *
 * Os numeros continuam a crescer do Formal para o Criativo, mas a lista
 * deixou de o mostrar pela ordem — por isso ha um teste a garanti-lo.
 */
export const ASSISTANT_PRESETS = [
  { id: "normal", temperature: 0.7, top_p: ASSISTANT_PRESET_TOP_P },
  { id: "formal", temperature: 0.2, top_p: ASSISTANT_PRESET_TOP_P },
  { id: "creative", temperature: 1.1, top_p: ASSISTANT_PRESET_TOP_P },
];

/** A predefinição usada quando nenhuma foi escolhida. */
export const DEFAULT_ASSISTANT_PRESET = "normal";

/**
 * Devolve a predefinição com este id, ou a de omissão.
 *
 * Nunca devolve `undefined`: um id desconhecido — vindo de um estado
 * antigo ou de um erro de escrita — daria um assistente sem
 * `temperature`, e isso é pior do que um assistente equilibrado.
 */
export function getAssistantPreset(id) {
  return (
    ASSISTANT_PRESETS.find((preset) => preset.id === id) ??
    ASSISTANT_PRESETS.find((preset) => preset.id === DEFAULT_ASSISTANT_PRESET)
  );
}

/**
 * Descobre a que predefinição corresponde um assistente.
 *
 * Compara os dois parâmetros, não só a `temperature`: um assistente com
 * `temperature` 0.7 mas `top_p` 0.35 não se comporta como o Normal, e
 * chamar-lhe Normal seria mentir sobre o que ele faz.
 *
 * Um `top_p` por preencher conta como 1: é o valor que a OpenAI usa
 * quando não lhe mandamos nada, por isso é o que o assistente tem na
 * prática.
 *
 * Devolve `null` para valores afinados à mão — o caso de qualquer
 * assistente criado antes desta mudança.
 */
export function findPreset({ temperature, top_p } = {}) {
  if (temperature === null || temperature === undefined) return null;

  const wanted = Number(temperature);
  const wantedTopP = Number(top_p ?? ASSISTANT_PRESET_TOP_P);

  if (Number.isNaN(wanted) || Number.isNaN(wantedTopP)) return null;

  return (
    ASSISTANT_PRESETS.find(
      (preset) =>
        Math.abs(preset.temperature - wanted) < 0.001 &&
        Math.abs(preset.top_p - wantedTopP) < 0.001,
    ) ?? null
  );
}
