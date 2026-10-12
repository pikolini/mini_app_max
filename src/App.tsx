import { useCallback, useEffect, useState } from 'react';
import type { AccountInfo } from './types';
import { api, ApiError, ACCOUNT_RE } from './lib/api';
import { ACCOUNT_KEY, storage } from './lib/storage';
import { haptic, setBackButton } from './lib/platform';
import HomeScreen from './screens/HomeScreen';
import AccountScreen from './screens/AccountScreen';
import ReadingsScreen from './screens/ReadingScreen';
import ChatSearchScreen from './screens/ChatSearchScreen';

type Screen = 'home' | 'account' | 'readings' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [savedAccount, setSavedAccount] = useState<string | null>(null);
  const [data, setData] = useState<AccountInfo | null>(null);
  const [booting, setBooting] = useState(true);

  // Запоминаем лицевой счёт — повторно вводить не придётся
  useEffect(() => {
    (async () => {
      // 1) быстрый кэш на устройстве, 2) привязка на бэкенде (если кэш пуст)
      let acc = await storage.get(ACCOUNT_KEY);
      if (!acc || !ACCOUNT_RE.test(acc)) {
        acc = await api.getBoundAccount();
        if (acc) await storage.set(ACCOUNT_KEY, acc);
      }
      if (acc && ACCOUNT_RE.test(acc)) setSavedAccount(acc);
      setBooting(false);
    })();
  }, []);

  // Кнопка «Назад» в шапке мессенджера
  useEffect(() => {
    if (screen === 'home') return setBackButton(false);
    return setBackButton(true, () => setScreen('home'));
  }, [screen]);

  const loadAccount = useCallback(async (account: string): Promise<string | null> => {
    try {
      const info = await api.getAccountInfo(account);
      setData(info);
      setSavedAccount(account);
      await storage.set(ACCOUNT_KEY, account);
      haptic('success');
      setScreen('readings');
      return null;
    } catch (e) {
      haptic('error');
      return e instanceof ApiError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.';
    }
  }, []);

  const handleStart = async () => {
    if (!savedAccount) return setScreen('account');
    const error = await loadAccount(savedAccount);
    if (error) setScreen('account'); // сохранённый счёт больше не работает
  };

  const handleChangeAccount = async () => {
    await Promise.all([storage.remove(ACCOUNT_KEY), api.unbindAccount()]);
    setSavedAccount(null);
    setData(null);
    setScreen('account');
  };

  if (booting) return <div className="boot" aria-busy="true" />;

  return (
    <main className="app">
      {screen === 'home' && (
        <HomeScreen
          savedAccount={savedAccount}
          onStart={handleStart}
          onFindChat={() => setScreen('chat')}
        />
      )}
      {screen === 'account' && (
        <AccountScreen initial={savedAccount ?? ''} onSubmit={loadAccount} />
      )}
      {screen === 'readings' && data && (
        <ReadingsScreen
          data={data}
          onUpdate={setData}
          onChangeAccount={handleChangeAccount}
        />
      )}
      {screen === 'chat' && <ChatSearchScreen />}
    </main>
  );
}
