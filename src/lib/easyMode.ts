import type {
  EasyModeChecklistConfig,
  EasyModeChecklistItem,
  EasyModeCustomEventsConfig,
  EasyModeCustomLinkConfig,
  EasyModeCustomLinkItem,
  EasyModeCustomMemoConfig,
  EasyModeCustomProductsConfig,
  EasyModeCustomReservationsConfig,
  EasyModeInventoryOverride,
} from '@/types/admin';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function todayIsoJst(offset = 0): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  jst.setDate(jst.getDate() + offset);
  const yyyy = jst.getFullYear();
  const mm = String(jst.getMonth() + 1).padStart(2, '0');
  const dd = String(jst.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function toCustomMemoConfig(config: unknown): EasyModeCustomMemoConfig {
  if (!isRecord(config)) {
    return { content: '', lastUpdatedBy: '', updatedAt: '' };
  }

  return {
    content: typeof config.content === 'string' ? config.content : '',
    lastUpdatedBy: typeof config.lastUpdatedBy === 'string' ? config.lastUpdatedBy : '',
    updatedAt: typeof config.updatedAt === 'string' ? config.updatedAt : '',
  };
}

function normalizeLinkItem(item: unknown, index: number): EasyModeCustomLinkItem {
  const source = isRecord(item) ? item : {};
  return {
    id: typeof source.id === 'string' && source.id ? source.id : `link-${index + 1}`,
    title: typeof source.title === 'string' ? source.title : '',
    url: typeof source.url === 'string' ? source.url : '',
    icon: typeof source.icon === 'string' && source.icon ? source.icon : '🔗',
    description: typeof source.description === 'string' ? source.description : '',
  };
}

export function toCustomLinkConfig(config: unknown): EasyModeCustomLinkConfig {
  if (!isRecord(config)) {
    return { links: [] };
  }

  return {
    links: Array.isArray(config.links) ? config.links.map(normalizeLinkItem) : [],
  };
}

function normalizeChecklistItem(item: unknown, index: number): EasyModeChecklistItem {
  const source = isRecord(item) ? item : {};
  return {
    id: typeof source.id === 'string' && source.id ? source.id : `check-${index + 1}`,
    title: typeof source.title === 'string' ? source.title : '',
    description: typeof source.description === 'string' ? source.description : '',
    assignedTo: typeof source.assignedTo === 'string' ? source.assignedTo : '',
    dueAt: typeof source.dueAt === 'string' ? source.dueAt : '',
    isCompleted: Boolean(source.isCompleted),
    completedAt: typeof source.completedAt === 'string' ? source.completedAt : null,
    sortOrder: typeof source.sortOrder === 'number' ? source.sortOrder : index + 1,
    resetDaily: source.resetDaily !== false,
  };
}

export function toChecklistConfig(config: unknown): EasyModeChecklistConfig {
  if (!isRecord(config)) {
    return { items: [], lastResetDate: '' };
  }

  const items = Array.isArray(config.items) ? config.items.map(normalizeChecklistItem) : [];
  return {
    items: items.sort((a, b) => a.sortOrder - b.sortOrder),
    lastResetDate: typeof config.lastResetDate === 'string' ? config.lastResetDate : '',
  };
}

export function resetChecklistForToday(config: EasyModeChecklistConfig): EasyModeChecklistConfig {
  const today = todayIsoJst();
  if (config.lastResetDate === today) return config;

  return {
    lastResetDate: today,
    items: config.items.map((item) =>
      item.resetDaily
        ? {
            ...item,
            isCompleted: false,
            completedAt: null,
          }
        : item,
    ),
  };
}

export function toCustomProductsConfig(config: unknown): EasyModeCustomProductsConfig {
  if (!isRecord(config)) {
    return {
      optionCategory: '',
      titleContains: '',
      showStock: true,
      showPrice: true,
      allowCheckout: true,
    };
  }

  return {
    optionCategory: typeof config.optionCategory === 'string' ? config.optionCategory : '',
    titleContains: typeof config.titleContains === 'string' ? config.titleContains : '',
    showStock: config.showStock !== false,
    showPrice: config.showPrice !== false,
    allowCheckout: config.allowCheckout !== false,
  };
}

export function toCustomEventsConfig(config: unknown): EasyModeCustomEventsConfig {
  if (!isRecord(config)) {
    return {
      filter: 'today',
      showParticipants: true,
      showNotes: true,
    };
  }

  return {
    filter:
      config.filter === 'this_week' || config.filter === 'upcoming' || config.filter === 'today'
        ? config.filter
        : 'today',
    showParticipants: config.showParticipants !== false,
    showNotes: config.showNotes !== false,
  };
}

export function toCustomReservationsConfig(config: unknown): EasyModeCustomReservationsConfig {
  if (!isRecord(config)) {
    return {
      filter: 'arrived_pending',
      date: 'today',
    };
  }

  return {
    filter:
      config.filter === 'not_arrived' ||
      config.filter === 'checked_in' ||
      config.filter === 'needs_attention' ||
      config.filter === 'arrived_pending'
        ? config.filter
        : 'arrived_pending',
    date: config.date === 'tomorrow' || config.date === 'all' || config.date === 'today' ? config.date : 'today',
  };
}

export function normalizeInventoryOverrides(value: unknown): Record<string, EasyModeInventoryOverride> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
      .map(([optionId, override]) => [
        optionId,
        {
          optionId,
          status:
            override.status === 'inactive' || override.status === 'sold_out' || override.status === 'available'
              ? override.status
              : 'available',
          remaining: typeof override.remaining === 'number' ? override.remaining : null,
          updatedAt: typeof override.updatedAt === 'string' ? override.updatedAt : '',
        },
      ]),
  );
}

export function formatDateLabel(dateText: string): string {
  if (!dateText) return '未設定';
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
