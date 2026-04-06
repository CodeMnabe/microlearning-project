import styles from "../public.module.css";

export default function PublicDocument({
  title,
  subtitle,
  lastUpdated,
  sections,
}) {
  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subhead}>
            <span className={styles.subheadStrong}>{subtitle} </span>
            {lastUpdated}
          </p>
        </header>

        <div className={styles.document}>
          {sections.map((section, sectionIndex) => (
            <article className={styles.section} key={`section-${sectionIndex}`}>
              {section.title && (
                <h2 className={styles.subtitle}>{section.title}</h2>
              )}
              {section.paragraphs?.map((paragraph, paragraphIndex) => (
                <div key={`paragraph-${sectionIndex}-${paragraphIndex}`}>
                  {paragraph.text && (
                    <p className={styles.paragraph}>{paragraph.text}</p>
                  )}

                  {!!paragraph.list?.length && (
                    <div>
                      {paragraph.list.title ?? (
                        <p className={styles.listTitle}></p>
                      )}
                      <ul className={styles.list}>
                        {paragraph.list.map((item, listIndex) => (
                          <li
                            className={styles.listItem}
                            key={`listItem-${sectionIndex}-${paragraphIndex}-${listIndex}`}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {paragraph.table && (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            {paragraph.table.headers.map(
                              (header, headerIndex) => (
                                <th
                                  key={`tableHead-${sectionIndex}-${paragraphIndex}-${headerIndex}`}
                                >
                                  {header}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {paragraph.table.rows.map((row, rowIndex) => (
                            <tr
                              key={`tableRow-${sectionIndex}-${paragraphIndex}-${rowIndex}`}
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`tableCell-${sectionIndex}-${paragraphIndex}-${rowIndex}-${cellIndex}`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
