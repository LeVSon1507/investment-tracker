import { type ReactElement, useState, useCallback } from 'react';
import {
  Form, Input, InputNumber, Select, Button, message, Space, Modal,
} from 'antd';
import {
  RobotOutlined, CalendarOutlined, GlobalOutlined, DeleteOutlined, PlusOutlined,
  KeyOutlined, CheckCircleFilled, LockOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import i18n from '../../i18n';
import { useSettingsStore, verifyFallbackPassword, hasEnvFallbackKey } from '../../stores/settingsStore';
import { useCategories, DEFAULT_CATEGORIES } from '../../hooks/useCategories';
import { formatCompactCurrency } from '../../utils/formatCurrency';
import { validateApiKey } from '../../lib/gemini';
import type { Currency, Language } from '../../types/investment';
import styles from './Settings.module.css';

type CategoryFormValues = {
  categoryName: string;
  icon: string;
  color: string;
  targetAmount?: number;
};

function SettingsPage(): ReactElement {
  const { t } = useTranslation();
  const settings = useSettingsStore(
    useShallow((state) => ({
      geminiApiKey: state.geminiApiKey,
      geminiModel: state.geminiModel,
      salaryDay: state.salaryDay,
      currency: state.currency,
      language: state.language,
      isFallbackUnlocked: state.isFallbackUnlocked,
    })),
  );
  const { setGeminiApiKey, setGeminiModel, setSalaryDay, setCurrency, setLanguage, setFallbackUnlocked, getEffectiveApiKey } =
    useSettingsStore();

  const { categories, createCategory, deleteCategory } = useCategories();
  const [isValidating, setIsValidating] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm] = Form.useForm<CategoryFormValues>();
  const [fallbackPassword, setFallbackPassword] = useState('');

  const [localApiKey, setLocalApiKey] = useState(settings.geminiApiKey);
  const [localModel, setLocalModel] = useState(settings.geminiModel);
  const [localSalaryDay, setLocalSalaryDay] = useState(settings.salaryDay);

  const isEnvKeyAvailable = hasEnvFallbackKey();
  const isUsingFallback = settings.geminiApiKey.length === 0 && settings.isFallbackUnlocked && isEnvKeyAvailable;

  const handleSaveGeneral = useCallback((): void => {
    setGeminiApiKey(localApiKey);
    setGeminiModel(localModel);
    setSalaryDay(localSalaryDay);
    message.success(t('settings.saved'));
  }, [localApiKey, localModel, localSalaryDay, setGeminiApiKey, setGeminiModel, setSalaryDay, t]);

  const handleValidateKey = useCallback(async (): Promise<void> => {
    setIsValidating(true);
    const effectiveKey = localApiKey || getEffectiveApiKey();
    const isValid = await validateApiKey(effectiveKey, localModel);
    if (isValid) {
      message.success('API Key hợp lệ! ✅');
    } else {
      message.error('API Key không hợp lệ hoặc model không khả dụng');
    }
    setIsValidating(false);
  }, [localApiKey, localModel, getEffectiveApiKey]);

  const handleUnlockFallback = useCallback((): void => {
    if (verifyFallbackPassword(fallbackPassword)) {
      setFallbackUnlocked(true);
      setFallbackPassword('');
      message.success('🔓 Đã mở khóa API Key mặc định!');
    } else {
      message.error('Sai mật khẩu!');
    }
  }, [fallbackPassword, setFallbackUnlocked]);

  const handleLockFallback = useCallback((): void => {
    setFallbackUnlocked(false);
    message.info('🔒 Đã khóa API Key mặc định');
  }, [setFallbackUnlocked]);

  const handleCurrencyChange = useCallback(
    (value: Currency): void => {
      setCurrency(value);
    },
    [setCurrency],
  );

  const handleLanguageChange = useCallback(
    (value: Language): void => {
      setLanguage(value);
      i18n.changeLanguage(value);
    },
    [setLanguage],
  );

  const handleAddCategory = useCallback(async (): Promise<void> => {
    try {
      const values = await categoryForm.validateFields();
      await createCategory({
        categoryName: values.categoryName,
        icon: values.icon,
        color: values.color,
        targetAmount: values.targetAmount ?? null,
      });
      setIsCategoryModalOpen(false);
      categoryForm.resetFields();
      message.success(t('common.success'));
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    }
  }, [categoryForm, createCategory, t]);

  const handleInitDefaults = useCallback(async (): Promise<void> => {
    for (const defaultCategory of DEFAULT_CATEGORIES) {
      const isExisting = categories.some(
        (c) => c.category_name === defaultCategory.categoryName,
      );
      if (!isExisting) {
        await createCategory({ ...defaultCategory, targetAmount: null });
      }
    }
    message.success(t('common.success'));
  }, [categories, createCategory, t]);

  return (
    <div className={styles.settingsContainer}>
      <h1 className={styles.settingsTitle}>{t('settings.title')}</h1>

      {/* AI Section */}
      <div className={`glass-card ${styles.settingsCard}`}>
        <div className={styles.settingsCardTitle}>
          <RobotOutlined /> {t('settings.geminiApiKey')}
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Input.Password
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              placeholder="AIza..."
              className={styles.apiKeyInput}
            />
            <div className={styles.fieldHint}>{t('settings.geminiApiKeyHint')}</div>
          </div>

          {/* Fallback key unlock section - only show when no custom key and env key exists */}
          {isEnvKeyAvailable && localApiKey.length === 0 && (
            <div className={styles.fallbackSection}>
              {isUsingFallback ? (
                <div className={styles.fallbackActive}>
                  <span className={styles.fallbackActiveText}>
                    <CheckCircleFilled style={{ color: '#52c41a' }} /> Đang dùng API Key mặc định
                  </span>
                  <Button
                    size="small"
                    icon={<LockOutlined />}
                    onClick={handleLockFallback}
                    danger
                  >
                    Khóa
                  </Button>
                </div>
              ) : (
                <div className={styles.fallbackUnlock}>
                  <div className={styles.fallbackLabel}>
                    <KeyOutlined /> Nhập mật khẩu để dùng key mặc định
                  </div>
                  <Space>
                    <Input.Password
                      value={fallbackPassword}
                      onChange={(e) => setFallbackPassword(e.target.value)}
                      placeholder="Mật khẩu..."
                      size="small"
                      onPressEnter={handleUnlockFallback}
                      style={{ width: 160 }}
                    />
                    <Button
                      size="small"
                      type="primary"
                      onClick={handleUnlockFallback}
                    >
                      Mở khóa
                    </Button>
                  </Space>
                </div>
              )}
            </div>
          )}

          <div>
            <Select
              value={localModel}
              onChange={setLocalModel}
              style={{ width: '100%' }}
              options={[
                { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (nhanh, miễn phí)' },
                { value: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash (chất lượng cao)' },
                { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro (tốt nhất, tốn token)' },
              ]}
            />
            <div className={styles.fieldHint}>{t('settings.geminiModelHint')}</div>
          </div>
          <Space>
            <Button onClick={handleValidateKey} loading={isValidating}>Kiểm tra Key</Button>
            <Button type="primary" onClick={handleSaveGeneral} className={styles.saveButton}>
              {t('settings.save')}
            </Button>
          </Space>
        </Space>
      </div>

      {/* Salary & Preferences */}
      <div className={`glass-card ${styles.settingsCard}`}>
        <div className={styles.settingsCardTitle}>
          <CalendarOutlined /> {t('settings.salaryDay')}
        </div>
        <InputNumber
          value={localSalaryDay}
          onChange={(v) => setLocalSalaryDay(v ?? 25)}
          min={1}
          max={31}
          style={{ width: 120 }}
        />
        <div className={styles.fieldHint}>{t('settings.salaryDayHint')}</div>
      </div>

      <div className={`glass-card ${styles.settingsCard}`}>
        <div className={styles.settingsCardTitle}>
          <GlobalOutlined /> {t('settings.currency')} & {t('settings.language')}
        </div>
        <Space size="large">
          <Select value={settings.currency} onChange={handleCurrencyChange} style={{ width: 120 }}
            options={[
              { value: 'VND', label: '🇻🇳 VND' },
              { value: 'USD', label: '🇺🇸 USD' },
            ]}
          />
          <Select value={settings.language} onChange={handleLanguageChange} style={{ width: 150 }}
            options={[
              { value: 'vi', label: '🇻🇳 Tiếng Việt' },
              { value: 'en', label: '🇬🇧 English' },
            ]}
          />
        </Space>
      </div>

      {/* Categories */}
      <div className={`glass-card ${styles.settingsCard}`}>
        <div className={styles.settingsCardTitle}>
          📂 {t('category.title')}
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setIsCategoryModalOpen(true)}>
            {t('category.add')}
          </Button>
          {categories.length === 0 && (
            <Button onClick={handleInitDefaults}>Tạo danh mục mặc định</Button>
          )}
        </Space>
        <div className={styles.categoryList}>
          {categories.map((cat) => (
            <div key={cat.id} className={styles.categoryRow}>
              <div className={styles.categoryRowLeft}>
                <span className={styles.categoryColorIndicator} style={{ backgroundColor: cat.color }} />
                <span>{cat.icon}</span>
                <span className={styles.categoryRowName}>{cat.category_name}</span>
                {cat.target_amount && (
                  <span className={styles.categoryRowTarget}>
                    (max: {formatCompactCurrency(cat.target_amount, settings.currency)})
                  </span>
                )}
              </div>
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => deleteCategory(cat.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <Modal
        title={t('category.add')}
        open={isCategoryModalOpen}
        onOk={handleAddCategory}
        onCancel={() => setIsCategoryModalOpen(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Form form={categoryForm} layout="vertical" requiredMark={false}
          initialValues={{ icon: '💰', color: '#6366f1' }}
        >
          <Form.Item name="categoryName" label={t('category.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="icon" label={t('category.icon')} rules={[{ required: true }]}>
            <Input maxLength={4} style={{ width: 80 }} />
          </Form.Item>
          <Form.Item name="color" label={t('category.color')}>
            <Input type="color" style={{ width: 80, height: 36 }} />
          </Form.Item>
          <Form.Item name="targetAmount" label={t('category.targetAmount')}>
            <InputNumber
              placeholder={t('category.targetAmountHint')}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => parseFloat(v?.replace(/,/g, '') ?? '0') as 0}
              min={0}
              style={{ width: '100%' }}
              addonAfter={settings.currency}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SettingsPage;
