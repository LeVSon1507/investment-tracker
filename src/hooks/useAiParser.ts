import { useState, useCallback, useEffect, useRef } from 'react';
import { parseInvestmentText } from '../lib/gemini';
import { useSettingsStore } from '../stores/settingsStore';
import type { ChatAttachment, ChatMessage } from '../types/investment';
import type {
  AiStructuredResponse,
  CategoryUpdateCommand,
  InvestmentCommand,
  SettingsUpdateCommand,
} from '../lib/gemini';

const MAX_STORED_MESSAGES = 100;

type UseAiParserReturn = {
  messages: ChatMessage[];
  isParsing: boolean;
  sendMessage: (
    text: string,
    context: {
      existingCategories: string[];
      existingInvestments: string[];
      settings: {
        salaryDay: number;
        currency: 'VND' | 'USD';
        language: 'vi' | 'en';
        geminiModel: string;
      };
      account: {
        userId: string;
        label: string;
      };
    },
    attachment?: ChatAttachment | null,
  ) => Promise<void>;
  confirmParsedInvestments: (messageId: string) => void;
  clearMessages: () => void;
  categoryUpdates: CategoryUpdateCommand[] | null;
  investmentUpdates: InvestmentCommand[] | null;
  settingsUpdate: SettingsUpdateCommand | null;
  clearCategoryUpdates: () => void;
  clearInvestmentUpdates: () => void;
  clearSettingsUpdate: () => void;
};

function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getChatStorageKey(accountUserId: string): string {
  return `investtracker_chat_history_${accountUserId}`;
}

function loadStoredMessages(accountUserId: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getChatStorageKey(accountUserId));
    if (!stored) return [];

    const parsed = JSON.parse(stored) as ChatMessage[];
    // Restore Date objects from serialized strings
    return parsed.map((chatMessage) => ({
      ...chatMessage,
      timestamp: new Date(chatMessage.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveMessagesToStorage(accountUserId: string, messageList: ChatMessage[]): void {
  try {
    const messagesToSave = messageList.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(getChatStorageKey(accountUserId), JSON.stringify(messagesToSave));
  } catch {
    // localStorage might be full, silently fail
  }
}

export function useAiParser(accountUserId: string): UseAiParserReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages(accountUserId));
  const [isParsing, setIsParsing] = useState(false);
  const [categoryUpdates, setCategoryUpdates] = useState<CategoryUpdateCommand[] | null>(null);
  const [investmentUpdates, setInvestmentUpdates] = useState<InvestmentCommand[] | null>(null);
  const [settingsUpdate, setSettingsUpdate] = useState<SettingsUpdateCommand | null>(null);
  const geminiModel = useSettingsStore((state) => state.geminiModel);
  const getEffectiveApiKey = useSettingsStore((state) => state.getEffectiveApiKey);

  // Ref to track saved message IDs and prevent double-save
  const savedMessageIds = useRef<Set<string>>(
    new Set(
      loadStoredMessages(accountUserId)
        .filter((chatMessage) => chatMessage.isConfirmed)
        .map((chatMessage) => chatMessage.id),
    ),
  );

  useEffect(() => {
    const loadedMessages = loadStoredMessages(accountUserId);
    setMessages(loadedMessages);
    savedMessageIds.current = new Set(
      loadedMessages.filter((chatMessage) => chatMessage.isConfirmed).map((chatMessage) => chatMessage.id),
    );
  }, [accountUserId]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveMessagesToStorage(accountUserId, messages);
  }, [accountUserId, messages]);

  const sendMessage = useCallback(
    async (
      text: string,
      context: {
        existingCategories: string[];
        existingInvestments: string[];
        settings: {
          salaryDay: number;
          currency: 'VND' | 'USD';
          language: 'vi' | 'en';
          geminiModel: string;
        };
        account: {
          userId: string;
          label: string;
        };
      },
      attachment: ChatAttachment | null = null,
    ): Promise<void> => {
      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: text,
        attachmentName: attachment?.name,
        timestamp: new Date(),
      };

      setMessages((previous) => [...previous, userMessage]);
      setIsParsing(true);

      try {
        const aiResponse: AiStructuredResponse = await parseInvestmentText(
          text,
          getEffectiveApiKey(),
          context,
          attachment,
          geminiModel,
        );

        let assistantMessage: ChatMessage;

        if (aiResponse.action === 'parse_investments' && aiResponse.investments && aiResponse.investments.length > 0) {
          assistantMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: 'ai_found_investments',
            parsedInvestments: aiResponse.investments,
            isConfirmed: false,
            timestamp: new Date(),
          };
        } else if (aiResponse.action === 'manage_categories' && aiResponse.categoryUpdates) {
          setCategoryUpdates(aiResponse.categoryUpdates);
          assistantMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: aiResponse.message ?? 'Đã cập nhật danh mục.',
            timestamp: new Date(),
          };
        } else if (aiResponse.action === 'manage_investments' && aiResponse.investmentUpdates) {
          setInvestmentUpdates(aiResponse.investmentUpdates);
          assistantMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: aiResponse.message ?? 'Đã chuẩn bị cập nhật khoản đầu tư.',
            timestamp: new Date(),
          };
        } else if (aiResponse.action === 'update_settings' && aiResponse.settingsUpdate) {
          setSettingsUpdate(aiResponse.settingsUpdate);
          assistantMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: aiResponse.message ?? 'Đã chuẩn bị cập nhật cài đặt.',
            timestamp: new Date(),
          };
        } else if (aiResponse.action === 'general_response') {
          assistantMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: aiResponse.message ?? 'Tôi không hiểu ý bạn. Bạn thử lại nhé.',
            timestamp: new Date(),
          };
        } else {
          assistantMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: 'ai_no_results',
            timestamp: new Date(),
          };
        }

        setMessages((previous) => [...previous, assistantMessage]);
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        };

        setMessages((previous) => [...previous, errorMessage]);
      } finally {
        setIsParsing(false);
      }
    },
    [getEffectiveApiKey, geminiModel],
  );

  const confirmParsedInvestments = useCallback((messageId: string): void => {
    // Guard against double-clicking
    if (savedMessageIds.current.has(messageId)) return;
    savedMessageIds.current.add(messageId);

    setMessages((previous) =>
      previous.map((chatMessage) =>
        chatMessage.id === messageId ? { ...chatMessage, isConfirmed: true } : chatMessage,
      ),
    );
  }, []);

  const clearMessages = useCallback((): void => {
    setMessages([]);
    setCategoryUpdates(null);
    setInvestmentUpdates(null);
    setSettingsUpdate(null);
    savedMessageIds.current.clear();
    localStorage.removeItem(getChatStorageKey(accountUserId));
  }, [accountUserId]);

  const clearCategoryUpdates = useCallback((): void => {
    setCategoryUpdates(null);
  }, []);

  const clearInvestmentUpdates = useCallback((): void => {
    setInvestmentUpdates(null);
  }, []);

  const clearSettingsUpdate = useCallback((): void => {
    setSettingsUpdate(null);
  }, []);

  return {
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
  };
}
