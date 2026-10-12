import type { AccountInfo, AddressMatch } from '../types';
import { initData, platform } from './platform';
import {
  BadResponseError,
  mapAccount,
  mapAddresses,
  mapChatUrl,
  type AccountDto,
  type AddressDto,
  type HouseChatDto,
} from './dto';

// Мок включается, если так задано в .env или если адрес API не указан.
const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL;
const API_URL: string = import.meta.env.VITE_API_URL ?? '';
const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export const ACCOUNT_RE = /^\d{8}$/;

export interface Api {
  /** Лицевой счёт, привязанный к пользователю мессенджера на бэкенде (или null) */
  getBoundAccount(): Promise<string | null>;
  /** Снять привязку, когда пользователь меняет счёт */
  unbindAccount(): Promise<void>;
  getAccountInfo(account: string): Promise<AccountInfo>;
  submitReading(account: string, meterId: string, value: number): Promise<AccountInfo>;
  /** Варианты адресов по улице и номеру дома; самый близкий — первым. Пустой массив — ничего не найдено. */
  searchAddresses(street: string, house: string): Promise<AddressMatch[]>;
  /** Ссылка на чат дома или null, если чата нет */
  findHouseChat(addressId: string): Promise<string | null>;
}

/* ---------- Реальный API ---------- */
// Эндпоинты — предположение, подстройте под ваш бэкенд:
//   GET    /me/account              → { "account": "12345678" } | 404
//   DELETE /me/account
//   GET    /accounts/{account}      → AccountDto (см. dto.ts); бэкенд заодно привязывает счёт к пользователю
//   POST   /accounts/{account}/readings  { meter_id, value } → AccountDto
//   GET    /addresses/search?street=…&house=…   → AddressDto[] (по убыванию близости)
//   GET    /addresses/{id}/chat?platform=telegram|max → { url } | 404 если чата нет

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        // Подписанные данные от мессенджера — бэкенд проверяет подпись
        // и узнаёт пользователя без токенов, которые могут протухнуть.
        'X-Init-Data': initData,
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) throw new ApiError('Не найдено.', 404);
  if (res.status === 401 || res.status === 403) {
    throw new ApiError('Не удалось подтвердить пользователя. Закройте и откройте приложение заново.', res.status);
  }
  if (res.status === 400 || res.status === 422) {
    // Если сервер прислал понятное сообщение — показываем его
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Сервер не принял данные. Проверьте введённое значение.', res.status);
  }
  if (!res.ok) throw new ApiError('Сервер временно недоступен. Попробуйте позже.', res.status);

  if (res.status === 204) return undefined as T;
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new ApiError('Сервер вернул неожиданный ответ. Попробуйте позже.');
  }
  return res.json() as Promise<T>;
}

/** Ошибки неверного формата ответа превращаем в понятное пользователю сообщение. */
function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof BadResponseError) throw new ApiError('Сервер вернул некорректные данные.');
    throw e;
  }
}

const ACCOUNT_NOT_FOUND = 'Лицевой счёт не найден. Проверьте номер.';

const realApi: Api = {
  async getBoundAccount() {
    try {
      const r = await http<{ account?: string }>('/me/account');
      return r?.account && ACCOUNT_RE.test(r.account) ? r.account : null;
    } catch {
      return null; // нет привязки или бэкенд её не поддерживает — не критично
    }
  },
  async unbindAccount() {
    try {
      await http<void>('/me/account', { method: 'DELETE' });
    } catch {
      /* не критично */
    }
  },
  async getAccountInfo(account) {
    try {
      const dto = await http<AccountDto>(`/accounts/${account}`);
      return guard(() => mapAccount(dto));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw new ApiError(ACCOUNT_NOT_FOUND, 404);
      throw e;
    }
  },
  async submitReading(account, meterId, value) {
    const dto = await http<AccountDto>(`/accounts/${account}/readings`, {
      method: 'POST',
      body: JSON.stringify({ meter_id: meterId, value }),
    });
    return guard(() => mapAccount(dto));
  },
  async searchAddresses(street, house) {
    const q = new URLSearchParams({ street, house });
    try {
      const dtos = await http<AddressDto[]>(`/addresses/search?${q}`);
      return guard(() => mapAddresses(dtos));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return [];
      throw e;
    }
  },
  async findHouseChat(addressId) {
    try {
      // Бэкенд отдаёт ссылку именно для того мессенджера, из которого пришёл пользователь
      const dto = await http<HouseChatDto>(
        `/addresses/${encodeURIComponent(addressId)}/chat?platform=${platform}`,
      );
      return mapChatUrl(dto);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
};

/* ---------- Мок ---------- */
// Отдаёт данные в «сыром» формате бэкенда и проходит через те же мапперы,
// поэтому на моке проверяется и преобразование.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let mockDto: AccountDto | null = null;
let mockBound: string | null = null;

const MOCK_ADDRESSES: AddressDto[] = [
  { id: 1, full_address: 'ул. Гагарина, д. 12' },
  { id: 2, full_address: 'ул. Гагарина, д. 12А' },
  { id: 3, full_address: 'ул. Гагарина, д. 14' },
  { id: 4, full_address: 'пр-т Ленина, д. 5' },
  { id: 5, full_address: 'ул. Садовая, д. 3' },
];
// Чаты есть не у всех домов
const MOCK_CHATS: Record<string, string> = {
  '1': 'https://t.me/+gagarina12example',
  '4': 'https://t.me/+lenina5example',
};

const normStreet = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е')
    .replace(/\b(улица|ул|проспект|пр-т|пр|переулок|пер)\b\.?/g, '')
    .replace(/[^а-яa-z0-9]+/g, ' ').trim();

const mockApi: Api = {
  async getBoundAccount() {
    return mockBound;
  },
  async unbindAccount() {
    mockBound = null;
  },
  async getAccountInfo(account) {
    await sleep(600);
    if (account === '00000000') throw new ApiError(ACCOUNT_NOT_FOUND, 404);
    mockDto ??= {
      account,
      address: 'ул. Гагарина, д. 12, кв. 47',
      debt: '1842,50',
      meters: [
        { id: 1, type: 'electricity', serial: '0418273', last_value: 14382, last_date: '2026-09-24' },
        { id: 2, type: 'cold_water', serial: '77120931', last_value: '214,318', last_date: '2026-09-24' },
        { id: 3, type: 'hot_water', serial: '77120932', last_value: '98,642', last_date: '2026-09-24' },
      ],
    };
    mockBound = account;
    return guard(() => mapAccount({ ...mockDto!, account }));
  },
  async submitReading(account, meterId, value) {
    await sleep(500);
    if (!mockDto) throw new ApiError('Сессия потеряна. Откройте счёт заново.');
    mockDto = {
      ...mockDto,
      meters: mockDto.meters.map((m) =>
        String(m.id) === meterId
          ? { ...m, last_value: value, last_date: new Date().toISOString().slice(0, 10) }
          : m,
      ),
    };
    return guard(() => mapAccount({ ...mockDto!, account }));
  },
  async searchAddresses(street, house) {
    await sleep(400);
    const s = normStreet(street);
    const h = house.toLowerCase().replace(/\s/g, '');
    const houseOf = (a: AddressDto) => (/д\.\s*(\S+)$/.exec(a.full_address)?.[1] ?? '').toLowerCase();
    const rank = (a: AddressDto) => (houseOf(a) === h ? 0 : houseOf(a).startsWith(h) ? 1 : 2);
    const found = MOCK_ADDRESSES
      .filter((a) => normStreet(a.full_address.split(',')[0]).includes(s))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 5);
    return guard(() => mapAddresses(found));
  },
  async findHouseChat(addressId) {
    await sleep(400);
    return mapChatUrl({ url: MOCK_CHATS[addressId] ?? null });
  },
};

export const api: Api = USE_MOCK ? mockApi : realApi;