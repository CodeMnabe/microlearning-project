"use client";

import styles from "../analytics.module.css";

import DescriptionInfo from "./DescriptionInfo";

/**
 * Secção da dashboard que pode ser recolhida.
 *
 * Apresenta o título, a nota explicativa e o botão que mostra ou esconde
 * o conteúdo. O conteúdo só é renderizado quando a secção está visível.
 *
 * O atributo `data-pdf-section` é necessário para a exportação em PDF,
 * que procura estes marcadores para dividir o relatório em páginas.
 */
export default function CollapsibleSection({
  title,
  description,
  isVisible,
  onToggle,
  showLabel,
  hideLabel,
  children,
}) {
  return (
    <section
      data-pdf-section
      className={`${styles.section} ${
        !isVisible ? styles.sectionCollapsed : ""
      }`}
    >
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.titleWithInfo}>
            <h2 className={styles.sectionTitle}>{title}</h2>

            <DescriptionInfo text={description} />
          </div>
        </div>

        <button
          type="button"
          className={styles.metricGroupToggle}
          onClick={onToggle}
        >
          {isVisible ? hideLabel : showLabel}
        </button>
      </div>

      {isVisible && children}
    </section>
  );
}
