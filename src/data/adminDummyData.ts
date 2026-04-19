import type {
  AdminAccountProfile,
  AdminEvent,
  AdminMember,
  AdminMemberInvite,
  AdminPlan,
  AdminPolicySettings,
  AdminQrScreenSettings,
  AdminSite,
  AdminSiteMapSettings,
  CalendarDisplaySettings,
  SalesRule,
} from '@/types/admin';

export const calendarDisplaySettings: CalendarDisplaySettings = {
  publicBaseUrl: '/availability-calendar',
  thresholds: {
    warningRatio: 0.3,
  },
};

export const dummyPlans: AdminPlan[] = [
  {
    id: 'plan-1',
    name: 'スタンダードオートキャンプ',
    description: '人数に関係なく1組ごとの固定料金で予約する基本プランです。',
    category: 'オートサイト',
    features: '電源付き / 1組固定料金',
    isPublished: true,
    isLodgingTaxApplicable: false,
    pricingMode: 'per_group',
    basePrice: 8000,
    adultPrice: 0,
    childPrice: 0,
    infantPrice: 0,
    guestBandRules: [],
    targetSiteIds: ['1', '2'],
    applicableOptionIds: [],
    capacity: 8,
    maxSiteCount: 2,
    maxConcurrentReservations: 2,
    maxGuestsPerReservation: 8,
    salesStartDate: '2026-04-01',
    salesEndDate: '2026-11-30',
    imageUrl: '/site-map-placeholder.svg',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'plan-2',
    name: 'ファミリーキャンプ',
    description: '人数に応じて料金が変わるファミリー向けプランです。',
    category: 'ファミリーサイト',
    features: '大人子ども単価設定',
    isPublished: true,
    isLodgingTaxApplicable: false,
    pricingMode: 'per_person',
    basePrice: 0,
    adultPrice: 3000,
    childPrice: 1500,
    infantPrice: 0,
    guestBandRules: [],
    targetSiteIds: ['3', '4'],
    applicableOptionIds: [],
    capacity: 6,
    maxSiteCount: 2,
    maxConcurrentReservations: 2,
    maxGuestsPerReservation: 6,
    salesStartDate: '2026-04-01',
    salesEndDate: '2026-11-30',
    imageUrl: '/site-map-placeholder.svg',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
];

export const dummySites: AdminSite[] = [
  {
    id: '1',
    siteNumber: 'A-01',
    siteName: '電源サイト A-01',
    area: 'Aエリア',
    subArea: '電源付き',
    status: 'active',
    capacity: 4,
    basePrice: 5000,
    designationFee: 500,
    isPublished: true,
    slopeRating: 3,
    facilityDistance: 50,
    featureNote: '設備が近く使いやすいサイトです。',
    waterAvailable: true,
    electricAvailable: true,
    sewerAvailable: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    siteNumber: 'A-02',
    siteName: '眺望サイト A-02',
    area: 'Aエリア',
    subArea: '電源付き',
    status: 'active',
    capacity: 5,
    basePrice: 6200,
    designationFee: 800,
    isPublished: true,
    slopeRating: 2,
    facilityDistance: 35,
    featureNote: '景色が良い人気サイトです。',
    waterAvailable: true,
    electricAvailable: true,
    sewerAvailable: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const dummyEvents: AdminEvent[] = [
  {
    id: 'event-1',
    title: '焚き火イベント',
    description: 'スタッフが火起こしのコツを紹介する夕方イベントです。',
    startAt: '2026-04-15T18:00:00+09:00',
    endAt: '2026-04-15T20:00:00+09:00',
    location: '中央スペース',
    imageUrl: '/site-map-placeholder.svg',
    isPublished: true,
  },
];

export const dummyPolicySettings: AdminPolicySettings = {
  paymentNotice: 'お支払いは予約確定後に案内します。',
  eventEntryNotice: 'イベント参加時は予約確認画面からお申し込みください。',
  paymentMethods: [
    {
      id: 'credit_card',
      label: 'クレジットカード',
      description: 'オンラインで事前決済します。',
      isEnabled: true,
    },
  ],
  cancellationPolicies: [
    { period: '7日前まで', rate: '無料' },
    { period: '6日前〜前日', rate: '50%' },
    { period: '当日', rate: '100%' },
  ],
  termsSections: [
    {
      title: '利用規約',
      body: ['22:00以降は静かにお過ごしください。'],
    },
  ],
};

export const dummySalesRule: SalesRule = {
  id: 'rule-1',
  closedDates: ['2026-12-31'],
  closedDateRanges: [],
  siteClosures: [],
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

export const dummyAdminAccount: AdminAccountProfile = {
  userName: 'キャンプ場管理者',
  email: 'owner@example.com',
  password: '0221-owner',
  allowConcurrentLogin: true,
  isInitialized: false,
};

export const dummyAdminMembers: AdminMember[] = [
  {
    id: 'member-1',
    userName: 'キャンプ場管理者',
    email: 'owner@example.com',
    role: 'owner',
    invitedAt: '2026-04-01T09:00:00+09:00',
    activatedAt: '2026-04-01T09:30:00+09:00',
  },
];

export const dummyAdminInvites: AdminMemberInvite[] = [];

export const dummyQrScreenSettings: AdminQrScreenSettings = {
  title: 'チェックイン用QRコード',
  description: '管理画面のQR読取でチェックインできます。',
  supportText: '不具合時はスタッフへお問い合わせください。',
  externalLinkLabel: '使い方を見る',
  externalLinkUrl: 'https://example.com/guide',
  footerNote: '通信状況が悪い場合は画像を保存して提示してください。',
};

export const dummySiteMapSettings: AdminSiteMapSettings = {
  description: 'サイト全体マップです。',
  imageUrls: ['/site-map-placeholder.svg'],
};
