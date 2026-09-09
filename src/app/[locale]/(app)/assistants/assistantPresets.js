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

export const ASSISTANT_PRESETS = [
  { id: "formal", temperature: 0.2, top_p: ASSISTANT_PRESET_TOP_P },
  { id: "normal", temperature: 0.7, top_p: ASSISTANT_PRESET_TOP_P },
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
 * Descobre a que predefinição corresponde uma temperatura.
 *
 * Serve para o ecrã de edição poder assinalar qual está ativa quando o
 * assistente foi criado por aqui. Devolve `null` para valores afinados
 * à mão — o caso de qualquer assistente anterior a esta mudança.
 */
export function findPresetByTemperature(temperature) {
  if (temperature === null || temperature === undefined) return null;

  const value = Number(temperature);

  return (
    ASSISTANT_PRESETS.find(
      (preset) => Math.abs(preset.temperature - value) < 0.001,
    ) ?? null
  );
}
