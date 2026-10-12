import { platform, webApp } from './platform';

/**
 * Хранилище лицевого счёта на устройстве/аккаунте пользователя.
 *
 * 1. Telegram CloudStorage — привязано к аккаунту Telegram, живёт между сессиями и устройствами.
 * 2. localStorage — запасной вариант (MAX и обычный браузер).
 *
 * Надёжнее всего дополнительно хранить привязку «user id → лицевой счёт» на вашем бэкенде
 * (см. api.ts, заголовок X-Init-Data). Тогда ничего не «протухает» вообще.
 */

const cloud = platform === 'telegram' ? webApp?.CloudStorage : null;

function cloudGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!cloud?.getItem) return resolve(null);
    cloud.getItem(key, (err: unknown, value: string) => resolve(err || !value ? null : value));
  });
}

function cloudSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    if (!cloud?.setItem) return resolve();
    cloud.setItem(key, value, () => resolve());
  });
}

function cloudRemove(key: string): Promise<void> {
  return new Promise((resolve) => {
    if (!cloud?.removeItem) return resolve();
    cloud.removeItem(key, () => resolve());
  });
}

export const storage = {
  async get(key: string): Promise<string | null> {
    const fromCloud = await cloudGet(key);
    if (fromCloud) return fromCloud;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* приватный режим — не критично */
    }
    await cloudSet(key, value);
  },
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    await cloudRemove(key);
  },
};

export const ACCOUNT_KEY = 'tric_account';
