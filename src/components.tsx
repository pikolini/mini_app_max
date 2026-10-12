import type { MeterKind } from './types';

/** Барабан счётчика: целые цифры на тёмном фоне, дробные — на красном, как на настоящем. */
export function MeterDigits({ value, kind }: { value: number; kind: MeterKind }) {
  const decimals = kind === 'electricity' ? 0 : 3;
  const intLen = kind === 'electricity' ? 6 : 5;
  const [i, f = ''] = value.toFixed(decimals).split('.');
  const intPart = i.padStart(intLen, '0');

  return (
    <div className="drum" role="img" aria-label={`Показание ${value.toFixed(decimals).replace('.', ',')}`}>
      {intPart.split('').map((d, idx) => (
        <span key={`i${idx}`} className="digit">{d}</span>
      ))}
      {f.split('').map((d, idx) => (
        <span key={`f${idx}`} className="digit frac">{d}</span>
      ))}
    </div>
  );
}

export const formatMoney = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(iso));