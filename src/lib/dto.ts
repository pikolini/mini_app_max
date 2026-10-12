import type { AccountInfo, AddressMatch, Meter, MeterKind } from '../types';

/**
 * Контракт с бэкендом — «сырой» формат ответа.
 * Если у вас другие названия полей, меняйте ТОЛЬКО этот файл:
 * экраны работают с AccountInfo и про формат сервера ничего не знают.
 */
export interface MeterDto {
  id: string | number;
  /** Код типа счётчика */
  type: string;
  serial?: string | null;
  /** Последнее принятое показание (число или строка вида "1 234,567") */
  last_value: number | string;
  /** Дата последнего показания (ISO или любая строка, понятная Date) */
  last_date: string;
  unit?: string | null;
}

export interface AccountDto {
  account: string;
  address?: string | null;
  /** Долг в рублях; может прийти строкой */
  debt: number | string;
  meters: MeterDto[];
}

/* Соответствие кодов бэкенда типам в интерфейсе. Добавьте свои коды. */
const KIND_BY_CODE: Record<string, MeterKind> = {
  electricity: 'electricity',
  electric: 'electricity',
  el: 'electricity',
  cold_water: 'cold',
  cold: 'cold',
  cw: 'cold',
  hot_water: 'hot',
  hot: 'hot',
  hw: 'hot',
};

const TITLE: Record<MeterKind, string> = {
  electricity: 'Электричество',
  cold: 'Холодная вода',
  hot: 'Горячая вода',
};

const DEFAULT_UNIT: Record<MeterKind, string> = {
  electricity: 'кВт·ч',
  cold: 'м³',
  hot: 'м³',
};

/** "1 234,56" | "1234.56" | 1234.56 → 1234.56; мусор → NaN */
export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  return Number(v.replace(/\s|\u00a0/g, '').replace(',', '.'));
}

export class BadResponseError extends Error {}

function mapMeter(dto: MeterDto): Meter | null {
  const kind = KIND_BY_CODE[String(dto.type).toLowerCase()];
  if (!kind) {
    console.warn('Неизвестный тип счётчика, пропускаем:', dto.type);
    return null;
  }
  const value = parseNumber(dto.last_value);
  if (Number.isNaN(value)) {
    console.warn('Некорректное показание, пропускаем:', dto);
    return null;
  }
  return {
    id: String(dto.id),
    kind,
    title: TITLE[kind],
    serial: dto.serial ? `№ ${dto.serial}` : '',
    unit: dto.unit || DEFAULT_UNIT[kind],
    value,
    date: dto.last_date,
  };
}

/** Проверяет и преобразует ответ сервера. Бросает BadResponseError, если ответ непригоден. */
export function mapAccount(dto: AccountDto): AccountInfo {
  if (!dto || typeof dto.account !== 'string' || !Array.isArray(dto.meters)) {
    throw new BadResponseError('Неверный формат ответа сервера');
  }
  const debt = parseNumber(dto.debt ?? 0);
  return {
    account: dto.account,
    address: dto.address ?? '',
    debt: Number.isNaN(debt) ? 0 : Math.max(debt, 0),
    meters: dto.meters.map(mapMeter).filter((m): m is Meter => m !== null),
  };
}

/* ---------- Поиск адреса и чата дома ---------- */

export interface AddressDto {
  id: string | number;
  full_address: string;
}

export interface HouseChatDto {
  /** Ссылка на чат; null/отсутствует — чата нет */
  url?: string | null;
}

/** Бэкенд присылает варианты уже отсортированными: самый близкий первым. */
export function mapAddresses(dtos: AddressDto[]): AddressMatch[] {
  if (!Array.isArray(dtos)) throw new BadResponseError('Неверный формат списка адресов');
  return dtos
    .filter((a) => a && a.id != null && typeof a.full_address === 'string' && a.full_address.trim())
    .map((a) => ({ id: String(a.id), label: a.full_address.trim() }));
}

/** Пропускаем только https-ссылки: защита от javascript: и прочего. */
export function mapChatUrl(dto: HouseChatDto | null | undefined): string | null {
  if (!dto?.url) return null;
  try {
    const u = new URL(dto.url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}