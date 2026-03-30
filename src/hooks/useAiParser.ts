import { useState, useCallback } from 'react';
import { parseInvestmentText } from '../lib/gemini';
import { useSettingsStore } from '../stores/settingsStore';
import type { ParsedInvestmentResult, ChatMessage } from '../types/investment';
import { useShallow } from 'zustand/shallow';

type UseAiParserReturn = {
  messages: ChatMessage[];
  isParsing: boolean;
  sendMessage: (text: string, existingCategories: string[]) => Promise<void>;
  confirmParsedInvestments: (messageId: string) => void;
  clearMessages: () => void;
};

function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useAiParser(): UseAiParserReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const { geminiApiKey, geminiModel } = useSettingsStore(
    useShallow((state) => ({
      geminiApiKey: state.geminiApiKey,
      geminiModel: state.geminiModel,
    })),
  );

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
        const parsed: ParsedInvestmentResult[] = await parseInvestmentText(
          text,
          geminiApiKey,
          existingCategories,
          geminiModel,
        );

        const hasResults = parsed.length > 0;

        const assistantMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: hasResults ? 'ai_found_investments' : 'ai_no_results',
          parsedInvestments: hasResults ? parsed : undefined,
          isConfirmed: false,
          timestamp: new Date(),
        };

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
    [geminiApiKey, geminiModel],
  );

  const confirmParsedInvestments = useCallback((messageId: string): void => {
    setMessages((previous) =>
      previous.map((message) =>
        message.id === messageId ? { ...message, isConfirmed: true } : message,
      ),
    );
  }, []);

  const clearMessages = useCallback((): void => {
    setMessages([]);
  }, []);

  return { messages, isParsing, sendMessage, confirmParsedInvestments, clearMessages };
}
