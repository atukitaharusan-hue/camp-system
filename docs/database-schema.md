# キャンプ場予約システム - データベース設計

## ER図

```mermaid
erDiagram
    profiles ||--o{ reservations : "makes"
    profiles ||--o{ check_ins : "performs"
    profiles ||--o{ notifications : "receives"

    campgrounds ||--o{ sites : "contains"
    sites ||--o{ reservations : "has"

    reservations ||--o{ reservation_options : "includes"
    reservations ||--o{ payments : "has"
    reservations ||--o{ check_ins : "has"
    reservations ||--o{ notifications : "triggers"

    options ||--o{ reservation_options : "selected_in"

    profiles {
        uuid id PK
        text email UK
        text phone
        text full_name
        user_role role
        timestamp created_at
        timestamp updated_at
    }

    campgrounds {
        uuid id PK
        text name
        text description
        text address
        text phone
        text email
        integer capacity
        jsonb operating_hours
        jsonb amenities
        text rules
        timestamp created_at
        timestamp updated_at
    }

    sites {
        uuid id PK
        uuid campground_id FK
        text site_number UK
        site_type type
        integer capacity
        decimal price_per_night
        text description
        jsonb features
        jsonb location_data
        integer drainage_rating
        integer slope_rating
        integer view_rating
        integer distance_to_facilities
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    options {
        uuid id PK
        text name
        text description
        decimal price
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    reservations {
        uuid id PK
        uuid user_id FK
        uuid site_id FK
        date check_in_date
        date check_out_date
        integer guests
        decimal total_amount
        reservation_status status
        text special_requests
        timestamp created_at
        timestamp updated_at
    }

    reservation_options {
        uuid id PK
        uuid reservation_id FK
        uuid option_id FK
        integer quantity
        timestamp created_at
    }

    payments {
        uuid id PK
        uuid reservation_id FK
        decimal amount
        text currency
        payment_method method
        payment_status status
        text stripe_payment_intent_id
        text stripe_charge_id
        timestamp paid_at
        timestamp created_at
        timestamp updated_at
    }

    check_ins {
        uuid id PK
        uuid reservation_id FK
        uuid checked_in_by FK
        timestamp check_in_time
        text qr_code UK
        text notes
        timestamp created_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        uuid reservation_id FK
        text type
        text title
        text message
        jsonb sent_via
        timestamp sent_at
        timestamp created_at
    }
```

## テーブル詳細

### 主要エンティティ

#### profiles (ユーザー情報)
- Supabase Auth と連携
- ロールベースアクセス制御（user/admin/manager）

#### campgrounds (キャンプ場)
- 基本情報と設備情報
- JSONB で柔軟なデータ構造

#### sites (サイト)
- 各キャンプ場の区画情報
- 詳細な評価データ（水はけ・傾斜・景観）
- 位置情報と設備情報

#### reservations (予約)
- 予約の核心データ
- 日付重複チェック必須
- ステータス管理

#### options (オプションサービス)
- アーリーチェックイン、ペット料金など
- 動的価格設定

### 関係テーブル

#### reservation_options (予約オプション)
- 多対多関係の解決
- 数量指定可能

#### payments (決済)
- Stripe 統合用
- 複数決済方式対応

#### check_ins (チェックイン)
- QRコード対応
- チェックイン履歴

#### notifications (通知)
- メール/LINE 通知管理
- 送信履歴追跡

## セキュリティ設計

### Row Level Security (RLS)
- ユーザー：自身のデータのみアクセス
- 管理者：全データアクセス
- 公開データ：キャンプ場・サイト情報

### ビジネスルール
- サイト重複予約防止
- 金額計算関数
- 在庫チェック関数

## パフォーマンス最適化

### インデックス
- 日付範囲検索用インデックス
- ステータス検索用インデックス
- 外部キーインデックス

### パーティショニング検討
- 大規模化時の予約テーブル分割
- 時系列データのパーティション