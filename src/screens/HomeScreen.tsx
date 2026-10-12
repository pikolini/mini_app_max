import { useState } from 'react';

interface Props {
  savedAccount: string | null;
  onStart: () => Promise<void>;
  onFindChat: () => void;
}

export default function HomeScreen({ savedAccount, onStart, onFindChat }: Props) {
  const [busy, setBusy] = useState(false);

  const click = async () => {
    setBusy(true);
    await onStart();
    setBusy(false);
  };

  return (
    <section className="screen home">
      <div className="home-top">
        <h1 className="brand">ТРИЦ</h1>
        <p className="lead">
          Показания счётчиков, задолженность и чат вашего дома — в одном месте.
        </p>
      </div>

      <div className="home-bottom">
        {savedAccount && (
          <p className="hint">Лицевой счёт {savedAccount} сохранён</p>
        )}
        <div className="stack">
          <button className="btn primary" onClick={click} disabled={busy}>
            {busy ? 'Загружаем…' : 'Передать показания'}
          </button>
          <button className="btn secondary" onClick={onFindChat} disabled={busy}>
            Найти чат дома
          </button>
        </div>
      </div>
    </section>
  );
}