import type { ParsedInvestmentResult } from '../types/investment';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

type AiResponseAction = 'parse_investments' | 'update_categories' | 'general_response';

type AiStructuredResponse = {
  action: AiResponseAction;
  investments?: ParsedInvestmentResult[];
  categoryUpdates?: CategoryUpdateCommand[];
  message?: string;
};

type CategoryUpdateCommand = {
  type: 'rename' | 'reassign';
  fromCategory: string;
  toCategory: string;
  investmentNames?: string[];
};

function buildPrompt(userText: string, existingCategories: string[]): string {
  return `Bạn là trợ lý tài chính thông minh, hỗ trợ quản lý đầu tư cá nhân.

BẠN CÓ THỂ LÀM 3 VIỆC:

1. PHÂN TÍCH KHOẢN ĐẦU TƯ: Khi user nhập thông tin về tiền đầu tư
2. SỬA ĐỔI DANH MỤC: Khi user yêu cầu đổi danh mục, chuyển khoản sang danh mục khác
3. TRẢ LỜI CHUNG: Khi user hỏi về tài chính hoặc câu hỏi khác

DANH MỤC CÓ SẴN: ${existingCategories.join(', ')}

QUY TẮC PHÂN LOẠI DANH MỤC (RẤT QUAN TRỌNG):
- "MoMo", "ví MoMo", "hũ MoMo", "quỹ MoMo", "quỹ khẩn cấp MoMo", "quỹ chăm vợ MoMo" → dùng "Hũ MoMo"
- "TPBank", "Techcombank", "VPBank", "tài khoản ngân hàng", "tài khoản lương" → dùng "Tiền ngân hàng"
- "Sổ tiết kiệm", "gửi tiết kiệm", "tiết kiệm online" → dùng "Sổ tiết kiệm"
- "FPT", "VNM", "MWG", "cổ phiếu", "chứng khoán", "stock" → dùng "Chứng khoán"
- "chứng chỉ quỹ", "quỹ đầu tư", "DCDS", "VFMVN30" → dùng "Chứng chỉ quỹ"
- "vàng", "SJC", "PNJ" → dùng "Vàng"
- "crypto", "bitcoin", "BTC", "ETH" → dùng "Crypto"
- "nhà", "đất", "bất động sản" → dùng "Bất động sản"
- "tiền mặt", "cash" → dùng "Tiền mặt"
- CHỈ dùng "Khác" khi THẬT SỰ không khớp gì cả. Ưu tiên match danh mục có sẵn.

QUY TẮC SỐ TIỀN:
- "50 triệu" = 50000000
- "1 tỷ" = 1000000000
- "500k" = 500000
- "$1000" ≈ 25000000

TRẢ VỀ JSON theo format:
{
  "action": "parse_investments" | "update_categories" | "general_response",
  "investments": [...],
  "categoryUpdates": [...],
  "message": "..."
}

Nếu action = "parse_investments":
{
  "action": "parse_investments",
  "investments": [
    {
      "investmentName": "Tên khoản",
      "categoryName": "Tên danh mục (PHẢI nằm trong danh mục có sẵn)",
      "amount": 50000000,
      "note": "Ghi chú"
    }
  ]
}

Nếu action = "update_categories" (khi user yêu cầu chuyển danh mục):
{
  "action": "update_categories",
  "categoryUpdates": [
    {
      "type": "reassign",
      "fromCategory": "Khác",
      "toCategory": "Hũ MoMo",
      "investmentNames": ["Quỹ Trả nợ mẫu hậu", "Quỹ Chăm vợ hai"]
    }
  ],
  "message": "Đã chuyển 2 khoản từ Khác sang Hũ MoMo"
}

Nếu action = "general_response" (câu hỏi chung):
{
  "action": "general_response",
  "message": "Câu trả lời của bạn"
}

TEXT CỦA NGƯỜI DÙNG:
"${userText}"`;
}

export type { AiStructuredResponse, CategoryUpdateCommand };

export async function parseInvestmentText(
  userText: string,
  apiKey: string,
  existingCategories: string[],
  model?: string,
): Promise<AiStructuredResponse> {
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
    return { action: 'general_response', message: 'Không thể phân tích. Bạn thử lại nhé.' };
  }

  const parsed: AiStructuredResponse = JSON.parse(textContent);

  // Backward compatibility: if response is an array, wrap it
  if (Array.isArray(parsed)) {
    return {
      action: 'parse_investments',
      investments: parsed as unknown as ParsedInvestmentResult[],
    };
  }

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
