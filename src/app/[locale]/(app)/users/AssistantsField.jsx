"use client";
import CheckList from "./CheckList/CheckList";
import { useTranslations } from "next-intl";

// Assistentes atribuídos a um utilizador e, havendo mais de um, qual está ativo.
export default function AssistantsField({
  assistants = [],
  assistantIds = [],
  initialAssistantIds = [],
  activeAssistantId = null,
  onChange,
}) {
  const translation = useTranslations("UserAssistants");

  function toggle(id) {
    const nextIds = assistantIds.includes(id)
      ? assistantIds.filter((x) => x !== id)
      : [...assistantIds, id];

    const nextActive = nextIds.includes(activeAssistantId)
      ? activeAssistantId
      : (nextIds[0] ?? null);

    onChange({ assistantIds: nextIds, activeAssistantId: nextActive });
  }

  const hasSeveral = assistantIds.length > 1;

  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <CheckList
        label={translation("assigned")}
        items={assistants}
        selectedIds={assistantIds}
        initialSelectedIds={initialAssistantIds}
        onToggle={toggle}
        activeId={hasSeveral ? activeAssistantId : null}
        onMakeActive={
          hasSeveral
            ? (id) => onChange({ assistantIds, activeAssistantId: id })
            : undefined
        }
        emptyText={translation("none")}
      />

      {hasSeveral && (
        <small style={{ color: "var(--ui-muted)" }}>
          {translation("activeHint")}
        </small>
      )}
    </div>
  );
}
