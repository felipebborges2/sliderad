import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      if (modo === 'login') await login(form.email, form.senha);
      else await register(form.nome, form.email, form.senha);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card} className="fade-in">
        <div style={styles.logo}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="21" stroke="#4fc3f7" strokeWidth="1.5" />
            <path d="M22 10v24M10 22h24" stroke="#4fc3f7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="22" cy="22" r="5" fill="#4fc3f7" fillOpacity="0.2" stroke="#4fc3f7" strokeWidth="1.5" />
          </svg>
          <div>
            <div style={styles.logoName}>SlideRad</div>
            <div style={styles.logoSub}>Apresentações de Radioterapia</div>
          </div>
        </div>

        <div style={styles.tabs}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setModo(m)} style={{ ...styles.tab, ...(modo === m ? styles.tabActive : {}) }}>
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={styles.form}>
          {modo === 'register' && (
            <div style={styles.field}>
              <label style={styles.label}>Nome completo</label>
              <input value={form.nome} onChange={set('nome')} placeholder="Dra. Ana Silva" required />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>E-mail</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="seu@email.com" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input type="password" value={form.senha} onChange={set('senha')} placeholder="••••••••" required minLength={6} />
          </div>

          {erro && <div style={styles.erro}>{erro}</div>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? <><span className="spinner" style={{ marginRight: 8 }} />{modo === 'login' ? 'Entrando...' : 'Criando conta...'}</> : (modo === 'login' ? 'Entrar' : 'Criar conta')}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' },
  bg: { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(26,110,181,0.18) 0%, transparent 70%)', pointerEvents: 'none' },
  card: { width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', boxShadow: 'var(--shadow)', position: 'relative', zIndex: 1 },
  logo: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 },
  logoName: { fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 22, color: 'var(--white)', lineHeight: 1.1 },
  logoSub: { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  tabs: { display: 'flex', gap: 4, marginBottom: 28, background: 'var(--navy2)', borderRadius: 8, padding: 4 },
  tab: { flex: 1, padding: '8px 0', background: 'none', color: 'var(--muted)', fontSize: 14, borderRadius: 6 },
  tabActive: { background: 'var(--blue)', color: 'var(--white)', boxShadow: '0 2px 8px rgba(26,110,181,0.3)' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: 'var(--white-dim)', fontWeight: 500 },
  erro: { background: 'rgba(239,83,80,0.12)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef9a9a' },
  btn: { marginTop: 8, padding: '13px', background: 'var(--blue)', color: 'var(--white)', fontSize: 15, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(26,110,181,0.35)' },
};
