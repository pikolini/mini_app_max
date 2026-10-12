# ТРИЦ mini app (Telegram + MAX)

React + TypeScript + Vite.

## Запуск
```bash
npm install
cp .env.example .env     # VITE_USE_MOCK=true — работает без бэкенда
npm run dev
```
Тестовый ЛС в моке: любые 8 цифр (кроме 00000000 — он «не найден»).

## Подключение к мессенджерам
- Telegram: @BotFather → /newapp (или Menu Button у бота) → HTTPS-адрес сборки.
- MAX: кнопка/мини-приложение в настройках бота на платформе MAX → тот же HTTPS-адрес.
- Нужен HTTPS (Cloudflare Pages, Netlify, свой nginx и т.д.): `npm run build`, раздать `dist/`.

## Как решена проблема «ЛС забывается»
1. `lib/storage.ts` — Telegram CloudStorage + localStorage, без токенов с истечением.
2. `lib/api.ts` — каждый запрос несёт `X-Init-Data`. Бэкенд проверяет подпись и хранит
   связку `user_id мессенджера → лицевой счёт`. Это самый надёжный вариант.
