export function buildDPA(translation) {
  return {
    title: translation("Title"),
    subtitle: translation("LastUpdated"),
    sections: [
      {
        title: translation("Subtitle.1"),
        paragraphs: [
          { text: translation("Paragraphs.1-1") },
          {
            text: translation.rich("Paragraphs.1-2", {
              company: (chunks) => <strong>{chunks}</strong>,
            }),
          },
        ],
      },
      {
        title: translation("Subtitle.2"),
        paragraphs: [
          { text: translation("Paragraphs.2-1") },
          { text: translation("Paragraphs.2-2") },
        ],
      },
      {
        title: translation("Subtitle.3"),
        paragraphs: [
          {
            text: translation.rich("Paragraphs.3-1", {
              title: (chunks) => <strong>{chunks}</strong>,
            }),
          },
          {
            text: translation.rich("Paragraphs.3-2", {
              title: (chunks) => <strong>{chunks}</strong>,
            }),
          },
          {
            text: translation.rich("Paragraphs.3-3", {
              title: (chunks) => <strong>{chunks}</strong>,
            }),
          },
        ],
      },
      {
        title: translation("Subtitle.4"),
        paragraphs: [
          { text: translation("Paragraphs.4-1") },
          {
            list: [
              translation("Lists.4-1.1"),
              translation("Lists.4-1.2"),
              translation("Lists.4-1.3"),
              translation("Lists.4-1.4"),
              translation("Lists.4-1.5"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.5"),
        paragraphs: [
          {
            list: [
              translation("Lists.5-1.1"),
              translation("Lists.5-1.2"),
              translation("Lists.5-1.3"),
              translation("Lists.5-1.4"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.6"),
        paragraphs: [
          {
            text: translation("Paragraphs.6-1"),
            list: [
              translation("Lists.6-1.1"),
              translation("Lists.6-1.2"),
              translation("Lists.6-1.3"),
              translation("Lists.6-1.4"),
              translation("Lists.6-1.5"),
              translation("Lists.6-1.6"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.7"),
        paragraphs: [
          {
            text: translation("Paragraphs.7-1"),
            list: [
              translation("Lists.7-1.1"),
              translation("Lists.7-1.2"),
              translation("Lists.7-1.3"),
              translation("Lists.7-1.4"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.8"),
        paragraphs: [
          { text: translation("Paragraphs.8-1") },
          {
            text: translation("Paragraphs.8-2"),
            list: [
              translation("Lists.8-2.1"),
              translation("Lists.8-2.2"),
              translation("Lists.8-2.3"),
              translation("Lists.8-2.4"),
              translation("Lists.8-2.5"),
              translation("Lists.8-2.6"),
            ],
          },
          { text: translation("Paragraphs.8-3") },
        ],
      },
      {
        title: translation("Subtitle.9"),
        paragraphs: [
          { text: translation("Paragraphs.9-1") },
          { text: translation("Paragraphs.9-2") },
        ],
      },
      {
        title: translation("Subtitle.10"),
        paragraphs: [
          {
            text: translation("Paragraphs.10-1"),
            list: [
              translation("Lists.10-1.1"),
              translation("Lists.10-1.2"),
              translation("Lists.10-1.3"),
              translation("Lists.10-1.4"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.11"),
        paragraphs: [{ text: translation("Paragraphs.11-1") }],
      },
      {
        title: translation("Subtitle.12"),
        paragraphs: [{ text: translation("Paragraphs.12-1") }],
      },
      {
        title: translation("Subtitle.13"),
        paragraphs: [{ text: translation("Paragraphs.13-1") }],
      },
      {
        title: translation("Subtitle.14"),
        paragraphs: [{ text: translation("Paragraphs.14-1") }],
      },
      {
        title: translation("Subtitle.15"),
        paragraphs: [{ text: translation("Paragraphs.15-1") }],
      },
      {
        title: translation("Subtitle.16"),
        paragraphs: [{ text: translation("Paragraphs.16-1") }],
      },
      {
        title: translation("Subtitle.17"),
        paragraphs: [
          {
            text: translation.rich("Paragraphs.17-1", {
              company: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
              email: (chunks) => <a href="mailto:geral@digik.pt">{chunks}</a>,
              website: (chunks) => (
                <a
                  href="https://www.digik.pt"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {chunks}
                </a>
              ),
            }),
          },
        ],
      },
      // {
      //   title: translation("Subtitle.13"),
      //   paragraphs: [
      //     { text: translation("Paragraphs.13-1") },
      //     {
      //       text: translation.rich("Paragraphs.13-2", {
      //         company: (chunks) => <strong>{chunks}</strong>,
      //         br: () => <br />,
      //         email: (chunks) => <a href="mailto:geral@digik.pt">{chunks}</a>,
      //         website: (chunks) => (
      //           <a
      //             href="https://www.digik.pt"
      //             target="_blank"
      //             rel="noopener noreferrer"
      //           >
      //             {chunks}
      //           </a>
      //         ),
      //       }),
      //     },
      //   ],
      // },
    ],
  };
}

export function buildTOS(translation) {
  return {
    title: translation("Title"),
    subtitle: translation("LastUpdated"),
    sections: [
      {
        title: translation("Subtitle.1"),
        paragraphs: [{ text: translation("Paragraphs.1-1") }],
      },
      {
        title: translation("Subtitle.2"),
        paragraphs: [
          { text: translation("Paragraphs.2-1") },
          {
            text: translation("Paragraphs.2-2"),
            list: [
              translation("Lists.2-2.1"),
              translation("Lists.2-2.2"),
              translation("Lists.2-2.3"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.3"),
        paragraphs: [
          { text: translation("Paragraphs.3-1") },
          { text: translation("Paragraphs.3-2") },
        ],
      },
      {
        title: translation("Subtitle.4"),
        paragraphs: [
          {
            text: translation("Paragraphs.4-1"),
            list: [
              translation("Lists.4-1.1"),
              translation("Lists.4-1.2"),
              translation("Lists.4-1.3"),
              translation("Lists.4-1.4"),
              translation("Lists.4-1.5"),
              translation("Lists.4-1.6"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.5"),
        paragraphs: [
          { text: translation("Paragraphs.5-1") },
          { text: translation("Paragraphs.5-2") },
        ],
      },
      {
        title: translation("Subtitle.6"),
        paragraphs: [
          { text: translation("Paragraphs.6-1") },
          { text: translation("Paragraphs.6-2") },
        ],
      },
      {
        title: translation("Subtitle.7"),
        paragraphs: [
          { text: translation("Paragraphs.7-1") },
          { text: translation("Paragraphs.7-2") },
        ],
      },
      {
        title: translation("Subtitle.8"),
        paragraphs: [
          { text: translation("Paragraphs.8-1") },
          { text: translation("Paragraphs.8-2") },
        ],
      },
      {
        title: translation("Subtitle.9"),
        paragraphs: [{ text: translation("Paragraphs.9-1") }],
      },
      {
        title: translation("Subtitle.10"),
        paragraphs: [{ text: translation("Paragraphs.10-1") }],
      },
      {
        title: translation("Subtitle.11"),
        paragraphs: [
          { text: translation("Paragraphs.11-1") },
          { text: translation("Paragraphs.11-2") },
        ],
      },
      {
        title: translation("Subtitle.12"),
        paragraphs: [
          { text: translation("Paragraphs.12-1") },
          { text: translation("Paragraphs.12-2") },
        ],
      },
      {
        title: translation("Subtitle.13"),
        paragraphs: [
          { text: translation("Paragraphs.13-1") },
          {
            text: translation.rich("Paragraphs.13-2", {
              company: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
              email: (chunks) => <a href="mailto:geral@digik.pt">{chunks}</a>,
              website: (chunks) => (
                <a
                  href="https://www.digik.pt"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {chunks}
                </a>
              ),
            }),
          },
        ],
      },
    ],
  };
}

export function buildPrivacy(translation) {
  return {
    title: translation("Title"),
    subtitle: translation("LastUpdated"),
    sections: [
      {
        title: null,
        paragraphs: [
          {
            text: translation.rich("Paragraphs.0-1", {
              strong: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
            }),
          },
          { text: translation.rich("Paragraphs.0-2", { br: () => <br /> }) },
          { text: translation.rich("Paragraphs.0-3", { br: () => <br /> }) },
          {
            text: translation.rich("Paragraphs.0-4", {
              br: () => <br />,
              strong: (chunks) => <strong>{chunks}</strong>,
            }),
          },
        ],
      },
      {
        title: translation("Subtitle.1"),
        paragraphs: [
          { text: translation("Paragraphs.1-1") },
          {
            text: translation.rich("Paragraphs.1-2", {
              strong: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
              email: (chunks) => <a href="mailto:geral@digik.pt">{chunks}</a>,
              web: (chunks) => (
                <a
                  href="https://www.digik.pt"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {chunks}
                </a>
              ),
            }),
          },
        ],
      },
      {
        title: translation("Subtitle.2"),
        paragraphs: [
          { text: translation("Paragraphs.2-1") },
          {
            text: translation.rich("Paragraphs.2-2", {
              strong: (chunks) => <strong>{chunks}</strong>,
            }),
          },
          { text: translation("Paragraphs.2-3") },
        ],
      },
      {
        title: translation("Subtitle.3"),
        paragraphs: [
          { text: translation("Paragraphs.3-1") },
          {
            text: translation.rich("Paragraphs.3-1-1", {
              strong: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
            }),
            list: [
              translation.rich("Lists.3-1-1.1"),
              translation.rich("Lists.3-1-1.2"),
              translation.rich("Lists.3-1-1.3"),
              translation.rich("Lists.3-1-1.4"),
            ],
          },
          {
            text: translation.rich("Paragraphs.3-1-2", {
              strong: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
            }),
            list: [
              translation.rich("Lists.3-1-2.1"),
              translation.rich("Lists.3-1-2.2"),
              translation.rich("Lists.3-1-2.3"),
              translation.rich("Lists.3-1-2.4"),
              translation.rich("Lists.3-1-2.5"),
            ],
          },
          {
            text: translation.rich("Paragraphs.3-1-3", {
              strong: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
            }),
            list: [
              translation.rich("Lists.3-1-3.1"),
              translation.rich("Lists.3-1-3.2"),
              translation.rich("Lists.3-1-3.3"),
              translation.rich("Lists.3-1-3.4"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.4"),
        paragraphs: [
          {
            list: [
              translation.rich("Lists.4-1.1"),
              translation.rich("Lists.4-1.2"),
              translation.rich("Lists.4-1.3"),
              translation.rich("Lists.4-1.4"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.5"),
        paragraphs: [
          {
            list: [
              translation.rich("Lists.5-1.1"),
              translation.rich("Lists.5-1.2"),
              translation.rich("Lists.5-1.3"),
              translation.rich("Lists.5-1.4"),
              translation.rich("Lists.5-1.5"),
              translation.rich("Lists.5-1.6"),
              translation.rich("Lists.5-1.7"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.6"),
        paragraphs: [
          {
            text: translation("Paragraphs.6-1"),
          },
          {
            text: translation("Paragraphs.6-2"),
          },
          {
            text: translation("Paragraphs.6-3"),
          },
        ],
      },
      {
        title: translation("Subtitle.7"),
        paragraphs: [
          {
            list: [
              translation.rich("Lists.7-1.1"),
              translation.rich("Lists.7-1.2"),
              translation.rich("Lists.7-1.3"),
              translation.rich("Lists.7-1.4"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.8"),
        paragraphs: [
          {
            text: translation("Paragraphs.8-1"),
          },
          {
            text: translation("Paragraphs.8-2"),
          },
        ],
      },
      {
        title: translation("Subtitle.9"),
        paragraphs: [
          {
            text: translation("Paragraphs.9-1"),
          },
          {
            text: translation("Paragraphs.9-2"),
          },
        ],
      },
      {
        title: translation("Subtitle.10"),
        paragraphs: [
          {
            text: translation("Paragraphs.10-1"),
          },
        ],
      },
      {
        title: translation("Subtitle.11"),
        paragraphs: [
          {
            text: translation("Paragraphs.11-1"),
          },
        ],
      },
      {
        title: translation("Subtitle.12"),
        paragraphs: [
          {
            text: translation.rich("Paragraphs.12-1", {
              email: (chunks) => <a href="mailto:geral@digik.pt">{chunks}</a>,
            }),
          },
        ],
      },
      {
        title: translation("Subtitle.13"),
        paragraphs: [
          {
            text: translation("Paragraphs.13-1"),
          },
        ],
      },
      {
        title: translation("Subtitle.14"),
        paragraphs: [
          {
            text: translation("Paragraphs.14-1"),
          },
        ],
      },
      {
        title: translation("Subtitle.15"),
        paragraphs: [
          {
            text: translation.rich("Paragraphs.15-1", {
              strong: (chunks) => <strong>{chunks}</strong>,
              br: () => <br />,
              email: (chunks) => <a href="mailto:geral@digik.pt">{chunks}</a>,
            }),
          },
        ],
      },
    ],
  };
}

export function buildSec(translation) {
  return {
    title: translation("Title"),
    subtitle: translation("LastUpdated"),
    sections: [
      {
        title: translation("Subtitle.1"),
        paragraphs: [
          { text: translation("Paragraphs.1-1") },
          {
            text: translation("Paragraphs.1-2"),
            list: [
              translation("Lists.1-2.1"),
              translation("Lists.1-2.2"),
              translation("Lists.1-2.3"),
              translation("Lists.1-2.4"),
              translation("Lists.1-2.5"),
            ],
          },
        ],
      },
      {
        title: translation("Subtitle.2"),
        paragraphs: [
          { text: translation("Paragraphs.2-1") },
          { text: translation("Paragraphs.2-2") },
        ],
      },
      {
        title: translation("Subtitle.3"),
        paragraphs: [
          { text: translation("Paragraphs.3-1") },
          { text: translation("Paragraphs.3-2") },
          { text: translation("Paragraphs.3-3") },
        ],
      },
      {
        title: translation("Subtitle.4"),
        paragraphs: [
          { text: translation("Paragraphs.4-1") },
          {
            text: translation("Paragraphs.4-2"),
            list: [
              translation.rich("Lists.4-2.1", {
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              translation.rich("Lists.4-2.2", {
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              translation.rich("Lists.4-2.3", {
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              translation.rich("Lists.4-2.4", {
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              translation.rich("Lists.4-2.5", {
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              translation.rich("Lists.4-2.6", {
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
            ],
          },
          { text: translation("Paragraphs.4-3") },
        ],
      },
      {
        title: translation("Subtitle.5"),
        paragraphs: [
          {
            table: {
              headers: [
                translation("Table.5.Headers.1"),
                translation("Table.5.Headers.2"),
                translation("Table.5.Headers.3"),
                translation("Table.5.Headers.4"),
                translation("Table.5.Headers.5"),
                translation("Table.5.Headers.6"),
              ],
              rows: [
                [
                  translation("Table.5.Rows.1.1"),
                  translation("Table.5.Rows.1.2"),
                  translation("Table.5.Rows.1.3"),
                  translation("Table.5.Rows.1.4"),
                  translation("Table.5.Rows.1.5"),
                  translation("Table.5.Rows.1.6"),
                ],
                [
                  translation("Table.5.Rows.2.1"),
                  translation("Table.5.Rows.2.2"),
                  translation("Table.5.Rows.2.3"),
                  translation("Table.5.Rows.2.4"),
                  translation("Table.5.Rows.2.5"),
                  translation("Table.5.Rows.2.6"),
                ],
                [
                  translation("Table.5.Rows.3.1"),
                  translation("Table.5.Rows.3.2"),
                  translation("Table.5.Rows.3.3"),
                  translation("Table.5.Rows.3.4"),
                  translation("Table.5.Rows.3.5"),
                  translation("Table.5.Rows.3.6"),
                ],
                [
                  translation("Table.5.Rows.4.1"),
                  translation("Table.5.Rows.4.2"),
                  translation("Table.5.Rows.4.3"),
                  translation("Table.5.Rows.4.4"),
                  translation("Table.5.Rows.4.5"),
                  translation("Table.5.Rows.4.6"),
                ],
              ],
            },
          },
          { text: translation("Paragraphs.5-1") },
        ],
      },
    ],
  };
}
