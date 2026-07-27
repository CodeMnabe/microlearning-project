/**
 * Regras de construção dos campos telefónicos de um utilizador.
 *
 * Existem duas funções, e não uma, porque a criação e a atualização têm
 * semânticas diferentes:
 *
 * - na criação, um campo ausente resulta num valor vazio ou nulo;
 * - na atualização, um campo ausente é `undefined` e significa
 *   "não alterar", enquanto uma string vazia significa "limpar".
 *
 * Juntá-las numa só função alteraria o comportamento de uma delas.
 */

/**
 * Remove tudo o que não seja dígito.
 */
function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

/**
 * Campos telefónicos para a criação de um utilizador.
 *
 * O número completo recebido tem prioridade. Só quando não existe é que
 * é construído a partir do indicativo e do número nacional.
 */
export function buildCreatePhoneFields({
  phoneNumber,
  phoneCountryCode,
  phoneNational,
}) {
  const normalizedNational =
    typeof phoneNational === "string" ? phoneNational.replace(/\s+/g, "") : "";

  const normalizedCode =
    typeof phoneCountryCode === "string" && phoneCountryCode.trim()
      ? phoneCountryCode.trim()
      : null;

  const fullPhone =
    phoneNumber ??
    (normalizedCode && normalizedNational
      ? `${normalizedCode}${digitsOnly(normalizedNational)}`
      : null);

  return {
    phoneNumber: fullPhone,
    phoneCountryCode: normalizedCode,
    phoneNational: normalizedNational,
  };
}

/**
 * Campos telefónicos para a atualização de um utilizador.
 *
 * `undefined` significa que o campo não deve ser alterado.
 * Uma string vazia no indicativo significa que deve ser limpo.
 */
export function buildUpdatePhoneFields({
  phoneNumber,
  phoneCountryCode,
  phoneNational,
}) {
  const normalizedNational =
    typeof phoneNational === "string"
      ? phoneNational.replace(/\s+/g, "")
      : undefined;

  const normalizedCode =
    typeof phoneCountryCode === "string" && phoneCountryCode.trim()
      ? phoneCountryCode.trim()
      : typeof phoneCountryCode === "string"
        ? ""
        : undefined;

  const fullPhone =
    typeof phoneNumber === "string" && phoneNumber.trim()
      ? phoneNumber.trim()
      : normalizedCode && normalizedNational
        ? `${normalizedCode}${digitsOnly(normalizedNational)}`
        : undefined;

  return {
    phoneNumber: fullPhone,
    phoneCountryCode: normalizedCode,
    phoneNational: normalizedNational,
  };
}
