import {
  OPENING_BODY_MAX_LENGTH,
  sanitizeOpeningBody,
} from "@/lib/whatsapp/openingTemplate";

/**
 * Lê as opções da mensagem de abertura vindas do cliente.
 *
 * - `openingOnly`: enviar só o template de abertura.
 * - `openingBody`: corpo do template só para este envio (opcional).
 *
 * Devolve `{ error }` quando o corpo não é válido.
 */
export function parseOpeningOptions(body = {}) {
  const openingOnly = body?.openingOnly === true;

  if (body?.openingBody == null || body.openingBody === "") {
    return { openingOnly, openingBody: null };
  }

  if (typeof body.openingBody !== "string") {
    return { error: "openingBody must be a string" };
  }

  const clean = sanitizeOpeningBody(body.openingBody);

  if (!clean) {
    return { error: "The opening message body cannot be empty" };
  }

  if (clean.length > OPENING_BODY_MAX_LENGTH) {
    return {
      error: `The opening message body must have at most ${OPENING_BODY_MAX_LENGTH} characters`,
    };
  }

  return { openingOnly, openingBody: clean };
}
