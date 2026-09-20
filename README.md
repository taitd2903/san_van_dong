# Sakura Motion

Hệ thống React + Node.js + MySQL quản lý chương trình vận động trẻ em tại Sakurakid Mỹ Đình.

## Chuẩn bị MySQL trên Aiven

1. Trong Aiven Console, mở service MySQL và tải CA certificate thành `ca.pem` ở thư mục gốc.
2. Sao chép `.env.example` thành `.env`, sau đó điền Host, Port, User, Password và Database trong phần Connection information.
3. Giữ `DB_SSL=true`; không commit `.env` hoặc `ca.pem` lên Git.
4. Khởi tạo bảng và dữ liệu mẫu:

```bash
yarn db:init
```

## Chạy hệ thống

```bash
yarn install
yarn dev
```

Web chạy tại `http://127.0.0.1:5173`, API chạy tại `http://127.0.0.1:3001`.

Tài khoản mẫu đều dùng mật khẩu `123456`:

- Admin: `admin@sakurakid.vn`
- Giáo viên: `giaovien@sakurakid.vn`
- Phụ huynh: `phuhuynh@sakurakid.vn`

## Kiểm tra

```bash
yarn lint
yarn build
```
