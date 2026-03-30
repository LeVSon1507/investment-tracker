import type { ParsedInvestmentResult } from '../types/investment';

const DEFAULT_MODEL = 'gemini-2.0-flash';

function buildPrompt(userText: string, existingCategories: string[]): string {
  return `Bạn là trợ lý tài chính chuyên phân tích thông tin đầu tư.

NHIỆM VỤ: Phân tích đoạn text của người dùng và trích xuất các khoản đầu tư.

DANH MỤC CÓ SẴN: ${existingCategories.join(', ')}
Nếu không khớp danh mục nào, dùng "Khác".

QUY TẮC:
- Số tiền phải convert về VND (đơn vị đồng, không phải triệu/tỷ)
- "50 triệu" = 50000000
- "1 tỷ" = 1000000000
- "500k" = 500000
- "$1000" ≈ 25000000 (nếu user nói USD, convert theo tỷ giá ước lượng ~25,000)
- Nếu user nói nhiều khoản, trả về array
- investmentName nên ngắn gọn, rõ ràng

TRẢ VỀ JSON ARRAY với format:
[
  {
    "investmentName": "Tên khoản đầu tư",
    "categoryName": "Tên danh mục",
    "amount": 50000000,
    "note": "Ghi chú nếu có"
  }
]

TEXT CỦA NGƯỜI DÙNG:
"${userText}"`;
}

export async function parseInvestmentText(
  userText: string,
  apiKey: string,
  existingCategories: string[],
  model?: string,
): Promise<ParsedInvestmentResult[]> {
  const selectedModel = model || DEFAULT_MODEL;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildPrompt(userText, existingCategories) }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    return [];
  }

  const parsed: ParsedInvestmentResult[] = JSON.parse(textContent);
  return parsed;
}

export async function validateApiKey(apiKey: string, model?: string): Promise<boolean> {
  const selectedModel = model || DEFAULT_MODEL;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
