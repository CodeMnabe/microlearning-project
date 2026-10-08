import { throwHttpError } from "@/lib/auth/guards";

/* Ids de grupo vindos do composer, sem repetidos (#166). */
export function parseGroupIds(raw) {
  return [
    ...new Set(
      (Array.isArray(raw) ? raw : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

/*
 * Os grupos só recebem mensagens em branco: os links rastreados e as
 * perguntas são por pessoa e num grupo não têm um destinatário único.
 */
export function assertGroupBroadcastContent(payload = {}) {
  if (Array.isArray(payload?.trackedLinks) && payload.trackedLinks.length) {
    throwHttpError("Tracked links are not available for groups", 400);
  }

  if (payload?.question) {
    throwHttpError("Questions are not available for groups", 400);
  }
}
