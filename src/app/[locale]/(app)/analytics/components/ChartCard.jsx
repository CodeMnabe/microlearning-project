import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import styles from "../analytics.module.css";
import { safeNumber } from "../lib/analytics.helpers";

/**
 * Card com gráfico de barras.
 * Usado para mostrar distribuições e comparações por categoria.
 */
export default function ChartCard({ title, description, data }) {
  const hasData = data.some((item) => safeNumber(item.value) > 0);

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>{title}</h2>

        {description && (
          <p className={styles.chartDescription}>{description}</p>
        )}
      </div>

      <div className={styles.chartBox}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="28%" barGap={8}>
              <CartesianGrid strokeDasharray="1 1" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="var(--brand-1)"
                radius={[8, 8, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.chartEmpty}>Sem dados para mostrar.</div>
        )}
      </div>
    </section>
  );
}