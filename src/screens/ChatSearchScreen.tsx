import { useState } from 'react';
import type { AddressMatch } from '../types';
import { api, ApiError } from '../lib/api';
import { haptic, openLink } from '../lib/platform';

type Step = 'form' | 'pick' | 'result';

const errText = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.';

export default function ChatSearchScreen() {
  const [step, setStep] = useState<Step>('form');
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [matches, setMatches] = useState<AddressMatch[]>([]);
  const [selected, setSelected] = useState<AddressMatch | null>(null);
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = street.trim().length >= 2 && house.trim().length >= 1;

  const search = async () => {
    if (!canSearch || busy) return;
    setBusy(true);
    setError(null);
    try {
      const found = await api.searchAddresses(street.trim(), house.trim());
      if (found.length === 0) {
        haptic('error');
        setError('Такой адрес не найден. Проверьте написание улицы и номер дома.');
      } else {
        setMatches(found);
        setStep('pick');
      }
    } catch (e) {
      haptic('error');
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = async (m: AddressMatch) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await api.findHouseChat(m.id);
      setSelected(m);
      setChatUrl(url);
      haptic(url ? 'success' : 'tap');
      setStep('result');
    } catch (e) {
      haptic('error');
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const backToForm = () => {
    setStep('form');
    setError(null);
  };

  /* ---------- Шаг 1: ввод адреса ---------- */
  if (step === 'form') {
    return (
      <section className="screen">
        <h1 className="title">Найти чат дома</h1>
        <p className="lead">Введите улицу и номер дома. «ул.» и «проспект» писать не нужно.</p>

        <div className="field">
          <label className="label" htmlFor="street">Улица</label>
          <input
            id="street"
            className="input"
            placeholder="Гагарина"
            autoComplete="off"
            value={street}
            onChange={(e) => { setStreet(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="house">Номер дома</label>
          <input
            id="house"
            className={`input${error ? ' has-error' : ''}`}
            placeholder="12А"
            autoComplete="off"
            maxLength={10}
            value={house}
            onChange={(e) => { setHouse(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            aria-invalid={!!error}
            aria-describedby="chat-msg"
          />
          <span id="chat-msg" className={`msg${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>
            {error ?? 'Корпус и литеру добавьте к номеру: 12А, 5к2'}
          </span>
        </div>

        <div className="footer">
          <button className="btn primary" onClick={search} disabled={!canSearch || busy}>
            {busy ? 'Ищем…' : 'Найти адрес'}
          </button>
        </div>
      </section>
    );
  }

  /* ---------- Шаг 2: выбор адреса ---------- */
  if (step === 'pick') {
    return (
      <section className="screen">
        <h1 className="title">Выберите адрес</h1>
        <p className="lead">Нашли {matches.length === 1 ? 'один вариант' : 'несколько вариантов'} по запросу «{street.trim()}, {house.trim()}».</p>

        <ul className="options">
          {matches.map((m) => (
            <li key={m.id}>
              <button className="option" onClick={() => choose(m)} disabled={busy}>
                {m.label}
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="msg error" role="alert">{error}</p>}

        <button className="link" onClick={backToForm}>Изменить запрос</button>
      </section>
    );
  }

  /* ---------- Шаг 3: результат ---------- */
  return (
    <section className="screen">
      <h1 className="title">{selected?.label}</h1>

      {chatUrl ? (
        <>
          <p className="lead">Чат этого дома есть. Он откроется в мессенджере.</p>
          <div className="footer">
            <button className="btn primary" onClick={() => openLink(chatUrl)}>
              Открыть чат
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="lead">Для этого дома чата пока нет. Если он нужен, напишите в поддержку ТРИЦ.</p>
          <div className="footer">
            <button className="btn secondary" onClick={() => setStep('pick')}>
              Выбрать другой адрес
            </button>
          </div>
        </>
      )}

      <button className="link" onClick={() => { setStep('form'); setError(null); }}>
        Искать другой дом
      </button>
    </section>
  );
}
