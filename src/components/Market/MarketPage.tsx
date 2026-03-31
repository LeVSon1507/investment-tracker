import { type ReactElement, useMemo, useState } from "react";
import { Button, Tabs } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { useMarketData } from "../../hooks/useMarketData";
import { useInvestments } from "../../hooks/useInvestments";
import { useSettingsStore } from "../../stores/settingsStore";
import { formatCurrency, formatCompactCurrency } from "../../utils/formatCurrency";
import type { GoldPriceRow, StockQuote } from "../../lib/marketData";
import type { Currency } from "../../types/investment";
import styles from "./MarketPage.module.css";

// 1 lượng = 10 chỉ
const LUONG_PER_CHI = 10;

type GoldTableRowProps = {
  readonly row: GoldPriceRow;
  readonly currency: Currency;
};

function GoldTableRow({ row, currency }: GoldTableRowProps): ReactElement {
  const buyPerChi = row.buyPrice / LUONG_PER_CHI;
  const sellPerChi = row.sellPrice / LUONG_PER_CHI;

  return (
    <div className={styles.tableRow}>
      <div className={styles.productCell}>
        <div className={styles.productName}>{row.productName}</div>
        <div className={styles.groupName}>{row.groupName}</div>
      </div>
      <div className={styles.cellRight}>
        <div className={`${styles.priceMain} ${styles.priceBuy}`}>
          {formatCurrency(row.buyPrice, currency)}
        </div>
        <div className={styles.priceUnit}>/lượng</div>
      </div>
      <div className={styles.cellRight}>
        <div className={`${styles.priceMain} ${styles.priceSell}`}>
          {formatCurrency(row.sellPrice, currency)}
        </div>
        <div className={styles.priceUnit}>/lượng</div>
      </div>
      <div className={`${styles.cellRight} ${styles.colHideMobile}`}>
        <div className={`${styles.priceMain} ${styles.priceBuy}`}>
          {formatCurrency(buyPerChi, currency)}
        </div>
        <div className={styles.priceUnit}>/chỉ</div>
      </div>
      <div className={`${styles.cellRight} ${styles.colHideMobile}`}>
        <div className={`${styles.priceMain} ${styles.priceSell}`}>
          {formatCurrency(sellPerChi, currency)}
        </div>
        <div className={styles.priceUnit}>/chỉ</div>
      </div>
    </div>
  );
}

type StockRowProps = {
  readonly quote: StockQuote;
  readonly investedAmount: number | null;
  readonly investedQuantity: number | null;
  readonly purchasePrice: number | null;
  readonly currency: Currency;
};

function StockRow({
  quote,
  investedAmount,
  investedQuantity,
  purchasePrice,
  currency,
}: StockRowProps): ReactElement {
  const hasPosition = investedQuantity !== null && investedQuantity > 0;
  const profitLoss =
    hasPosition && purchasePrice !== null
      ? investedQuantity * (quote.price - purchasePrice)
      : null;
  const isProfitable = profitLoss !== null && profitLoss >= 0;

  return (
    <div className={styles.stockRow}>
      <div className={styles.stockInfo}>
        <div className={styles.stockSymbol}>{quote.symbol}</div>
        <div className={styles.stockMeta}>
          {quote.source}
          {quote.timestamp ? ` · ${new Date(quote.timestamp).toLocaleDateString("vi-VN")}` : ""}
        </div>
      </div>
      <div className={styles.stockPrice}>
        <div className={styles.priceMain}>
          {formatCompactCurrency(quote.price, currency)}
        </div>
        <div
          className={
            quote.change !== null && quote.change >= 0
              ? styles.changeUp
              : styles.changeDown
          }
        >
          {quote.changePercent !== null
            ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`
            : "—"}
        </div>
      </div>
      <div className={`${styles.cellRight} ${styles.colHideMobile}`}>
        {hasPosition ? (
          <>
            <div className={styles.priceMain}>
              {investedQuantity.toLocaleString("vi-VN")} cp
            </div>
            <div className={styles.priceUnit}>
              {formatCompactCurrency(investedAmount ?? 0, currency)}
            </div>
          </>
        ) : (
          <div className={styles.priceUnit}>—</div>
        )}
      </div>
      <div className={`${styles.cellRight} ${styles.colHideMobile}`}>
        {profitLoss !== null ? (
          <div className={isProfitable ? styles.changeUp : styles.changeDown}>
            {formatCompactCurrency(profitLoss, currency)}
          </div>
        ) : (
          <div className={styles.priceUnit}>—</div>
        )}
      </div>
    </div>
  );
}

function MarketPage(): ReactElement {
  const currency = useSettingsStore(useShallow((state) => state.currency));
  const { investments } = useInvestments();
  const [activeTab, setActiveTab] = useState("gold");

  // Extract stock symbols from investments that have ticker_symbol or tracking_type = stock
  const investmentStockSymbols = useMemo((): string[] => {
    const symbolSet = new Set<string>();

    for (const investment of investments) {
      // Direct ticker symbol from user input
      if (investment.ticker_symbol) {
        symbolSet.add(investment.ticker_symbol.trim().toUpperCase());
      }

      // Also try to extract 3-5 letter uppercase codes from investment names
      // that are in stock/fund categories
      if (
        investment.tracking_type === "stock" ||
        investment.tracking_type === "fund"
      ) {
        const nameMatches =
          investment.investment_name.toUpperCase().match(/\b[A-Z]{3,5}\b/g) ?? [];
        for (const match of nameMatches) {
          symbolSet.add(match);
        }
      }
    }

    return Array.from(symbolSet);
  }, [investments]);

  const { marketOverview, isLoading, error, refetch } = useMarketData(
    investmentStockSymbols,
  );

  const goldPrices = marketOverview?.goldPrices ?? [];
  const stockQuotes = marketOverview?.stockQuotes ?? [];

  // Build a lookup from symbol → investment data for the stock tab
  const stockInvestmentLookup = useMemo(() => {
    const lookup = new Map<
      string,
      { amount: number; quantity: number; purchasePrice: number | null }
    >();

    for (const investment of investments) {
      const symbol = (
        investment.ticker_symbol ?? ""
      )
        .trim()
        .toUpperCase();
      if (!symbol) continue;
      if (
        investment.tracking_type !== "stock" &&
        investment.tracking_type !== "fund"
      )
        continue;

      const existing = lookup.get(symbol);
      if (existing) {
        existing.amount += investment.amount;
        existing.quantity += investment.quantity ?? 0;
      } else {
        lookup.set(symbol, {
          amount: investment.amount,
          quantity: investment.quantity ?? 0,
          purchasePrice: investment.purchase_unit_price,
        });
      }
    }

    return lookup;
  }, [investments]);

  const tabItems = [
    {
      key: "gold",
      label: "🥇 Vàng",
      children: (
        <div className={styles.tabContent}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>Giá vàng trong nước</div>
              <div className={styles.cardMeta}>
                {marketOverview?.updatedAt
                  ? `Cập nhật: ${new Date(marketOverview.updatedAt).toLocaleString("vi-VN")}`
                  : "Chưa có dữ liệu"}
              </div>
            </div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
              size="small"
            >
              Làm mới
            </Button>
          </div>

          {error && <div className={styles.errorText}>{error}</div>}

          {goldPrices.length > 0 ? (
            <div className={styles.tableWrapper}>
              <div className={styles.tableHeader}>
                <span>Loại vàng</span>
                <span className={styles.headerBuy}>Mua / lượng</span>
                <span className={styles.headerSell}>Bán / lượng</span>
                <span className={`${styles.headerBuy} ${styles.colHideMobile}`}>
                  Mua / chỉ
                </span>
                <span
                  className={`${styles.headerSell} ${styles.colHideMobile}`}
                >
                  Bán / chỉ
                </span>
              </div>
              {goldPrices.map((row) => (
                <GoldTableRow
                  key={`${row.groupName}-${row.productName}`}
                  row={row}
                  currency={currency}
                />
              ))}
            </div>
          ) : (
            !isLoading && (
              <div className={styles.emptyText}>
                Không có dữ liệu giá vàng.
              </div>
            )
          )}
        </div>
      ),
    },
    {
      key: "stocks",
      label: "📈 Chứng khoán",
      children: (
        <div className={styles.tabContent}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>Cổ phiếu & Chứng chỉ quỹ</div>
              <div className={styles.cardMeta}>
                {investmentStockSymbols.length > 0
                  ? `Đang theo dõi: ${investmentStockSymbols.join(", ")}`
                  : "Chưa có mã nào được theo dõi"}
              </div>
            </div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
              size="small"
            >
              Làm mới
            </Button>
          </div>

          {error && <div className={styles.errorText}>{error}</div>}

          {stockQuotes.length > 0 ? (
            <div className={styles.tableWrapper}>
              <div className={styles.stockTableHeader}>
                <span>Mã CK</span>
                <span className={styles.headerRight}>Giá hiện tại</span>
                <span
                  className={`${styles.headerRight} ${styles.colHideMobile}`}
                >
                  Vị thế
                </span>
                <span
                  className={`${styles.headerRight} ${styles.colHideMobile}`}
                >
                  Lãi/Lỗ
                </span>
              </div>
              {stockQuotes.map((quote) => {
                const investmentData = stockInvestmentLookup.get(quote.symbol);
                return (
                  <StockRow
                    key={quote.symbol}
                    quote={quote}
                    investedAmount={investmentData?.amount ?? null}
                    investedQuantity={investmentData?.quantity ?? null}
                    purchasePrice={investmentData?.purchasePrice ?? null}
                    currency={currency}
                  />
                );
              })}
            </div>
          ) : (
            !isLoading && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📊</div>
                <div className={styles.emptyTitle}>
                  Chưa có mã chứng khoán nào
                </div>
                <div className={styles.emptyHint}>
                  Thêm khoản đầu tư chứng khoán qua Chat AI hoặc trang Đầu tư
                  với kiểu tracking "Cổ phiếu" để theo dõi giá tại đây.
                </div>
              </div>
            )
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Quan sát thị trường</h1>

      <div className={`glass-card ${styles.card}`}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className={styles.marketTabs}
        />
      </div>
    </div>
  );
}

export default MarketPage;
