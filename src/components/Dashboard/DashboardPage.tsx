import { type ReactElement, useMemo } from 'react';
import { Progress } from 'antd';
import {
  FundOutlined,
  AppstoreOutlined,
  RiseOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { useInvestments } from '../../hooks/useInvestments';
import { useCategories } from '../../hooks/useCategories';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency, formatCompactCurrency } from '../../utils/formatCurrency';
import type { Currency } from '../../types/investment';
import styles from './Dashboard.module.css';

type CategorySummary = {
  categoryName: string;
  icon: string;
  color: string;
  currentAmount: number;
  targetAmount: number | null;
};

function DashboardPage(): ReactElement {
  const { t } = useTranslation();
  const { investments, totalAmount } = useInvestments();
  const { categories } = useCategories();
  const currency = useSettingsStore(useShallow((state) => state.currency));

  const categorySummaries = useMemo((): CategorySummary[] => {
    const summaryMap = new Map<string, CategorySummary>();

    for (const category of categories) {
      summaryMap.set(category.id, {
        categoryName: category.category_name,
        icon: category.icon,
        color: category.color,
        currentAmount: 0,
        targetAmount: category.target_amount,
      });
    }

    for (const investment of investments) {
      if (!investment.category_id) continue;

      const existing = summaryMap.get(investment.category_id);
      if (existing) {
        existing.currentAmount += investment.amount;
      }
    }

    return Array.from(summaryMap.values()).filter(
      (summary) => summary.currentAmount > 0,
    );
  }, [investments, categories]);

  const pieChartData = useMemo(
    () =>
      categorySummaries.map((summary) => ({
        name: summary.categoryName,
        value: summary.currentAmount,
        color: summary.color,
      })),
    [categorySummaries],
  );

  const largestInvestment = useMemo(() => {
    if (investments.length === 0) return null;
    return investments.reduce((largest, current) =>
      current.amount > largest.amount ? current : largest,
    );
  }, [investments]);

  const hasData = investments.length > 0;

  return (
    <div className={styles.dashboardGrid}>
      <h1 className={styles.pageTitle}>{t('dashboard.title')}</h1>

      <div className={styles.summaryRow}>
        <SummaryCard
          label={t('dashboard.totalAssets')}
          value={formatCurrency(totalAmount, currency)}
          icon={<FundOutlined />}
          isAccent
        />
        <SummaryCard
          label={t('dashboard.totalCategories')}
          value={String(categorySummaries.length)}
          icon={<AppstoreOutlined />}
        />
        <SummaryCard
          label={t('dashboard.totalInvestments')}
          value={String(investments.length)}
          icon={<RiseOutlined />}
        />
        <SummaryCard
          label={t('dashboard.largestInvestment')}
          value={
            largestInvestment
              ? formatCompactCurrency(largestInvestment.amount, currency)
              : '—'
          }
          icon={<TrophyOutlined />}
        />
      </div>

      {!hasData && (
        <div className={`glass-card ${styles.emptyState}`}>
          <div className={styles.emptyIcon}>📊</div>
          <p className={styles.emptyText}>{t('dashboard.noData')}</p>
        </div>
      )}

      {hasData && (
        <div className={styles.chartsRow}>
          <div className={`glass-card ${styles.chartCard}`}>
            <h3 className={styles.chartTitle}>{t('dashboard.allocation')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), currency)}
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className={`glass-card ${styles.chartCard}`}>
            <h3 className={styles.chartTitle}>{t('dashboard.categoryProgress')}</h3>
            <CategoryProgressList
              summaries={categorySummaries}
              currency={currency}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  icon: ReactElement;
  isAccent?: boolean;
};

function SummaryCard({ label, value, icon, isAccent }: SummaryCardProps): ReactElement {
  return (
    <div className={`glass-card ${styles.summaryCard}`}>
      <div className={styles.summaryIcon}>{icon}</div>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={isAccent ? styles.summaryValueAccent : styles.summaryValue}>
        {value}
      </div>
    </div>
  );
}

type CategoryProgressListProps = {
  summaries: CategorySummary[];
  currency: Currency;
};

function CategoryProgressList({
  summaries,
  currency,
}: CategoryProgressListProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles.progressList}>
      {summaries.map((summary) => {
        const hasTarget = summary.targetAmount !== null && summary.targetAmount > 0;
        const percentage = hasTarget
          ? Math.min((summary.currentAmount / summary.targetAmount!) * 100, 100)
          : 0;
        const isExceeded = hasTarget && summary.currentAmount > summary.targetAmount!;

        return (
          <div key={summary.categoryName} className={styles.progressItem}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>
                <span className={styles.progressIcon}>{summary.icon}</span>
                {summary.categoryName}
              </span>
              <span className={styles.progressAmount}>
                {formatCompactCurrency(summary.currentAmount, currency)}
              </span>
            </div>
            {hasTarget ? (
              <>
                <Progress
                  percent={percentage}
                  strokeColor={isExceeded ? 'var(--warning)' : summary.color}
                  trailColor="rgba(255,255,255,0.06)"
                  showInfo={false}
                  size="small"
                />
                <div className={styles.progressTarget}>
                  {isExceeded && (
                    <span className={styles.exceededBadge}>
                      {t('dashboard.exceeded')}{' '}
                    </span>
                  )}
                  {t('dashboard.target')}: {formatCompactCurrency(summary.targetAmount!, currency)}
                </div>
              </>
            ) : (
              <div className={styles.progressTarget}>{t('dashboard.noTarget')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DashboardPage;
