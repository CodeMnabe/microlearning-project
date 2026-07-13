import styles from "../admin.module.css";

/**
 * Formulário de criação de organização.
 *
 * Recebe estado e handlers da page/hook e limita-se a renderizar a UI.
 */
export default function CreateOrganizationForm({
  translation,
  name,
  setName,
  creating,
  onSubmit,
}) {
  return (
    <section className={styles.formContainer}>
      <h2 className={styles.title}>{translation("newOrganization.title")}</h2>

      <form onSubmit={onSubmit} className={styles.form}>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            event.target.setCustomValidity("");
          }}
          onInvalid={(event) => {
            event.target.setCustomValidity(
              translation("newOrganization.required"),
            );
          }}
          placeholder={translation("newOrganization.placeholder")}
          required
          className={styles.input}
        />

        <button disabled={creating} className={styles.formButton}>
          {creating
            ? translation("newOrganization.creating")
            : translation("newOrganization.create")}
        </button>
      </form>
    </section>
  );
}