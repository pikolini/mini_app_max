/**
 * Единая обёртка над Telegram WebApp и MAX WebApp.
 * Оба моста почти одинаковы по API (initData, BackButton, HapticFeedback, ready/expand),
 * поэтому достаточно найти, какой из них реально запущен.
 */

export type PlatformName = 'telegram' | 'max' | 'web';

/* eslint-disable @typescript-eslint/no-explicit-any */
const w = window as any;

export function detectPlatform(): PlatformName {
  if (w.Telegram?.WebApp?.initData) return 'telegram';
  if (w.WebApp?.initData) return 'max';
  return 'web';
}

export const platform = detectPlatform();

export const webApp: any =
  platform === 'telegram' ? w.Telegram.WebApp : platform === 'max' ? w.WebApp : null;

/** Подписанные данные пользователя — бэкенд проверяет подпись и узнаёт, кто пришёл. */
export const initData: string = webApp?.initData ?? '';

export function initPlatform(): void {
  webApp?.ready?.();
  webApp?.expand?.();
  const scheme = webApp?.colorScheme;
  if (scheme) document.documentElement.dataset.theme = scheme;
}

export function haptic(kind: 'success' | 'error' | 'tap'): void {
  const h = webApp?.HapticFeedback;
  if (!h) return;
  if (kind === 'tap') h.impactOccurred?.('light');
  else h.notificationOccurred?.(kind);
}

export function setBackButton(visible: boolean, onClick?: () => void): () => void {
  const bb = webApp?.BackButton;
  if (!bb) return () => {};
  if (visible && onClick) {
    bb.onClick?.(onClick);
    bb.show?.();
    return () => {
      bb.offClick?.(onClick);
    };
  }
  bb.hide?.();
  return () => {};
}


/** Открывает ссылку средствами мессенджера (ссылки на чаты — внутри приложения). */
export function openLink(url: string): void {
  if (platform === 'telegram' && /^https:\/\/t\.me\//.test(url) && webApp?.openTelegramLink) {
    return webApp.openTelegramLink(url);
  }
  if (platform === 'max' && /^https:\/\/max\.ru\//.test(url) && webApp?.openMaxLink) {
    return webApp.openMaxLink(url);
  }
  if (webApp?.openLink) return webApp.openLink(url);
  window.open(url, '_blank', 'noopener');
}