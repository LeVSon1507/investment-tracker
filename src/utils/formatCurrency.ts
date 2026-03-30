import type { Currency } from '../types/investment';

const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const EXCHANGE_RATE_VND_TO_USD = 25_000;

export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'USD') {
    const usdAmount = Math.round(amount / EXCHANGE_RATE_VND_TO_USD);
    return USD_FORMATTER.format(usdAmount);
  }
  return VND_FORMATTER.format(amount);
}

export function formatCompactCurrency(amount: number, currency: Currency): string {
  if (currency === 'USD') {
    const usdAmount = amount / EXCHANGE_RATE_VND_TO_USD;
    if (usdAmount >= 1_000_000) return `$${(usdAmount / 1_000_000).toFixed(1)}M`;
    if (usdAmount >= 1_000) return `$${(usdAmount / 1_000).toFixed(1)}K`;
    return `$${Math.round(usdAmount)}`;
  }

  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} tr`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return VND_FORMATTER.format(amount);
}

export function parseInputAmount(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}
