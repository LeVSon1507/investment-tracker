export type GoldPriceRow = {
  groupName: string;
  productName: string;
  buyPrice: number;
  sellPrice: number;
  convertedPrice: number;
};

function parseMoneyValue(rawValue: string): number {
  const normalized = rawValue.replace(/[^\d]/g, '');
  return normalized.length > 0 ? Number(normalized) : 0;
}

export function parseKimKhanhVietHungGoldPrices(html: string): GoldPriceRow[] {
  const rows = Array.from(html.matchAll(/<tr>([\s\S]*?)<\/tr>/g));
  const goldPrices: GoldPriceRow[] = [];
  let currentGroupName = '';

  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const headerCells = Array.from(rowHtml.matchAll(/<th>([\s\S]*?)<\/th>/g)).map(
      ([, cell]) => cell.replace(/<[^>]+>/g, '').trim(),
    );

    if (headerCells.length > 0) {
      currentGroupName = headerCells[0];
      continue;
    }

    const cells = Array.from(rowHtml.matchAll(/<td>([\s\S]*?)<\/td>/g)).map(
      ([, cell]) =>
        cell
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim(),
    );

    if (cells.length < 4 || currentGroupName.length === 0) {
      continue;
    }

    goldPrices.push({
      groupName: currentGroupName,
      productName: cells[0],
      buyPrice: parseMoneyValue(cells[1]),
      sellPrice: parseMoneyValue(cells[2]),
      convertedPrice: parseMoneyValue(cells[3]),
    });
  }

  return goldPrices;
}
