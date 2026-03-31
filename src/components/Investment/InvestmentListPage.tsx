import { type ReactElement, useState, useMemo, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Popconfirm,
  message,
  Space,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/shallow";
import { useInvestments } from "../../hooks/useInvestments";
import { useMarketData } from "../../hooks/useMarketData";
import { useCategories } from "../../hooks/useCategories";
import { useSettingsStore } from "../../stores/settingsStore";
import { formatCurrency } from "../../utils/formatCurrency";
import { findLiveUnitPrice } from "../../lib/marketData";
import type {
  AssetTrackingType,
  InvestmentWithCategory,
} from "../../types/investment";
import styles from "./Investment.module.css";

type FormValues = {
  investmentName: string;
  categoryId: string;
  amount: number;
  targetAmount?: number;
  includeInTotal: boolean;
  trackingType: AssetTrackingType;
  tickerSymbol?: string;
  quantity?: number;
  purchaseUnitPrice?: number;
  purchaseDate?: dayjs.Dayjs;
  investedAt: dayjs.Dayjs;
  note?: string;
};

const TRACKING_TYPE_OPTIONS: { value: AssetTrackingType; label: string }[] = [
  { value: "none", label: "Không track giá" },
  { value: "stock", label: "Cổ phiếu" },
  { value: "gold", label: "Vàng" },
  { value: "fund", label: "Chứng chỉ quỹ" },
  { value: "crypto", label: "Crypto" },
];

function InvestmentListPage(): ReactElement {
  const { t } = useTranslation();
  const {
    investments,
    isLoading,
    createInvestment,
    updateInvestment,
    deleteInvestment,
  } = useInvestments();
  const { categories } = useCategories();
  const currency = useSettingsStore(useShallow((state) => state.currency));
  const { marketOverview } = useMarketData(
    useMemo(
      () =>
        investments.map(
          (investment) =>
            investment.ticker_symbol ?? investment.investment_name,
        ),
      [investments],
    ),
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();

  const handleOpenCreate = useCallback((): void => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      investedAt: dayjs(),
      includeInTotal: true,
      trackingType: "none",
    });
    setIsModalOpen(true);
  }, [form]);

  const handleOpenEdit = useCallback(
    (record: InvestmentWithCategory): void => {
      setEditingId(record.id);
      form.setFieldsValue({
        investmentName: record.investment_name,
        categoryId: record.category_id ?? undefined,
        amount: record.amount,
        targetAmount: record.target_amount ?? undefined,
        includeInTotal: record.include_in_total,
        trackingType: record.tracking_type,
        tickerSymbol: record.ticker_symbol ?? undefined,
        quantity: record.quantity ?? undefined,
        purchaseUnitPrice: record.purchase_unit_price ?? undefined,
        purchaseDate: record.purchase_date
          ? dayjs(record.purchase_date)
          : undefined,
        investedAt: dayjs(record.invested_at),
        note: record.note ?? undefined,
      });
      setIsModalOpen(true);
    },
    [form],
  );

  const handleSubmit = useCallback(async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const payload = {
        investmentName: values.investmentName,
        categoryId: values.categoryId,
        amount: values.amount,
        targetAmount: values.targetAmount ?? null,
        includeInTotal: values.includeInTotal,
        trackingType: values.trackingType,
        tickerSymbol: values.tickerSymbol?.trim() || null,
        quantity: values.quantity ?? null,
        purchaseUnitPrice: values.purchaseUnitPrice ?? null,
        purchaseDate: values.purchaseDate?.format("YYYY-MM-DD") ?? null,
        investedAt: values.investedAt.format("YYYY-MM-DD"),
        note: values.note,
      };

      if (editingId) {
        await updateInvestment(editingId, payload);
      } else {
        await createInvestment(payload);
      }

      message.success(t("investment.saveSuccess"));
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }, [form, editingId, createInvestment, updateInvestment, t]);

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      await deleteInvestment(id);
      message.success(t("investment.deleteSuccess"));
    },
    [deleteInvestment, t],
  );

  const columns = useMemo(
    (): ColumnsType<InvestmentWithCategory> => [
      {
        title: t("investment.name"),
        dataIndex: "investment_name",
        key: "investment_name",
        ellipsis: true,
        sorter: (a, b) => a.investment_name.localeCompare(b.investment_name),
      },
      {
        title: t("investment.category"),
        key: "category",
        width: 160,
        render: (_value: unknown, record: InvestmentWithCategory) => {
          if (!record.category) return "—";
          return (
            <span className={styles.categoryTag}>
              <span>{record.category.icon}</span>
              {record.category.category_name}
            </span>
          );
        },
        filters: categories.map((category) => ({
          text: `${category.icon} ${category.category_name}`,
          value: category.id,
        })),
        onFilter: (value, record) => record.category_id === value,
      },
      {
        title: t("investment.amount"),
        dataIndex: "amount",
        key: "amount",
        width: 160,
        align: "right",
        render: (amount: number) => (
          <span className={styles.amountText}>
            {formatCurrency(amount, currency)}
          </span>
        ),
        sorter: (a, b) => a.amount - b.amount,
        defaultSortOrder: "descend",
      },
      {
        title: t("investment.assetCode"),
        key: "ticker_symbol",
        width: 120,
        render: (_value: unknown, record: InvestmentWithCategory) =>
          record.ticker_symbol ?? "—",
      },
      {
        title: t("investment.quantity"),
        key: "quantity",
        width: 120,
        align: "right",
        render: (_value: unknown, record: InvestmentWithCategory) =>
          record.quantity !== null
            ? record.quantity.toLocaleString("vi-VN")
            : "—",
      },
      {
        title: t("investment.buyPrice"),
        key: "purchase_unit_price",
        width: 160,
        align: "right",
        render: (_value: unknown, record: InvestmentWithCategory) =>
          record.purchase_unit_price !== null
            ? formatCurrency(record.purchase_unit_price, currency)
            : "—",
      },
      {
        title: t("investment.currentPrice"),
        key: "current_price",
        width: 160,
        align: "right",
        render: (_value: unknown, record: InvestmentWithCategory) => {
          const liveUnitPrice = findLiveUnitPrice(
            record.tracking_type,
            record.ticker_symbol,
            record.investment_name,
            marketOverview,
          );
          return liveUnitPrice !== null
            ? formatCurrency(liveUnitPrice, currency)
            : "—";
        },
      },
      {
        title: t("investment.marketValue"),
        key: "market_value",
        width: 160,
        align: "right",
        render: (_value: unknown, record: InvestmentWithCategory) => {
          const liveUnitPrice = findLiveUnitPrice(
            record.tracking_type,
            record.ticker_symbol,
            record.investment_name,
            marketOverview,
          );
          if (record.quantity !== null && liveUnitPrice !== null) {
            return formatCurrency(
              Number(record.quantity) * liveUnitPrice,
              currency,
            );
          }
          return "—";
        },
      },
      {
        title: t("investment.profitLoss"),
        key: "profit_loss",
        width: 160,
        align: "right",
        render: (_value: unknown, record: InvestmentWithCategory) => {
          const liveUnitPrice = findLiveUnitPrice(
            record.tracking_type,
            record.ticker_symbol,
            record.investment_name,
            marketOverview,
          );
          if (
            record.quantity !== null &&
            liveUnitPrice !== null &&
            record.purchase_unit_price !== null
          ) {
            const profitLoss =
              Number(record.quantity) *
              (liveUnitPrice - record.purchase_unit_price);
            return (
              <span
                className={
                  profitLoss >= 0 ? styles.profitText : styles.lossText
                }
              >
                {formatCurrency(profitLoss, currency)}
              </span>
            );
          }
          return "—";
        },
      },
      {
        title: t("investment.target"),
        dataIndex: "target_amount",
        key: "target_amount",
        width: 160,
        align: "right",
        render: (targetAmount: number | null) =>
          targetAmount ? formatCurrency(targetAmount, currency) : "—",
        sorter: (a, b) => (a.target_amount ?? 0) - (b.target_amount ?? 0),
      },
      {
        title: t("investment.date"),
        dataIndex: "invested_at",
        key: "invested_at",
        width: 120,
        render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
        sorter: (a, b) =>
          dayjs(a.invested_at).unix() - dayjs(b.invested_at).unix(),
      },
      {
        title: t("investment.note"),
        dataIndex: "note",
        key: "note",
        ellipsis: true,
        width: 200,
        render: (note: string | null) => note ?? "—",
      },
      {
        title: t("investment.totalTracking"),
        dataIndex: "include_in_total",
        key: "include_in_total",
        width: 150,
        render: (includeInTotal: boolean) =>
          includeInTotal
            ? t("investment.countInTotal")
            : t("investment.excludeFromTotal"),
        filters: [
          { text: t("investment.countInTotal"), value: "included" },
          { text: t("investment.excludeFromTotal"), value: "excluded" },
        ],
        onFilter: (value, record) =>
          value === "included"
            ? record.include_in_total
            : !record.include_in_total,
      },
      {
        title: t("investment.actions"),
        key: "actions",
        width: 100,
        align: "center",
        render: (_value: unknown, record: InvestmentWithCategory) => (
          <Space className={styles.actionButtons}>
            <Button
              type="text"
              icon={<EditOutlined />}
              className={styles.editBtn}
              onClick={() => handleOpenEdit(record)}
              size="small"
            />
            <Popconfirm
              title={t("investment.confirmDelete")}
              onConfirm={() => handleDelete(record.id)}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                className={styles.deleteBtn}
                size="small"
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [t, currency, categories, handleOpenEdit, handleDelete, marketOverview],
  );

  const isEditMode = editingId !== null;

  return (
    <div>
      <div className={styles.investmentHeader}>
        <h1 className={styles.investmentTitle}>{t("investment.title")}</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          className={styles.addButton}
        >
          {t("investment.add")}
        </Button>
      </div>

      <div className={`glass-card ${styles.tableCard}`}>
        <div className={styles.desktopTable}>
          <Table
            columns={columns}
            dataSource={investments}
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 800 }}
            locale={{ emptyText: t("common.noData") }}
          />
        </div>

        <div className={styles.mobileCardList}>
          {investments.map((record) => (
            <div key={record.id} className={styles.mobileCard}>
              <div className={styles.mobileCardHeader}>
                <span className={styles.mobileCardName}>
                  {record.investment_name}
                </span>
                <span className={styles.mobileCardAmount}>
                  {formatCurrency(record.amount, currency)}
                </span>
              </div>
              <div className={styles.mobileCardMeta}>
                {record.category && (
                  <span className={styles.mobileCardCategory}>
                    {record.category.icon} {record.category.category_name}
                  </span>
                )}
                <span className={styles.mobileCardDate}>
                  {dayjs(record.invested_at).format("DD/MM/YYYY")}
                </span>
              </div>
              <div className={styles.mobileCardMeta}>
                <span className={styles.mobileCardDate}>
                  {t("investment.assetCode")}: {record.ticker_symbol ?? "—"}
                </span>
                <span className={styles.mobileCardDate}>
                  {t("investment.quantity")}:{" "}
                  {record.quantity?.toLocaleString("vi-VN") ?? "—"}
                </span>
              </div>
              <div className={styles.mobileCardMeta}>
                <span className={styles.mobileCardDate}>
                  {t("investment.buyPrice")}:{" "}
                  {record.purchase_unit_price
                    ? formatCurrency(record.purchase_unit_price, currency)
                    : "—"}
                </span>
                <span className={styles.mobileCardDate}>
                  {t("investment.currentPrice")}:{" "}
                  {(() => {
                    const liveUnitPrice = findLiveUnitPrice(
                      record.tracking_type,
                      record.ticker_symbol,
                      record.investment_name,
                      marketOverview,
                    );
                    return liveUnitPrice !== null
                      ? formatCurrency(liveUnitPrice, currency)
                      : "—";
                  })()}
                </span>
                <span className={styles.mobileCardDate}>
                  {t("investment.target")}:{" "}
                  {record.target_amount
                    ? formatCurrency(record.target_amount, currency)
                    : "—"}
                </span>
                <span className={styles.mobileCardDate}>
                  {record.include_in_total
                    ? t("investment.countInTotal")
                    : t("investment.excludeFromTotal")}
                </span>
              </div>
              {record.note && (
                <div className={styles.mobileCardNote}>{record.note}</div>
              )}
              <div className={styles.mobileCardActions}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  className={styles.editBtn}
                  onClick={() => handleOpenEdit(record)}
                  size="small"
                />
                <Popconfirm
                  title={t("investment.confirmDelete")}
                  onConfirm={() => handleDelete(record.id)}
                  okText={t("common.confirm")}
                  cancelText={t("common.cancel")}
                >
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    className={styles.deleteBtn}
                    size="small"
                  />
                </Popconfirm>
              </div>
            </div>
          ))}
          {investments.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px",
                color: "var(--text-muted)",
              }}
            >
              {t("common.noData")}
            </div>
          )}
        </div>
      </div>

      <Modal
        title={isEditMode ? t("investment.edit") : t("investment.add")}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        className={styles.formModal}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="investmentName"
            label={t("investment.name")}
            rules={[{ required: true }]}
          >
            <Input placeholder={t("investment.placeholder.name")} />
          </Form.Item>

          <Form.Item
            name="categoryId"
            label={t("investment.category")}
            rules={[{ required: true }]}
          >
            <Select placeholder={t("investment.category")}>
              {categories.map((category) => (
                <Select.Option key={category.id} value={category.id}>
                  <div className={styles.categoryOption}>
                    <span
                      className={styles.categoryColorDot}
                      style={{ backgroundColor: category.color }}
                    />
                    <span>{category.icon}</span>
                    <span>{category.category_name}</span>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label={t("investment.amount")}
            rules={[{ required: true }]}
          >
            <InputNumber
              placeholder={t("investment.placeholder.amount")}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                parseFloat(value?.replace(/,/g, "") ?? "0") as 0
              }
              min={0}
              style={{ width: "100%" }}
              addonAfter={currency}
            />
          </Form.Item>

          <Form.Item name="trackingType" label={t("investment.trackingType")}>
            <Select>
              {TRACKING_TYPE_OPTIONS.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(previousValues, currentValues) =>
              previousValues.trackingType !== currentValues.trackingType
            }
          >
            {({ getFieldValue }) => {
              const trackingType = getFieldValue(
                "trackingType",
              ) as AssetTrackingType;
              const shouldShowTrackingFields = trackingType !== "none";

              if (!shouldShowTrackingFields) return null;

              return (
                <>
                  <Form.Item
                    name="tickerSymbol"
                    label={t("investment.assetCode")}
                    rules={[
                      {
                        required: true,
                        message: t("investment.assetCodeRequired"),
                      },
                    ]}
                  >
                    <Input
                      placeholder={t("investment.placeholder.assetCode")}
                    />
                  </Form.Item>

                  <Form.Item
                    name="quantity"
                    label={t("investment.quantity")}
                    rules={[
                      {
                        required: true,
                        message: t("investment.quantityRequired"),
                      },
                    ]}
                  >
                    <InputNumber
                      placeholder={t("investment.placeholder.quantity")}
                      min={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="purchaseUnitPrice"
                    label={t("investment.buyPrice")}
                    rules={[
                      {
                        required: true,
                        message: t("investment.buyPriceRequired"),
                      },
                    ]}
                  >
                    <InputNumber
                      placeholder={t("investment.placeholder.buyPrice")}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) =>
                        parseFloat(value?.replace(/,/g, "") ?? "0") as 0
                      }
                      min={0}
                      style={{ width: "100%" }}
                      addonAfter={currency}
                    />
                  </Form.Item>

                  <Form.Item
                    name="purchaseDate"
                    label={t("investment.buyDate")}
                  >
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>

          <Form.Item name="targetAmount" label={t("investment.target")}>
            <InputNumber
              placeholder={t("investment.placeholder.target")}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                parseFloat(value?.replace(/,/g, "") ?? "0") as 0
              }
              min={0}
              style={{ width: "100%" }}
              addonAfter={currency}
            />
          </Form.Item>

          <Form.Item
            name="includeInTotal"
            label={t("investment.totalTracking")}
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value>
                {t("investment.countInTotal")}
              </Select.Option>
              <Select.Option value={false}>
                {t("investment.excludeFromTotal")}
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="investedAt"
            label={t("investment.date")}
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="note" label={t("investment.note")}>
            <Input.TextArea
              placeholder={t("investment.placeholder.note")}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InvestmentListPage;
