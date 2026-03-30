# 🚀 InvestTracker - Hướng dẫn Setup

## 1. Tạo Supabase Project

1. Truy cập [supabase.com](https://supabase.com) → **Start your project** → Đăng nhập bằng GitHub
2. Click **New project**
3. Điền thông tin:
   - **Organization**: Chọn org hiện tại hoặc tạo mới
   - **Name**: `investment-tracker`
   - **Database Password**: Tạo password mạnh (lưu lại!)
   - **Region**: `Southeast Asia (Singapore)` — gần VN nhất
4. Click **Create new project** → Đợi 1-2 phút

## 2. Chạy Database Migration

1. Trong Supabase Dashboard → **SQL Editor** (menu bên trái)
2. Click **New query**
3. Copy toàn bộ nội dung file `supabase/migrations/001_initial_schema.sql` vào editor
4. Click **Run** (hoặc Cmd+Enter)
5. Kiểm tra không có lỗi → Xong!

## 3. Setup Google OAuth

1. Trong Supabase Dashboard → **Authentication** → **Providers**
2. Tìm **Google** → Bật toggle **Enable**
3. Cần tạo Google OAuth credentials:
   - Truy cập [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Tạo project mới hoặc chọn project hiện tại
   - **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: thêm `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
     (lấy từ Supabase Dashboard → Authentication → Providers → Google → Callback URL)
   - Copy **Client ID** và **Client Secret**
4. Quay lại Supabase → Paste Client ID và Client Secret vào
5. Click **Save**

## 4. Lấy Supabase Keys

1. Trong Supabase Dashboard → **Settings** → **API** (hoặc click biểu tượng ⚙️)
2. Copy 2 giá trị:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJI...`

## 5. Cấu hình App

1. Tạo file `.env` từ template:
   ```bash
   cp .env.example .env
   ```

2. Sửa file `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## 6. Chạy Local

```bash
npm install
npm run dev
```

Mở browser tại `http://localhost:5173`

## 7. Nhập Gemini API Key

1. Truy cập [aistudio.google.com](https://aistudio.google.com/)
2. Click **Get API key** → **Create API key**
3. Copy key
4. Trong app → **Cài đặt** → Paste API key → **Lưu**

## 8. Deploy lên Vercel

1. Push code lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/investment-tracker.git
   git push -u origin main
   ```

2. Truy cập [vercel.com](https://vercel.com) → **Add New Project**
3. Import GitHub repository
4. Thêm **Environment Variables**:
   - `VITE_SUPABASE_URL` = your supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy** → Xong! 🎉

## 9. Cập nhật Google OAuth Redirect

Sau khi deploy, cần thêm redirect URL vào Google OAuth:
1. Google Cloud Console → Credentials → OAuth 2.0 Client
2. Thêm Authorized redirect URI: `https://your-app.vercel.app`
3. Quay lại Supabase → Authentication → URL Configuration
4. Thêm `https://your-app.vercel.app` vào **Redirect URLs**

---

## 💡 Tips

- **Supabase tự pause**: Free tier tự pause sau 7 ngày không dùng. Vào dashboard click "Restore" để khởi động lại.
- **Gemini API free**: Có rate limit nhưng đủ dùng cho cá nhân. Model `gemini-2.0-flash` nhanh và miễn phí.
- **Backup data**: Vào Supabase → Table Editor để export CSV bất kỳ lúc nào.
