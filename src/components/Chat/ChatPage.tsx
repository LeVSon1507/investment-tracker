import { type ReactElement, useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, message } from 'antd';
import { SendOutlined, ClearOutlined, CheckCircleFilled, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { useAiParser } from '../../hooks/useAiParser';
import { useCategories } from '../../hooks/useCategories';
import { useInvestments } from '../../hooks/useInvestments';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ChatMessage, ParsedInvestmentResult } from '../../types/investment';
import styles from './Chat.module.css';

function ChatPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { messages, isParsing, sendMessage, confirmParsedInvestments, clearMessages } =
    useAiParser();
  const { categories } = useCategories();
  const { createInvestment } = useInvestments();
  const { geminiApiKey, currency } = useSettingsStore(
    useShallow((state) => ({
      geminiApiKey: state.geminiApiKey,
      currency: state.currency,
    })),
  );

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasApiKey = geminiApiKey.length > 0;
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
      if (!chatMessageItem.parsedInvestments) return;

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
      }
    },
    [categories, createInvestment, confirmParsedInvestments, t],
  );

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
  chatMessage: ChatMessage;
  onConfirm: (message: ChatMessage) => void;
  currency: 'VND' | 'USD';
};

function MessageBubble({ chatMessage, onConfirm, currency }: MessageBubbleProps): ReactElement {
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

  return (
    <div className={styles.messageRowAssistant}>
      <div className={styles.messageBubbleAssistant}>
        {isFoundInvestments && <p>{t('chat.aiResponse')}</p>}
        {isNoResult && <p>{t('chat.noResult')}</p>}
        {!isFoundInvestments && !isNoResult && <p>{chatMessage.content}</p>}

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
                >
                  {t('chat.confirm')}
                </Button>
                <Button size="small">{t('chat.cancel')}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
