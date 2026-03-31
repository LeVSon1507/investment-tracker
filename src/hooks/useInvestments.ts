import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { InvestmentWithCategory, InvestmentInput } from '../types/investment';

type UseInvestmentsReturn = {
  investments: InvestmentWithCategory[];
  isLoading: boolean;
  totalAmount: number;
  createInvestment: (input: InvestmentInput) => Promise<void>;
  updateInvestment: (id: string, input: Partial<InvestmentInput>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
};

export function useInvestments(): UseInvestmentsReturn {
  const [investments, setInvestments] = useState<InvestmentWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInvestments = useCallback(async (): Promise<InvestmentWithCategory[]> => {
    const { data, error } = await supabase
      .from('investments')
      .select('*, category:investment_categories(*)')
      .order('invested_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch investments:', error.message);
      return [];
    }

    return data ?? [];
  }, []);

  useEffect(() => {
    let isStale = false;

    async function loadInvestments(): Promise<void> {
      const data = await fetchInvestments();
      if (isStale) return;
      setInvestments(data);
      setIsLoading(false);
    }

    loadInvestments();

    return () => {
      isStale = true;
    };
  }, [fetchInvestments]);

  const totalAmount = investments.reduce(
    (sum, investment) => (investment.include_in_total ? sum + investment.amount : sum),
    0,
  );

  const createInvestment = useCallback(
    async (input: InvestmentInput): Promise<void> => {
      const { error } = await supabase.from('investments').insert({
        category_id: input.categoryId,
        investment_name: input.investmentName,
        amount: input.amount,
        target_amount: input.targetAmount ?? null,
        include_in_total: input.includeInTotal ?? true,
        tracking_type: input.trackingType ?? 'none',
        ticker_symbol: input.tickerSymbol ?? null,
        quantity: input.quantity ?? null,
        purchase_unit_price: input.purchaseUnitPrice ?? null,
        purchase_date: input.purchaseDate ?? null,
        note: input.note ?? null,
        invested_at: input.investedAt ?? new Date().toISOString().split('T')[0],
      });

      if (error) {
        throw new Error(error.message);
      }

      setInvestments(await fetchInvestments());
    },
    [fetchInvestments],
  );

  const updateInvestment = useCallback(
    async (id: string, input: Partial<InvestmentInput>): Promise<void> => {
      const updatePayload: Record<string, unknown> = {};
      if (input.categoryId !== undefined) updatePayload.category_id = input.categoryId;
      if (input.investmentName !== undefined) updatePayload.investment_name = input.investmentName;
      if (input.amount !== undefined) updatePayload.amount = input.amount;
      if (input.targetAmount !== undefined) updatePayload.target_amount = input.targetAmount;
      if (input.includeInTotal !== undefined) updatePayload.include_in_total = input.includeInTotal;
      if (input.trackingType !== undefined) updatePayload.tracking_type = input.trackingType;
      if (input.tickerSymbol !== undefined) updatePayload.ticker_symbol = input.tickerSymbol;
      if (input.quantity !== undefined) updatePayload.quantity = input.quantity;
      if (input.purchaseUnitPrice !== undefined) updatePayload.purchase_unit_price = input.purchaseUnitPrice;
      if (input.purchaseDate !== undefined) updatePayload.purchase_date = input.purchaseDate;
      if (input.note !== undefined) updatePayload.note = input.note;
      if (input.investedAt !== undefined) updatePayload.invested_at = input.investedAt;
      updatePayload.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('investments')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      setInvestments(await fetchInvestments());
    },
    [fetchInvestments],
  );

  const deleteInvestment = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase.from('investments').delete().eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      setInvestments(await fetchInvestments());
    },
    [fetchInvestments],
  );

  return {
    investments,
    isLoading,
    totalAmount,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    refetch: async (): Promise<void> => {
      setInvestments(await fetchInvestments());
    },
  };
}
