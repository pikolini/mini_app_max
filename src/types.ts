export type MeterKind = 'electricity' | 'cold' | 'hot';

export interface Meter {
  id: string;
  kind: MeterKind;
  title: string;
  serial: string;
  unit: string;
  /** Последнее принятое показание */
  value: number;
  /** Дата последнего показания, ISO */
  date: string;
}

export interface AccountInfo {
  account: string;
  address: string;
  /** Задолженность в рублях, 0 — долга нет */
  debt: number;
  meters: Meter[];
}


/** Вариант адреса из результатов поиска */
export interface AddressMatch {
  id: string;
  /** Полный адрес для показа, например «ул. Гагарина, д. 12А» */
  label: string;
}