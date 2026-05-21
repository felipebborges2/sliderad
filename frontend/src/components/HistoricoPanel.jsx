import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function HistoricoPanel() {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baixando, setBaixando] = useState(null);

  const carregar = async () => {
    try {
      const { data } = await api.get('/api/historico');
      setHistorico(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const baixar = async (item) => {
    setBaixando(item.id);
    try {
      const resp = await api.get(`/api/apresentacao/download/${item.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${item.tema}.pptx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao baixar arquivo');
    } finally {
      setBaixando(null);
    }
  };

  const deletar = async (id) => {
    if (!window.confirm('Remover do histórico?')) return;
    try {
      await api.delete(`/api/historico/${id}`);
      setHistorico(h => h.filter(x => x.id !== id));
    } catch {}
  };

  const formatarData = iso => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div style={s.container} className="fade-in">
      <div style={s.header}>
        <h1 style={s.h1}>Histórico de apresentações</h1>
        <div style={s.count}>{historico.length} apresentação{historico.length !== 1 ? 'ões' : ''}</div>
      </div>

      {historico.length === 0 ? (
        <div style={s.vazio}>
          <div style={s.vazioIcon}>📋</div>
          <div>Nenhuma apresentação gerada ainda</div>
          <div style={s.vazioSub}>Vá para a aba Gerar para criar sua primeira apresentação</div>
        </div>
      ) : (
        <div style={s.lista}>
          {historico.map(item => (
            <div key={item.id} style={s.item}>
              <div style={s.itemIcone}>📊</div>
              <div style={s.itemInfo}>
                <div style={s.itemTitulo}>{item.titulo || item.tema}</div>
                {item.titulo && item.titulo !== item.tema && (
                  <div style={s.itemTema}>Tema: {item.tema}</div>
                )}
                <div style={s.itemMeta}>
                  <span>🗓 {formatarData(item.criadoEm)}</span>
                  <span>·</span>
                  <span>{item.numSlides} slides</span>
                  {item.numArquivos > 0 && <><span>·</span><span>📎 {item.numArquivos} referência{item.numArquivos > 1 ? 's' : ''}</span></>}
                </div>
                {item.arquivos?.length > 0 && (
                  <div style={s.arquivoTags}>
                    {item.arquivos.map((a, i) => (
                      <span key={i} style={s.tag}>{a.nome}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={s.itemAcoes}>
                <button
                  onClick={() => baixar(item)}
                  disabled={baixando === item.id}
                  style={s.btnBaixar}
                >
                  {baixando === item.id ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '⬇ Baixar'}
                </button>
                <button onClick={() => deletar(item.id)} style={s.btnDel}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  container: { maxWidth: 860, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  h1: { fontSize: 26, fontWeight: 800, color: 'var(--white)' },
  count: { fontSize: 13, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px' },
  vazio: { textAlign: 'center', padding: '64px 24px', color: 'var(--muted)' },
  vazioIcon: { fontSize: 48, marginBottom: 16 },
  vazioSub: { fontSize: 13, marginTop: 6, color: 'var(--muted)', opacity: 0.7 },
  lista: { display: 'flex', flexDirection: 'column', gap: 12 },
  item: { display: 'flex', alignItems: 'flex-start', gap: 14, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', transition: 'border-color 0.2s' },
  itemIcone: { fontSize: 24, flexShrink: 0, marginTop: 2 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitulo: { fontSize: 15, fontWeight: 600, color: 'var(--white)', marginBottom: 2 },
  itemTema: { fontSize: 13, color: 'var(--muted)', marginBottom: 4, fontStyle: 'italic' },
  itemMeta: { display: 'flex', gap: 8, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' },
  arquivoTags: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag: { fontSize: 11, background: 'rgba(79,195,247,0.08)', border: '1px solid rgba(79,195,247,0.2)', color: 'var(--cyan)', borderRadius: 4, padding: '2px 7px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemAcoes: { display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 },
  btnBaixar: { padding: '7px 14px', background: 'var(--blue)', color: 'var(--white)', fontSize: 12, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, minWidth: 88, justifyContent: 'center' },
  btnDel: { padding: '5px 10px', background: 'none', color: 'var(--muted)', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 },
};
