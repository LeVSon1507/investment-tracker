import { type ReactElement, useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, message } from 'antd';
import {
  SendOutlined,
  ClearOutlined,
  CheckCircleFilled,
  SettingOutlined,
  SwapOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import i18n from '../../i18n';

import { useAiParser } from '../../hooks/useAiParser';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { useInvestments } from '../../hooks/useInvestments';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ChatAttachment, ChatMessage, ParsedInvestmentResult, InvestmentCategory, InvestmentWithCategory } from '../../types/investment';
import styles from './Chat.module.css';

function findCategoryByName(
  categoryList: InvestmentCategory[],
  categoryName: string | undefined,
): InvestmentCategory | undefined {
  if (!categoryName) return undefined;
  return categoryList.find(
    (category) => category.category_name.toLowerCase() === categoryName.toLowerCase(),
  );
}

function findInvestmentByName(
  investmentList: InvestmentWithCategory[],
  investmentName: string,
): InvestmentWithCategory | undefined {
  return investmentList.find(
    (item) =>
      item.investment_name.toLowerCase() === investmentName.toLowerCase() ||
      item.investment_name.toLowerCase().includes(investmentName.toLowerCase()) ||
      investmentName.toLowerCase().includes(item.investment_name.toLowerCase()),
  );
}

async function fileToAttachment(file: File): Promise<ChatAttachment> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Không thể đọc file ảnh'));
        return;
      }
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    mimeType: file.type || 'image/jpeg',
    base64Data,
  };
}

function ChatPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    messages,
    isParsing,
    sendMessage,
    confirmParsedInvestments,
    clearMessages,
    categoryUpdates,
    investmentUpdates,
    settingsUpdate,
    clearCategoryUpdates,
    clearInvestmentUpdates,
    clearSettingsUpdate,
  } = useAiParser(user?.id ?? 'anonymous');
  const {
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: refetchCategories,
  } = useCategories();
  const {
    createInvestment,
    investments,
    updateInvestment,
    deleteInvestment,
  } = useInvestments();
  const {
    currency,
    salaryDay,
    language,
    geminiModel,
    setSalaryDay,
    setCurrency,
    setLanguage,
    setGeminiModel,
    setGeminiApiKey,
  } = useSettingsStore(
    useShallow((state) => ({
      currency: state.currency,
      salaryDay: state.salaryDay,
      language: state.language,
      geminiModel: state.geminiModel,
      setSalaryDay: state.setSalaryDay,
      setCurrency: state.setCurrency,
      setLanguage: state.setLanguage,
      setGeminiModel: state.setGeminiModel,
      setGeminiApiKey: state.setGeminiApiKey,
    })),
  );
  const getEffectiveApiKey = useSettingsStore((state) => state.getEffectiveApiKey);

  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [isApplyingCategoryUpdate, setIsApplyingCategoryUpdate] = useState(false);
  const [isApplyingInvestmentUpdate, setIsApplyingInvestmentUpdate] = useState(false);
  const [isApplyingSettingsUpdate, setIsApplyingSettingsUpdate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasApiKey = getEffectiveApiKey().length > 0;
  const categoryNames = categories.map((category) => category.category_name);
  const investmentNames = investments.map((investment) => investment.investment_name);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isParsing]);

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmedText = inputText.trim();
    if ((!trimmedText && !attachment) || isParsing) return;

    setInputText('');
    await sendMessage(trimmedText || 'Đọc giúp ảnh đính kèm và trích xuất dữ liệu đầu tư.', {
      existingCategories: categoryNames,
      existingInvestments: investmentNames,
      settings: {
        salaryDay,
        currency,
        language,
        geminiModel,
      },
      account: {
        userId: user?.id ?? 'anonymous',
        label: user?.email ?? user?.user_metadata?.full_name ?? 'Unknown account',
      },
    }, attachment);
    setAttachment(null);
  }, [inputText, attachment, isParsing, sendMessage, categoryNames, investmentNames, salaryDay, currency, language, geminiModel, user]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleConfirmSave = useCallback(
    async (chatMessageItem: ChatMessage): Promise<void> => {
      if (!chatMessageItem.parsedInvestments || chatMessageItem.isConfirmed) return;
      if (savingMessageId === chatMessageItem.id) return;

      setSavingMessageId(chatMessageItem.id);

      try {
        for (const parsed of chatMessageItem.parsedInvestments) {
          const matchedCategory = categories.find(
            (category) =>
              category.category_name.toLowerCase() === parsed.categoryName.toLowerCase(),
          );

          if (!matchedCategory) continue;

          await createInvestment({
            investmentName: parsed.investmentName,
            categoryId: matchedCategory.id,
            amount: parsed.amount,
            trackingType: parsed.trackingType ?? 'none',
            tickerSymbol: parsed.tickerSymbol ?? null,
            quantity: parsed.quantity ?? null,
            purchaseUnitPrice: parsed.purchaseUnitPrice ?? null,
            purchaseDate: parsed.purchaseDate ?? null,
            note: parsed.note,
          });
        }

        confirmParsedInvestments(chatMessageItem.id);
        message.success(t('chat.saved'));
      } catch (error) {
        if (error instanceof Error) {
          message.error(error.message);
        }
      } finally {
        setSavingMessageId(null);
      }
    },
    [categories, createInvestment, confirmParsedInvestments, t, savingMessageId],
  );

  const handleApplyCategoryUpdates = useCallback(async (): Promise<void> => {
    if (!categoryUpdates || isApplyingCategoryUpdate) return;

    setIsApplyingCategoryUpdate(true);

    try {
      for (const categoryUpdate of categoryUpdates) {
        if (categoryUpdate.type === 'create' && categoryUpdate.categoryName) {
          const existingCategory = findCategoryByName(categories, categoryUpdate.categoryName);
          if (!existingCategory) {
            await createCategory({
              categoryName: categoryUpdate.categoryName,
              icon: categoryUpdate.icon ?? '📂',
              color: categoryUpdate.color ?? '#6366f1',
              targetAmount: categoryUpdate.targetAmount ?? null,
            });
          }
          continue;
        }

        if (categoryUpdate.type === 'delete' && categoryUpdate.categoryName) {
          const targetCategory = findCategoryByName(categories, categoryUpdate.categoryName);
          if (targetCategory) {
            await deleteCategory(targetCategory.id);
          }
          continue;
        }

        if ((categoryUpdate.type === 'rename' || categoryUpdate.type === 'update')) {
          const targetCategory = findCategoryByName(
            categories,
            categoryUpdate.categoryName ?? categoryUpdate.fromCategory,
          );
          if (targetCategory) {
            await updateCategory(targetCategory.id, {
              categoryName: categoryUpdate.newCategoryName ?? categoryUpdate.toCategory,
              icon: categoryUpdate.icon,
              color: categoryUpdate.color,
              targetAmount: categoryUpdate.targetAmount,
            });
          }
          continue;
        }

        if (categoryUpdate.type === 'reassign' && categoryUpdate.investmentNames) {
          const targetCategory = findCategoryByName(categories, categoryUpdate.toCategory);
          if (!targetCategory) continue;

          for (const investmentName of categoryUpdate.investmentNames) {
            const matchingInvestment = findInvestmentByName(investments, investmentName);
            if (matchingInvestment) {
              await updateInvestment(matchingInvestment.id, {
                categoryId: targetCategory.id,
              });
            }
          }
        }
      }

      await refetchCategories();
      clearCategoryUpdates();
      message.success('Đã cập nhật danh mục thành công!');
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setIsApplyingCategoryUpdate(false);
    }
  }, [
    categoryUpdates,
    categories,
    investments,
    updateInvestment,
    refetchCategories,
    clearCategoryUpdates,
    isApplyingCategoryUpdate,
    createCategory,
    deleteCategory,
    updateCategory,
  ]);

  const handleApplyInvestmentUpdates = useCallback(async (): Promise<void> => {
    if (!investmentUpdates || isApplyingInvestmentUpdate) return;

    setIsApplyingInvestmentUpdate(true);

    try {
      for (const investmentUpdate of investmentUpdates) {
        if (investmentUpdate.type === 'create') {
          const targetCategory = findCategoryByName(categories, investmentUpdate.categoryName);
          if (!targetCategory || investmentUpdate.amount === undefined) continue;

          await createInvestment({
            investmentName: investmentUpdate.investmentName,
            categoryId: targetCategory.id,
            amount: investmentUpdate.amount,
            targetAmount: investmentUpdate.targetAmount ?? null,
            includeInTotal: investmentUpdate.includeInTotal ?? true,
            trackingType: investmentUpdate.trackingType ?? 'none',
            tickerSymbol: investmentUpdate.tickerSymbol ?? null,
            quantity: investmentUpdate.quantity ?? null,
            purchaseUnitPrice: investmentUpdate.purchaseUnitPrice ?? null,
            purchaseDate: investmentUpdate.purchaseDate ?? null,
            note: investmentUpdate.note,
          });
          continue;
        }

        const existingInvestment = findInvestmentByName(investments, investmentUpdate.investmentName);
        if (!existingInvestment) continue;

        if (investmentUpdate.type === 'delete') {
          await deleteInvestment(existingInvestment.id);
          continue;
        }

        const targetCategory = findCategoryByName(categories, investmentUpdate.categoryName);
        await updateInvestment(existingInvestment.id, {
          investmentName: investmentUpdate.newInvestmentName,
          categoryId: targetCategory?.id,
          amount: investmentUpdate.amount,
          targetAmount: investmentUpdate.targetAmount,
          includeInTotal: investmentUpdate.includeInTotal,
          trackingType: investmentUpdate.trackingType,
          tickerSymbol: investmentUpdate.tickerSymbol,
          quantity: investmentUpdate.quantity,
          purchaseUnitPrice: investmentUpdate.purchaseUnitPrice,
          purchaseDate: investmentUpdate.purchaseDate,
          note: investmentUpdate.note,
        });
      }

      clearInvestmentUpdates();
      message.success('Đã cập nhật khoản đầu tư thành công!');
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setIsApplyingInvestmentUpdate(false);
    }
  }, [
    categories,
    clearInvestmentUpdates,
    createInvestment,
    deleteInvestment,
    investmentUpdates,
    investments,
    isApplyingInvestmentUpdate,
    updateInvestment,
  ]);

  const handleApplySettingsUpdate = useCallback(async (): Promise<void> => {
    if (!settingsUpdate || isApplyingSettingsUpdate) return;

    setIsApplyingSettingsUpdate(true);

    try {
      if (settingsUpdate.salaryDay !== undefined) {
        setSalaryDay(settingsUpdate.salaryDay);
      }
      if (settingsUpdate.currency !== undefined) {
        setCurrency(settingsUpdate.currency);
      }
      if (settingsUpdate.language !== undefined) {
        setLanguage(settingsUpdate.language);
        i18n.changeLanguage(settingsUpdate.language);
      }
      if (settingsUpdate.geminiModel !== undefined) {
        setGeminiModel(settingsUpdate.geminiModel);
      }
      if (settingsUpdate.geminiApiKey !== undefined) {
        setGeminiApiKey(settingsUpdate.geminiApiKey);
      }

      clearSettingsUpdate();
      message.success('Đã cập nhật cài đặt thành công!');
    } finally {
      setIsApplyingSettingsUpdate(false);
    }
  }, [
    clearSettingsUpdate,
    isApplyingSettingsUpdate,
    setCurrency,
    setGeminiApiKey,
    setGeminiModel,
    setLanguage,
    setSalaryDay,
    settingsUpdate,
  ]);

  const hasMessages = messages.length > 0;
  const accountLabel = user?.email ?? user?.user_metadata?.full_name ?? 'Unknown account';

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <h1 className={styles.chatTitle}>{t('chat.title')}</h1>
        {hasMessages && (
          <Button icon={<ClearOutlined />} onClick={clearMessages} size="small">
            Clear
          </Button>
        )}
      </div>

      <div className={styles.accountBanner}>
        <span>Account hiện tại: <strong>{accountLabel}</strong></span>
        <span>AI chỉ dùng dữ liệu danh mục và đầu tư của account này.</span>
      </div>

      {!hasApiKey && (
        <div className={styles.noApiKeyBanner}>
          <span className={styles.noApiKeyText}>{t('chat.noApiKey')}</span>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => navigate('/settings')}
          >
            {t('nav.settings')}
          </Button>
        </div>
      )}

      {/* Category update banner */}
      {categoryUpdates && categoryUpdates.length > 0 && (
        <div className={styles.categoryUpdateBanner}>
          <span>
            🔄 AI đã chuẩn bị {categoryUpdates.length} thay đổi cho danh mục và phân loại
          </span>
          <Button
            type="primary"
            size="small"
            icon={<SwapOutlined />}
            onClick={handleApplyCategoryUpdates}
            loading={isApplyingCategoryUpdate}
          >
            Áp dụng
          </Button>
        </div>
      )}

      {investmentUpdates && investmentUpdates.length > 0 && (
        <div className={styles.categoryUpdateBanner}>
          <span>🧾 AI đã chuẩn bị {investmentUpdates.length} thay đổi cho khoản đầu tư</span>
          <Button
            type="primary"
            size="small"
            icon={<SwapOutlined />}
            onClick={handleApplyInvestmentUpdates}
            loading={isApplyingInvestmentUpdate}
          >
            Áp dụng
          </Button>
        </div>
      )}

      {settingsUpdate && (
        <div className={styles.categoryUpdateBanner}>
          <span>⚙️ AI đã chuẩn bị cập nhật cài đặt trong app</span>
          <Button
            type="primary"
            size="small"
            icon={<SwapOutlined />}
            onClick={handleApplySettingsUpdate}
            loading={isApplyingSettingsUpdate}
          >
            Áp dụng
          </Button>
        </div>
      )}

      <div className={styles.chatMessages}>
        {!hasMessages && (
          <div className={styles.welcomeMessage}>
            <div className={styles.welcomeIcon}>🤖</div>
            <p className={styles.welcomeText}>{t('chat.welcome')}</p>
            <p className={styles.exampleHint}>{t('chat.example')}</p>
            <p className={styles.exampleHint}>{t('chat.trackingPrompt')}</p>
          </div>
        )}

        {messages.map((chatMessageItem) => (
          <MessageBubble
            key={chatMessageItem.id}
            chatMessage={chatMessageItem}
            onConfirm={handleConfirmSave}
            currency={currency}
            isSaving={savingMessageId === chatMessageItem.id}
          />
        ))}

        {isParsing && (
          <div className={styles.messageRowAssistant}>
            <div className={styles.messageBubbleAssistant}>
              <div className={styles.typingIndicator}>
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatInputArea}>
        <input
          id="chat-attachment-input"
          type="file"
          accept="image/*"
          className={styles.hiddenFileInput}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              setAttachment(await fileToAttachment(file));
            } catch (error) {
              message.error(error instanceof Error ? error.message : 'Không thể đọc file ảnh');
            } finally {
              event.target.value = '';
            }
          }}
        />
        <Button
          icon={<PaperClipOutlined />}
          onClick={() => document.getElementById('chat-attachment-input')?.click()}
          className={styles.attachButton}
          title="Đính kèm ảnh"
        />
        <Input.TextArea
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          autoSize={{ minRows: 2, maxRows: 4 }}
          className={styles.chatInput}
          disabled={!hasApiKey || isParsing}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={isParsing}
          disabled={!hasApiKey || (!inputText.trim() && !attachment)}
          className={styles.sendButton}
        />
      </div>
      {attachment && (
        <div className={styles.attachmentBadge}>
          <span>Ảnh đính kèm: {attachment.name}</span>
          <Button size="small" type="text" onClick={() => setAttachment(null)}>Bỏ</Button>
        </div>
      )}
    </div>
  );
}

type MessageBubbleProps = {
  readonly chatMessage: ChatMessage;
  readonly onConfirm: (message: ChatMessage) => void;
  readonly currency: 'VND' | 'USD';
  readonly isSaving: boolean;
};

function MessageBubble({ chatMessage, onConfirm, currency, isSaving }: MessageBubbleProps): ReactElement {
  const { t } = useTranslation();
  const isUser = chatMessage.role === 'user';

  if (isUser) {
    return (
      <div className={styles.messageRowUser}>
        <div className={styles.messageBubbleUser}>
          <div>{chatMessage.content}</div>
          {chatMessage.attachmentName && (
            <div className={styles.attachmentHint}>Ảnh: {chatMessage.attachmentName}</div>
          )}
        </div>
      </div>
    );
  }

  const hasParsedData =
    chatMessage.parsedInvestments && chatMessage.parsedInvestments.length > 0;
  const isNoResult = chatMessage.content === 'ai_no_results';
  const isFoundInvestments = chatMessage.content === 'ai_found_investments';
  const isGeneralMessage = !isNoResult && !isFoundInvestments;

  return (
    <div className={styles.messageRowAssistant}>
      <div className={styles.messageBubbleAssistant}>
        {isFoundInvestments && <p>{t('chat.aiResponse')}</p>}
        {isNoResult && <p>{t('chat.noResult')}</p>}
        {isGeneralMessage && <p>{chatMessage.content}</p>}

        {hasParsedData && (
          <div className={styles.parsedPreview}>
            {chatMessage.parsedInvestments!.map(
              (parsed: ParsedInvestmentResult, index: number) => (
                <div key={`${parsed.investmentName}-${index}`} className={styles.parsedItem}>
                  <div>
                    <div className={styles.parsedItemName}>{parsed.investmentName}</div>
                    <div className={styles.parsedItemCategory}>{parsed.categoryName}</div>
                    {(parsed.tickerSymbol || parsed.quantity || parsed.purchaseUnitPrice) && (
                      <div className={styles.parsedItemCategory}>
                        {[parsed.tickerSymbol, parsed.quantity, parsed.purchaseUnitPrice]
                          .filter((value) => value !== undefined)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className={styles.parsedItemAmount}>
                    {formatCurrency(parsed.amount, currency)}
                  </div>
                </div>
              ),
            )}

            {chatMessage.isConfirmed ? (
              <div className={styles.confirmedBadge}>
                <CheckCircleFilled /> {t('chat.saved')}
              </div>
            ) : (
              <div className={styles.parsedActions}>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onConfirm(chatMessage)}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  {t('chat.confirm')}
                </Button>
                <Button size="small" disabled={isSaving}>{t('chat.cancel')}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
