import { useState, useCallback, useEffect, useRef } from 'react';
import { parseInvestmentText } from '../lib/gemini';
import { useSettingsStore } from '../stores/settingsStore';
import type { ChatMessage } from '../types/investment';
import type { AiStructuredResponse, CategoryUpdateCommand } from '../lib/gemini';

const CHAT_STORAGE_KEY = 'investtracker_chat_history';
const MAX_STORED_MESSAGES = 100;

type UseAiParserReturn = {
  messages: ChatMessage[];
  isParsing: boolean;
  sendMessage: (text: string, existingCategories: string[]) => Promise<void>;
  confirmParsedInvestments: (messageId: string) => void;
  clearMessages: () => void;
  categoryUpdates: CategoryUpdateCommand[] | null;
  clearCategoryUpdates: () => void;
};

function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadStoredMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
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

function saveMessagesToStorage(messageList: ChatMessage[]): void {
  try {
    const messagesToSave = messageList.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messagesToSave));
  } catch {
    // localStorage might be full, silently fail
  }
}

export function useAiParser(): UseAiParserReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages());
  const [isParsing, setIsParsing] = useState(false);
  const [categoryUpdates, setCategoryUpdates] = useState<CategoryUpdateCommand[] | null>(null);
  const geminiModel = useSettingsStore((state) => state.geminiModel);
  const getEffectiveApiKey = useSettingsStore((state) => state.getEffectiveApiKey);

  // Ref to track saved message IDs and prevent double-save
  const savedMessageIds = useRef<Set<string>>(
    new Set(
      loadStoredMessages()
        .filter((chatMessage) => chatMessage.isConfirmed)
        .map((chatMessage) => chatMessage.id),
    ),
  );

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveMessagesToStorage(messages);
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string, existingCategories: string[]): Promise<void> => {
      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessages((previous) => [...previous, userMessage]);
      setIsParsing(true);

      try {
        const aiResponse: AiStructuredResponse = await parseInvestmentText(
          text,
          getEffectiveApiKey(),
          existingCategories,
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
        } else if (aiResponse.action === 'update_categories' && aiResponse.categoryUpdates) {
          setCategoryUpdates(aiResponse.categoryUpdates);
          assistantMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: aiResponse.message ?? 'Đã cập nhật danh mục.',
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
    savedMessageIds.current.clear();
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }, []);

  const clearCategoryUpdates = useCallback((): void => {
    setCategoryUpdates(null);
  }, []);

  return {
    messages,
    isParsing,
    sendMessage,
    confirmParsedInvestments,
    clearMessages,
    categoryUpdates,
    clearCategoryUpdates,
  };
}
