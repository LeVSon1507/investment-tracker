import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { InvestmentCategory, CategoryInput } from '../types/investment';

type UseCategoriesReturn = {
  categories: InvestmentCategory[];
  isLoading: boolean;
  createCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (id: string, input: Partial<CategoryInput>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
};

const DEFAULT_CATEGORIES: Omit<CategoryInput, 'targetAmount'>[] = [
  { categoryName: 'Hũ MoMo', icon: '🟣', color: '#a855f7' },
  { categoryName: 'Sổ tiết kiệm', icon: '📒', color: '#06b6d4' },
  { categoryName: 'Tiền ngân hàng', icon: '🏦', color: '#3b82f6' },
  { categoryName: 'Chứng khoán', icon: '📈', color: '#6366f1' },
  { categoryName: 'Chứng chỉ quỹ', icon: '📊', color: '#8b5cf6' },
  { categoryName: 'Vàng', icon: '🥇', color: '#eab308' },
  { categoryName: 'Crypto', icon: '₿', color: '#f59e0b' },
  { categoryName: 'Bất động sản', icon: '🏠', color: '#10b981' },
  { categoryName: 'Tiền mặt', icon: '💵', color: '#22c55e' },
  { categoryName: 'Khác', icon: '💰', color: '#64748b' },
];

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<InvestmentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase
      .from('investment_categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch categories:', error.message);
      return;
    }

    setCategories(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isStale = false;

    async function loadInitialCategories(): Promise<void> {
      const { data, error } = await supabase
        .from('investment_categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (isStale) return;

      if (error) {
        console.error('Failed to fetch categories:', error.message);
        setIsLoading(false);
        return;
      }

      // Auto-seed default categories for new users who have none
      if (!data || data.length === 0) {
        const seedRows = DEFAULT_CATEGORIES.map((defaultCategory) => ({
          category_name: defaultCategory.categoryName,
          icon: defaultCategory.icon,
          color: defaultCategory.color,
        }));

        const { error: seedError } = await supabase
          .from('investment_categories')
          .insert(seedRows);

        if (isStale) return;

        if (seedError) {
          console.error('Failed to seed default categories:', seedError.message);
          setIsLoading(false);
          return;
        }

        // Re-fetch after seeding so we get the full rows with ids
        const { data: seededData } = await supabase
          .from('investment_categories')
          .select('*')
          .order('created_at', { ascending: true });

        if (isStale) return;
        setCategories(seededData ?? []);
        setIsLoading(false);
        return;
      }

      setCategories(data);
      setIsLoading(false);
    }

    loadInitialCategories();

    return () => {
      isStale = true;
    };
  }, []);

  const createCategory = useCallback(
    async (input: CategoryInput): Promise<void> => {
      const { error } = await supabase.from('investment_categories').insert({
        category_name: input.categoryName,
        icon: input.icon,
        color: input.color,
        target_amount: input.targetAmount ?? null,
      });

      if (error) {
        throw new Error(error.message);
      }

      await fetchCategories();
    },
    [fetchCategories],
  );

  const updateCategory = useCallback(
    async (id: string, input: Partial<CategoryInput>): Promise<void> => {
      const updatePayload: Record<string, unknown> = {};
      if (input.categoryName !== undefined) updatePayload.category_name = input.categoryName;
      if (input.icon !== undefined) updatePayload.icon = input.icon;
      if (input.color !== undefined) updatePayload.color = input.color;
      if (input.targetAmount !== undefined) updatePayload.target_amount = input.targetAmount;

      const { error } = await supabase
        .from('investment_categories')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      await fetchCategories();
    },
    [fetchCategories],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase.from('investment_categories').delete().eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      await fetchCategories();
    },
    [fetchCategories],
  );

  return {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}

export { DEFAULT_CATEGORIES };
