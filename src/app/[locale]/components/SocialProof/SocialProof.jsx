import styles from "./socialProof.module.css";

const TESTIMONIALS = [
  {
    id: 1,
    name: "Alessio Spanzarico",
    role: "Founder",
    text: "I can’t believe how simple it is to implement…",
  },
  {
    id: 2,
    name: "Justin Welsh",
    role: "Creator",
    text: "Thinking about launching a community or SaaS…",
  },
  {
    id: 3,
    name: "Brynn Watson",
    role: "Founder",
    text: "We’ve loved working with the product…",
  },
];

export default function SocialProof() {
  return (
    <section className={styles.socialProof}>
      <div className={styles.container}>
        <h2 className={styles.quote}>
          “Everything you need to build a recurring revenue business…”
        </h2>

        <div className={styles.grid}>
          {TESTIMONIALS.map((t) => (
            <div key={t.id} className={styles.card}>
              <div className={styles.top}>
                <div className={styles.avatar} aria-hidden />
                <div>
                  <div className={styles.name}>{t.name}</div>
                  <div className={styles.role}>{t.role}</div>
                </div>
              </div>
              <p className={styles.text}>{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
