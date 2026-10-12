import { useState } from 'react';
import type { AccountInfo, Meter } from '../types';
import { api, ApiError } from '../lib/api';
import { haptic } from '../lib/platform';
import { MeterDigits, formatDate, formatMoney } from '../components';

interface Props {
  data: AccountInfo;
  onUpdate: (d: AccountInfo) => void;
  onChangeAccount: () => void;
}

export default function ReadingsScreen({ data, onUpdate, onChangeAccount }: Props) {
  return (
    <section className="screen readings">
      <header className="head">
        <p className="account-line">Лицевой счёт {data.account}</p>
        <p className="address">{data.address}</p>
      </header>

      <div className={`debt${data.debt > 0 ? ' has-debt' : ''}`}>
        <span className="debt-label">{data.debt > 0 ? 'К оплате' : 'Задолженности нет'}</span>
        {data.debt > 0 && <span className="debt-sum">{formatMoney(data.debt)}</span>}
      </div>

      <ul className="meters">
        {data.meters.map((m) => (
          <MeterCard key={m.id} meter={m} account={data.account} onUpdate={onUpdate} />
        ))}
      </ul>

      <button className="link" onClick={onChangeAccount}>
        Указать другой лицевой счёт
      </button>
    </section>
  );
}

function MeterCard({
  meter,
  account,
  onUpdate,
}: {
  meter: Meter;
  account: string;
  onUpdate: (d: AccountInfo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    const value = Number(raw.replace(',', '.'));
    if (!raw || Number.isNaN(value)) return setError('Введите число');
    if (value < meter.value) {
      return setError(`Не меньше предыдущего: ${String(meter.value).replace('.', ',')}`);
    }
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.submitReading(account, meter.id, value));
      haptic('success');
      setSent(true);
      setOpen(false);
      setRaw('');
    } catch (e) {
      haptic('error');
      setError(e instanceof ApiError ? e.message : 'Не удалось отправить. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`meter ${meter.kind}`}>
      <div className="meter-head">
        <span className="meter-title">{meter.title}</span>
        <span className="meter-sub">
          {meter.serial} · {sent ? 'передано сегодня' : `от ${formatDate(meter.date)}`}
        </span>
      </div>

      <div className="meter-body">
        <MeterDigits value={meter.value} kind={meter.kind} />
        <span className="unit">{meter.unit}</span>
      </div>

      {!open ? (
        <button className="btn secondary" onClick={() => setOpen(true)}>
          Передать новое показание
        </button>
      ) : (
        <div className="submit">
          <input
            className={`input${error ? ' has-error' : ''}`}
            inputMode="decimal"
            placeholder={`Текущее, ${meter.unit}`}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value.replace(/[^\d.,]/g, ''));
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            autoFocus
          />
          {error && <span className="msg error" role="alert">{error}</span>}
          <div className="row">
            <button className="btn primary" onClick={send} disabled={busy}>
              {busy ? 'Отправляем…' : 'Отправить'}
            </button>
            <button className="btn ghost" onClick={() => { setOpen(false); setError(null); }}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
