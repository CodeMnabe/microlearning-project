/**
 * Consultas pequenas para dar nomes legíveis aos detalhes do histórico.
 *
 * Nunca lançam: um nome em falta não pode impedir o registo.
 */
export async function lookupAssistantName(admin, assistantId) {
  if (!admin || assistantId == null || assistantId === "") return null;

  try {
    const { data, error } = await admin
      .from("assistant")
      .select("name")
      .eq("id", assistantId)
      .maybeSingle();

    if (error) throw error;

    return data?.name ?? null;
  } catch (error) {
    console.warn("[Audit] assistant lookup failed", {
      assistantId,
      message: error?.message || String(error),
    });

    return null;
  }
}
