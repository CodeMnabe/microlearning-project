import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import styles from "../analytics.module.css";
import DescriptionInfo from "./DescriptionInfo";
import {
  safeNumber,
  formatDateLabel,
} from "../lib/analytics.helpers";

/**
 * Card com gráfico de linha.
 * Usado para mostrar evolução diária.
 */
export default function TrendChartCard({
  title,
  description,
  data = [],
  dataKey,
  locale,
  emptyMessage,
}) {
  const rawData = Array.isArray(data) ? data : [];

  const hasData = rawData.some((item) => safeNumber(item?.[dataKey]) > 0);

  const chartData = rawData.map((item) => ({
    ...item,
    label: formatDateLabel(item.date, locale),
  }));

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.titleWithInfo}>
          <h2 className={styles.chartTitle}>{title}</h2>
          <DescriptionInfo text={description} />
        </div>
      </div>

      <div
        className={`${styles.chartBox} ${
          !hasData ? styles.chartBoxEmpty : ""
        }`}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 8,
                right: 18,
                left: 0,
                bottom: 4,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="var(--brand-1)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.chartEmpty}>
            <span>{emptyMessage || "Sem dados para mostrar."}</span>
          </div>
        )}
      </div>
    </section>
  );
}