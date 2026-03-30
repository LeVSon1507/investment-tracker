import { type ReactElement, useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, message } from 'antd';
import {
  SendOutlined,
  ClearOutlined,
  CheckCircleFilled,
  SettingOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAiParser } from '../../hooks/useAiParser';
import { useCategories } from '../../hooks/useCategories';
import { useInvestments } from '../../hooks/useInvestments';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ChatMessage, ParsedInvestmentResult, InvestmentCategory, InvestmentWithCategory } from '../../types/investment';
import type { CategoryUpdateCommand } from '../../lib/gemini';
import styles from './Chat.module.css';

async function applyCategoryReassignments(
  updates: CategoryUpdateCommand[],
  categoryList: InvestmentCategory[],
  investmentList: InvestmentWithCategory[],
  updateFn: (id: string, payload: { investmentName: string; categoryId: string; amount: number }) => Promise<void>,
): Promise<void> {
  for (const categoryUpdate of updates) {
    if (categoryUpdate.type !== 'reassign' || !categoryUpdate.investmentNames) continue;

    const targetCategory = categoryList.find(
      (category) => category.category_name.toLowerCase() === categoryUpdate.toCategory.toLowerCase(),
    );

    if (!targetCategory) continue;

    for (const investmentName of categoryUpdate.investmentNames) {
      const matchingInvestment = investmentList.find(
        (item) =>
          item.investment_name.toLowerCase().includes(investmentName.toLowerCase()) ||
          investmentName.toLowerCase().includes(item.investment_name.toLowerCase()),
      );

      if (matchingInvestment) {
        await updateFn(matchingInvestment.id, {
          investmentName: matchingInvestment.investment_name,
          categoryId: targetCategory.id,
          amount: matchingInvestment.amount,
        });
      }
    }
  }
}

function ChatPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    messages,
    isParsing,
    sendMessage,
    confirmParsedInvestments,
    clearMessages,
    categoryUpdates,
    clearCategoryUpdates,
  } = useAiParser();
  const { categories, refetch: refetchCategories } = useCategories();
  const { createInvestment, investments, updateInvestment } = useInvestments();
  const currency = useSettingsStore((state) => state.currency);
  const getEffectiveApiKey = useSettingsStore((state) => state.getEffectiveApiKey);

  const [inputText, setInputText] = useState('');
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [isApplyingCategoryUpdate, setIsApplyingCategoryUpdate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasApiKey = getEffectiveApiKey().length > 0;
  const categoryNames = categories.map((category) => category.category_name);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isParsing]);

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmedText = inputText.trim();
    if (!trimmedText || isParsing) return;

    setInputText('');
    await sendMessage(trimmedText, categoryNames);
  }, [inputText, isParsing, sendMessage, categoryNames]);

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

  // Handle AI-initiated category updates (reassign investments to correct categories)
  const handleApplyCategoryUpdates = useCallback(async (): Promise<void> => {
    if (!categoryUpdates || isApplyingCategoryUpdate) return;

    setIsApplyingCategoryUpdate(true);

    try {
      await applyCategoryReassignments(categoryUpdates, categories, investments, updateInvestment);
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
  }, [categoryUpdates, categories, investments, updateInvestment, refetchCategories, clearCategoryUpdates, isApplyingCategoryUpdate]);

  // Auto-trigger category update when AI suggests it
  useEffect(() => {
    if (categoryUpdates && categoryUpdates.length > 0) {
      // Don't auto-apply, show the button in the UI
    }
  }, [categoryUpdates]);

  const hasMessages = messages.length > 0;

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
            🔄 AI đề xuất chuyển danh mục cho {categoryUpdates.reduce(
              (total, update) => total + (update.investmentNames?.length ?? 0), 0
            )} khoản đầu tư
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

      <div className={styles.chatMessages}>
        {!hasMessages && (
          <div className={styles.welcomeMessage}>
            <div className={styles.welcomeIcon}>🤖</div>
            <p className={styles.welcomeText}>{t('chat.welcome')}</p>
            <p className={styles.exampleHint}>{t('chat.example')}</p>
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
          disabled={!hasApiKey || !inputText.trim()}
          className={styles.sendButton}
        />
      </div>
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
        <div className={styles.messageBubbleUser}>{chatMessage.content}</div>
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
