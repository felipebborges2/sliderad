import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function ServerWakeup() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'slow' | 'ready'

  useEffect(() => {
    let timer;
    let cancelled = false;

    // Se demorar mais de 2s, mostra o aviso
    timer = setTimeout(() => {
      if (!cancelled) setStatus('slow');
    }, 2000);

    api.get('/api/health')
      .then(() => {
        if (!cancelled) {
          clearTimeout(timer);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timer);
          setStatus('ready'); // não bloqueia o app mesmo se falhar
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (status !== 'slow') return null;

  return (
    <div style={styles.banner}>
      <span style={styles.spinner} />
      <span>
        Servidor iniciando, aguarde um momento…
        <span style={styles.sub}> (pode levar até 1 minuto na primeira vez do dia)</span>
      </span>
    </div>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: 'rgba(15, 30, 55, 0.97)',
    borderBottom: '1px solid rgba(79, 195, 247, 0.25)',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: 'var(--white-dim)',
  },
  sub: {
    color: 'var(--muted)',
    fontSize: 12,
  },
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(79,195,247,0.2)',
    borderTopColor: '#4fc3f7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
};
