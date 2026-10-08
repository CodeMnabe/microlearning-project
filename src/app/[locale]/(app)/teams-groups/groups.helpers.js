/* Ajudas partilhadas pelas páginas de grupos do Teams (#165). */

export function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* O Teams chama "channel" a um canal de equipa; o resto é chat de grupo. */
export function groupTypeKey(conversationType) {
  return conversationType === "channel" ? "channel" : "groupChat";
}
