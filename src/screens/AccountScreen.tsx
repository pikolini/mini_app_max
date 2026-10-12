import { useState } from 'react';
import { ACCOUNT_RE } from '../lib/api';

interface Props {
  initial: string;
  /** Возвращает текст ошибки или null, если всё хорошо */
  onSubmit: (account: string) => Promise<string | null>;
}

export default function AccountScreen({ initial, onSubmit }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = ACCOUNT_RE.test(value);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(value);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <section className="screen">
      <h1 className="title">Укажите лицевой счёт</h1>
      <p className="lead">8 цифр из квитанции. Мы запомним номер, и в следующий раз вводить его не придётся.</p>

      <label className="field">
        <input
          className={`input account-input${error ? ' has-error' : ''}`}
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          placeholder="00000000"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, '').slice(0, 8));
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-invalid={!!error}
          aria-describedby="account-msg"
          autoFocus
        />
        <span id="account-msg" className={`msg${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>
          {error ?? `${value.length} из 8 цифр`}
        </span>
      </label>

      <div className="footer">
        <button className="btn primary" onClick={submit} disabled={!valid || busy}>
          {busy ? 'Проверяем…' : 'Показать данные'}
        </button>
      </div>
    </section>
  );
}
