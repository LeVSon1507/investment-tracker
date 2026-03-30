import { type ReactElement, useState, useMemo, useCallback } from 'react';
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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { useInvestments } from '../../hooks/useInvestments';
import { useCategories } from '../../hooks/useCategories';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { InvestmentWithCategory } from '../../types/investment';
import styles from './Investment.module.css';

type FormValues = {
  investmentName: string;
  categoryId: string;
  amount: number;
  investedAt: dayjs.Dayjs;
  note?: string;
};

function InvestmentListPage(): ReactElement {
  const { t } = useTranslation();
  const { investments, isLoading, createInvestment, updateInvestment, deleteInvestment } =
    useInvestments();
  const { categories } = useCategories();
  const currency = useSettingsStore(useShallow((state) => state.currency));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();

  const handleOpenCreate = useCallback((): void => {
    setEditingId(null);
    form.resetFields();
    form.setFieldValue('investedAt', dayjs());
    setIsModalOpen(true);
  }, [form]);

  const handleOpenEdit = useCallback(
    (record: InvestmentWithCategory): void => {
      setEditingId(record.id);
      form.setFieldsValue({
        investmentName: record.investment_name,
        categoryId: record.category_id ?? undefined,
        amount: record.amount,
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
        investedAt: values.investedAt.format('YYYY-MM-DD'),
        note: values.note,
      };

      if (editingId) {
        await updateInvestment(editingId, payload);
      } else {
        await createInvestment(payload);
      }

      message.success(t('investment.saveSuccess'));
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
      message.success(t('investment.deleteSuccess'));
    },
    [deleteInvestment, t],
  );

  const columns = useMemo(
    (): ColumnsType<InvestmentWithCategory> => [
      {
        title: t('investment.name'),
        dataIndex: 'investment_name',
        key: 'investment_name',
        ellipsis: true,
        sorter: (a, b) => a.investment_name.localeCompare(b.investment_name),
      },
      {
        title: t('investment.category'),
        key: 'category',
        width: 160,
        render: (_value: unknown, record: InvestmentWithCategory) => {
          if (!record.category) return '—';
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
        title: t('investment.amount'),
        dataIndex: 'amount',
        key: 'amount',
        width: 160,
        align: 'right',
        render: (amount: number) => (
          <span className={styles.amountText}>{formatCurrency(amount, currency)}</span>
        ),
        sorter: (a, b) => a.amount - b.amount,
        defaultSortOrder: 'descend',
      },
      {
        title: t('investment.date'),
        dataIndex: 'invested_at',
        key: 'invested_at',
        width: 120,
        render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
        sorter: (a, b) =>
          dayjs(a.invested_at).unix() - dayjs(b.invested_at).unix(),
      },
      {
        title: t('investment.note'),
        dataIndex: 'note',
        key: 'note',
        ellipsis: true,
        width: 200,
        render: (note: string | null) => note ?? '—',
      },
      {
        title: t('investment.actions'),
        key: 'actions',
        width: 100,
        align: 'center',
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
              title={t('investment.confirmDelete')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
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
    [t, currency, categories, handleOpenEdit, handleDelete],
  );

  const isEditMode = editingId !== null;

  return (
    <div>
      <div className={styles.investmentHeader}>
        <h1 className={styles.investmentTitle}>{t('investment.title')}</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          className={styles.addButton}
        >
          {t('investment.add')}
        </Button>
      </div>

      <div className={`glass-card ${styles.tableCard}`}>
        <Table
          columns={columns}
          dataSource={investments}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ x: 800 }}
          locale={{ emptyText: t('common.noData') }}
        />
      </div>

      <Modal
        title={isEditMode ? t('investment.edit') : t('investment.add')}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        className={styles.formModal}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="investmentName"
            label={t('investment.name')}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('investment.placeholder.name')} />
          </Form.Item>

          <Form.Item
            name="categoryId"
            label={t('investment.category')}
            rules={[{ required: true }]}
          >
            <Select placeholder={t('investment.category')}>
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
            label={t('investment.amount')}
            rules={[{ required: true }]}
          >
            <InputNumber
              placeholder={t('investment.placeholder.amount')}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              }
              parser={(value) => parseFloat(value?.replace(/,/g, '') ?? '0') as 0}
              min={0}
              style={{ width: '100%' }}
              addonAfter={currency}
            />
          </Form.Item>

          <Form.Item
            name="investedAt"
            label={t('investment.date')}
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="note" label={t('investment.note')}>
            <Input.TextArea
              placeholder={t('investment.placeholder.note')}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InvestmentListPage;
