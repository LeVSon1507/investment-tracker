import type {
  AssetTrackingType,
  ChatAttachment,
  Currency,
  Language,
  ParsedInvestmentResult,
} from '../types/investment';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

type AiResponseAction =
  | 'parse_investments'
  | 'manage_categories'
  | 'manage_investments'
  | 'update_settings'
  | 'general_response';

type AiContext = {
  account: {
    userId: string;
    label: string;
  };
  existingCategories: string[];
  existingInvestments: string[];
  settings: {
    salaryDay: number;
    currency: Currency;
    language: Language;
    geminiModel: string;
  };
};

type SettingsUpdateCommand = {
  salaryDay?: number;
  currency?: Currency;
  language?: Language;
  geminiModel?: string;
  geminiApiKey?: string;
};

type AiStructuredResponse = {
  action: AiResponseAction;
  investments?: ParsedInvestmentResult[];
  categoryUpdates?: CategoryUpdateCommand[];
  investmentUpdates?: InvestmentCommand[];
  settingsUpdate?: SettingsUpdateCommand;
  message?: string;
};

type CategoryUpdateCommand = {
  type: 'rename' | 'reassign' | 'create' | 'update' | 'delete';
  fromCategory?: string;
  toCategory?: string;
  categoryName?: string;
  newCategoryName?: string;
  investmentNames?: string[];
  icon?: string;
  color?: string;
  targetAmount?: number | null;
};

type InvestmentCommand = {
  type: 'create' | 'update' | 'delete';
  investmentName: string;
  newInvestmentName?: string;
  categoryName?: string;
  amount?: number;
  targetAmount?: number | null;
  includeInTotal?: boolean;
  trackingType?: AssetTrackingType;
  tickerSymbol?: string | null;
  quantity?: number | null;
  purchaseUnitPrice?: number | null;
  purchaseDate?: string | null;
  note?: string;
};

function buildPrompt(userText: string, context: AiContext): string {
  return `Bạn là trợ lý tài chính thông minh, hỗ trợ quản lý đầu tư cá nhân.

BẠN CÓ THỂ LÀM 5 VIỆC:

1. PHÂN TÍCH KHOẢN ĐẦU TƯ: Khi user nhập thông tin về tiền đầu tư
2. SỬA ĐỔI DANH MỤC: Khi user yêu cầu đổi danh mục, chuyển khoản sang danh mục khác
3. SỬA KHOẢN ĐẦU TƯ: Khi user muốn sửa tên, số tiền, target, ghi chú, tính vào tổng hay xóa khoản
4. SỬA CÀI ĐẶT: Khi user muốn đổi ngày lương, ngôn ngữ, tiền tệ, model Gemini, API key
5. TRẢ LỜI CHUNG: Khi user hỏi về tài chính hoặc câu hỏi khác

DANH MỤC CÓ SẴN: ${context.existingCategories.join(', ')}
KHOẢN ĐẦU TƯ HIỆN CÓ: ${context.existingInvestments.join(', ') || 'Chưa có'}
ACCOUNT HIỆN TẠI:
- userId: ${context.account.userId}
- label: ${context.account.label}
CÀI ĐẶT HIỆN TẠI:
- salaryDay: ${context.settings.salaryDay}
- currency: ${context.settings.currency}
- language: ${context.settings.language}
- geminiModel: ${context.settings.geminiModel}

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

QUY TẮC TRACKING TÀI SẢN:
- Với "cổ phiếu", "chứng chỉ quỹ", "vàng", "crypto" nếu user muốn theo dõi lãi lỗ hoặc đang nhập giao dịch mua thì CỐ GẮNG trích xuất:
  - trackingType
  - tickerSymbol
  - quantity
  - purchaseUnitPrice
  - purchaseDate
- Nếu đây là tài sản trackable nhưng user CHƯA cho đủ quantity hoặc purchaseUnitPrice, KHÔNG tự bịa.
- Khi thiếu dữ liệu quan trọng để tracking, trả về general_response và hỏi ngắn gọn đúng phần còn thiếu. Ví dụ:
  - "Bạn mua mã VCB bao nhiêu cổ và giá mua trung bình bao nhiêu?"
  - "Bạn mua vàng loại nào, bao nhiêu chỉ và giá mua mỗi chỉ bao nhiêu?"

TRẢ VỀ JSON theo format:
{
  "action": "parse_investments" | "manage_categories" | "manage_investments" | "update_settings" | "general_response",
  "investments": [...],
  "categoryUpdates": [...],
  "investmentUpdates": [...],
  "settingsUpdate": {...},
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
      "trackingType": "stock" | "gold" | "fund" | "crypto" | "none",
      "tickerSymbol": "VCB",
      "quantity": 100,
      "purchaseUnitPrice": 85000,
      "purchaseDate": "2026-03-30",
      "note": "Ghi chú"
    }
  ]
}

Nếu action = "manage_categories":
{
  "action": "manage_categories",
  "categoryUpdates": [
    {
      "type": "reassign",
      "fromCategory": "Khác",
      "toCategory": "Hũ MoMo",
      "investmentNames": ["Quỹ Trả nợ mẫu hậu", "Quỹ Chăm vợ hai"]
    },
    {
      "type": "create",
      "categoryName": "Quỹ du lịch",
      "icon": "✈️",
      "color": "#0ea5e9",
      "targetAmount": 50000000
    }
  ],
  "message": "Đã chuẩn bị cập nhật danh mục"
}

Nếu action = "manage_investments":
{
  "action": "manage_investments",
  "investmentUpdates": [
    {
      "type": "update",
      "investmentName": "VCB",
      "amount": 80000000,
      "trackingType": "stock",
      "tickerSymbol": "VCB",
      "quantity": 1000,
      "purchaseUnitPrice": 80000,
      "purchaseDate": "2026-03-30",
      "targetAmount": 100000000,
      "includeInTotal": true,
      "note": "Nâng tỷ trọng"
    },
    {
      "type": "delete",
      "investmentName": "Quỹ cũ"
    }
  ],
  "message": "Đã chuẩn bị cập nhật khoản đầu tư"
}

Nếu action = "update_settings":
{
  "action": "update_settings",
  "settingsUpdate": {
    "salaryDay": 28,
    "currency": "VND",
    "language": "vi",
    "geminiModel": "gemini-2.5-flash-lite"
  },
  "message": "Đã chuẩn bị cập nhật cài đặt"
}

Nếu action = "general_response" (câu hỏi chung):
{
  "action": "general_response",
  "message": "Câu trả lời của bạn"
}

TEXT CỦA NGƯỜI DÙNG:
"${userText}"`;
}

export type {
  AiStructuredResponse,
  CategoryUpdateCommand,
  InvestmentCommand,
  SettingsUpdateCommand,
  AiContext,
};

export async function parseInvestmentText(
  userText: string,
  apiKey: string,
  context: AiContext,
  attachment: ChatAttachment | null,
  model?: string,
): Promise<AiStructuredResponse> {
  const selectedModel = model || DEFAULT_MODEL;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
  const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(userText, context) }];

  if (attachment) {
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.base64Data,
      },
    });
    parts.push({
      text: `Ảnh đính kèm tên ${attachment.name}. Nếu ảnh có chứa bảng kê, sao kê, phiếu lệnh, danh mục đầu tư hoặc ảnh chụp app chứng khoán/quỹ/vàng thì hãy đọc nội dung trong ảnh và trích xuất giao dịch. Chỉ dùng dữ liệu nhìn thấy trong ảnh, không suy đoán.`,
    });
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts,
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
