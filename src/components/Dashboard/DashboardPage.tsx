import { type ReactElement, useMemo } from "react";
import { Progress } from "antd";
import {
  FundOutlined,
  AppstoreOutlined,
  RiseOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/shallow";
import { useInvestments } from "../../hooks/useInvestments";
import { useCategories } from "../../hooks/useCategories";
import { useMarketData } from "../../hooks/useMarketData";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  formatCurrency,
  formatCompactCurrency,
} from "../../utils/formatCurrency";
import { findLiveUnitPrice, normalizeTickerSymbol } from "../../lib/marketData";
import type { Currency } from "../../types/investment";
import styles from "./Dashboard.module.css";

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
  const {
    marketOverview,
  } = useMarketData(
    useMemo(
      () =>
        investments.map(
          (investment) =>
            investment.ticker_symbol ?? investment.investment_name,
        ),
      [investments],
    ),
  );

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
      if (!investment.category_id || !investment.include_in_total) continue;

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
    const includedInvestments = investments.filter(
      (investment) => investment.include_in_total,
    );
    if (includedInvestments.length === 0) return null;
    return includedInvestments.reduce((largest, current) =>
      current.amount > largest.amount ? current : largest,
    );
  }, [investments]);

  const hasData = investments.length > 0;
  const portfolioStats = useMemo(() => {
    const positions = investments.map((investment) => {
      const liveUnitPrice = findLiveUnitPrice(
        investment.tracking_type,
        investment.ticker_symbol,
        investment.investment_name,
        marketOverview,
      );
      const hasQuantity =
        investment.quantity !== null && investment.quantity > 0;
      const costBasis =
        hasQuantity && investment.purchase_unit_price !== null
          ? Number(investment.quantity) * investment.purchase_unit_price
          : investment.amount;
      const currentValue =
        hasQuantity && liveUnitPrice !== null
          ? Number(investment.quantity) * liveUnitPrice
          : investment.amount;
      const profitLoss = currentValue - costBasis;

      return {
        id: investment.id,
        investmentName: investment.investment_name,
        tickerSymbol: normalizeTickerSymbol(investment.ticker_symbol),
        trackingType: investment.tracking_type,
        quantity: investment.quantity,
        liveUnitPrice,
        currentValue,
        costBasis,
        profitLoss,
      };
    });
    const trackedPositions = positions
      .filter((position) => position.trackingType !== "none")
      .sort((a, b) => b.currentValue - a.currentValue);
    const currentMarketValue = positions.reduce(
      (sum, position) => sum + position.currentValue,
      0,
    );
    const totalCostBasis = positions.reduce(
      (sum, position) => sum + position.costBasis,
      0,
    );

    return {
      currentMarketValue,
      totalCostBasis,
      totalProfitLoss: currentMarketValue - totalCostBasis,
      trackedPositions,
    };
  }, [investments, marketOverview]);

  const stockCategoryIds = useMemo(
    () =>
      categories
        .filter(
          (category) =>
            category.category_name.toLowerCase().includes("chứng khoán") ||
            category.category_name.toLowerCase().includes("stocks"),
        )
        .map((category) => category.id),
    [categories],
  );

  const stockInvestments = useMemo(
    () =>
      investments.filter(
        (investment) =>
          investment.category_id &&
          stockCategoryIds.includes(investment.category_id),
      ),
    [investments, stockCategoryIds],
  );
  const stockQuotes = marketOverview?.stockQuotes ?? [];

  return (
    <div className={styles.dashboardGrid}>
      <h1 className={styles.pageTitle}>{t("dashboard.title")}</h1>

      <div className={styles.summaryRow}>
        <SummaryCard
          label={t("dashboard.totalAssets")}
          value={formatCurrency(
            portfolioStats.currentMarketValue || totalAmount,
            currency,
          )}
          icon={<FundOutlined />}
          isAccent
        />
        <SummaryCard
          label={t("dashboard.totalCategories")}
          value={String(categorySummaries.length)}
          icon={<AppstoreOutlined />}
        />
        <SummaryCard
          label={t("dashboard.totalInvestments")}
          value={String(investments.length)}
          icon={<RiseOutlined />}
        />
        <SummaryCard
          label={t("dashboard.largestInvestment")}
          value={
            largestInvestment
              ? formatCompactCurrency(largestInvestment.amount, currency)
              : "—"
          }
          icon={<TrophyOutlined />}
        />
      </div>



      {!hasData && (
        <div className={`glass-card ${styles.emptyState}`}>
          <div className={styles.emptyIcon}>📊</div>
          <p className={styles.emptyText}>{t("dashboard.noData")}</p>
        </div>
      )}

      {hasData && (
        <div className={styles.chartsRow}>
          <div className={`glass-card ${styles.chartCard}`}>
            <h3 className={styles.chartTitle}>{t("dashboard.allocation")}</h3>
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
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span
                      style={{ color: "var(--text-secondary)", fontSize: 13 }}
                    >
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className={`glass-card ${styles.chartCard}`}>
            <h3 className={styles.chartTitle}>
              {t("dashboard.categoryProgress")}
            </h3>
            <CategoryProgressList
              summaries={categorySummaries}
              currency={currency}
            />
          </div>
        </div>
      )}

      <div className={styles.marketSection}>
        <div className={`glass-card ${styles.marketCard}`}>
          <div className={styles.marketHeader}>
            <div>
              <h3 className={styles.chartTitle}>Cổ phiếu Việt Nam live</h3>
              <div className={styles.marketMeta}>
                {stockInvestments.length} khoản chứng khoán đang được theo dõi
              </div>
            </div>
          </div>
          <div className={styles.marketList}>
            {stockQuotes.map((quote) => (
              <div key={quote.symbol} className={styles.marketRow}>
                <div>
                  <div className={styles.marketName}>{quote.symbol}</div>
                  <div className={styles.marketMeta}>{quote.source}</div>
                </div>
                <div className={styles.marketPriceGroup}>
                  <span>{formatCompactCurrency(quote.price, currency)}</span>
                  <span
                    className={
                      quote.change !== null && quote.change >= 0
                        ? styles.marketUp
                        : styles.marketDown
                    }
                  >
                    {quote.changePercent !== null
                      ? `${quote.changePercent.toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            ))}
            {stockQuotes.length === 0 && (
              <div className={styles.marketEmpty}>
                Thêm mã tài sản (VD: FPT, VCB) khi tạo khoản đầu tư để theo dõi giá realtime.
              </div>
            )}
          </div>
        </div>

        <div className={`glass-card ${styles.marketCard}`}>
          <div className={styles.marketHeader}>
            <div>
              <h3 className={styles.chartTitle}>So sánh giá trị thực tế</h3>
              <div className={styles.marketMeta}>
                Dựa trên số lượng, giá mua và giá thị trường hiện tại
              </div>
            </div>
          </div>
          <div className={styles.marketList}>
            {portfolioStats.trackedPositions.map((position) => (
              <div key={position.id} className={styles.positionRow}>
                <div>
                  <div className={styles.marketName}>
                    {position.investmentName}
                    {position.tickerSymbol &&
                      !position.investmentName
                        .toUpperCase()
                        .includes(position.tickerSymbol.toUpperCase())
                      ? ` (${position.tickerSymbol})`
                      : ""}
                  </div>
                  <div className={styles.marketMeta}>
                    Giá vốn:{" "}
                    {formatCompactCurrency(position.costBasis, currency)}
                    {" · "}
                    Hiện tại:{" "}
                    {formatCompactCurrency(position.currentValue, currency)}
                  </div>
                </div>
                <div className={styles.marketPriceGroup}>
                  <span>
                    {position.liveUnitPrice !== null
                      ? formatCompactCurrency(position.liveUnitPrice, currency)
                      : "—"}
                  </span>
                  <span
                    className={
                      position.profitLoss >= 0
                        ? styles.marketUp
                        : styles.marketDown
                    }
                  >
                    {formatCompactCurrency(position.profitLoss, currency)}
                  </span>
                </div>
              </div>
            ))}
            {portfolioStats.trackedPositions.length === 0 && (
              <div className={styles.marketEmpty}>
                Hãy thêm mã tài sản, số lượng và giá mua trong khoản đầu tư để
                app tính giá trị thực tế.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  icon: ReactElement;
  isAccent?: boolean;
};

function SummaryCard({
  label,
  value,
  icon,
  isAccent,
}: SummaryCardProps): ReactElement {
  return (
    <div className={`glass-card ${styles.summaryCard}`}>
      <div className={styles.summaryIcon}>{icon}</div>
      <div className={styles.summaryLabel}>{label}</div>
      <div
        className={isAccent ? styles.summaryValueAccent : styles.summaryValue}
      >
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
        const hasTarget =
          summary.targetAmount !== null && summary.targetAmount > 0;
        const percentage = hasTarget
          ? Math.min((summary.currentAmount / summary.targetAmount!) * 100, 100)
          : 0;
        const isExceeded =
          hasTarget && summary.currentAmount > summary.targetAmount!;

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
                  strokeColor={isExceeded ? "var(--warning)" : summary.color}
                  trailColor="rgba(255,255,255,0.06)"
                  showInfo={false}
                  size="small"
                />
                <div className={styles.progressTarget}>
                  {isExceeded && (
                    <span className={styles.exceededBadge}>
                      {t("dashboard.exceeded")}{" "}
                    </span>
                  )}
                  {t("dashboard.target")}:{" "}
                  {formatCompactCurrency(summary.targetAmount!, currency)}
                </div>
              </>
            ) : (
              <div className={styles.progressTarget}>
                {t("dashboard.noTarget")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DashboardPage;
