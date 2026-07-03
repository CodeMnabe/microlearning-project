import styles from "../analytics.module.css";

/**
 * Resumo operacional da dashboard.
 *
 * Junta indicadores importantes da operação, como utilizadores,
 * mensagens, automações, broadcasts e templates que exigem atenção.
 */

export default function OperationalSummary({
  translation,
  users,
  messages,
  automations,
  scheduledBroadcasts,
  templates,
  format,
  hasOperationalAttentionWarning,
  operationalAttentionTotal,
}) {
  return (
    <section className={`${styles.section} ${styles.operationalSummary}`}>
      <h2 className={styles.sectionTitle}>
        {translation("sections.breakdownTitle")}
      </h2>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>
            {translation("sections.users.title")}
          </span>

          <strong className={styles.summaryValue}>
            {translation("sections.users.value", {
              total: format(users.total),
              withAssistant: format(users.withAssistant),
            })}
          </strong>

          <p>
            {translation("sections.users.text", {
              email: format(users.withEmail),
              phone: format(users.withPhone),
              teams: format(users.withTeams),
              whatsapp: format(users.withWhatsapp),
            })}
          </p>
        </div>

        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>
            {translation("sections.messages.title")}
          </span>

          <strong className={styles.summaryValue}>
            {translation("sections.messages.value", {
              total: format(messages.total),
            })}
          </strong>

          <p>
            {translation("sections.messages.text", {
              userMessages: format(messages.userMessages),
              assistantMessages: format(messages.assistantMessages),
              read: format(messages.read),
              failed: format(messages.failed),
            })}
          </p>
        </div>

        <div
          className={`${styles.summaryItem} ${
            hasOperationalAttentionWarning ? styles.summaryWarning : ""
          }`}
        >
          <span className={styles.summaryLabel}>
            {translation("sections.attention.title")}
          </span>

          <strong className={styles.summaryValue}>
            {translation("sections.attention.value", {
              total: format(operationalAttentionTotal),
            })}
          </strong>

          <p>
            {translation("sections.attention.text", {
              automationFailures: format(automations.runsFailed),
              scheduledFailures: format(scheduledBroadcasts.failed),
              rejectedTemplates: format(templates.rejected),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}