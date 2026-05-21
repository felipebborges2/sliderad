import { useState, useEffect } from 'react';
import api from '../lib/api';

const formatarData = iso => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function BibliotecaSelector({ onSelecionar }) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [carregado, setCarregado] = useState(false);

  // Load items with content when section is expanded
  useEffect(() => {
    if (!aberto || carregado) return;
    setCarregando(true);
    api.get('/api/biblioteca?comConteudo=true')
      .then(r => {
        setItens(r.data.itens || []);
        setCarregado(true);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [aberto, carregado]);

  const toggleItem = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      // Build concatenated context from selected items
      const contexto = itens
        .filter(item => next.has(item.id))
        .map(item => `=== BIBLIOTECA: ${item.nome} ===\n${item.conteudo || ''}`)
        .join('\n\n');

      onSelecionar(contexto);
      return next;
    });
  };

  return (
    <div style={bs.wrapper}>
      <button
        onClick={() => setAberto(a => !a)}
        style={bs.toggleBtn}
        type="button"
      >
        <span>📚 Usar da biblioteca</span>
        <span style={{ ...bs.chevron, transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {aberto && (
        <div style={bs.panel}>
          {carregando ? (
            <div style={bs.info}>
              <span className="spinner" style={{ width: 12, height: 12 }} /> Carregando biblioteca...
            </div>
          ) : itens.length === 0 ? (
            <div style={bs.info}>
              Biblioteca vazia. Adicione referências na aba Perfil.
            </div>
          ) : (
            <div style={bs.lista}>
              {itens.map(item => (
                <label key={item.id} style={bs.itemLabel}>
                  <input
                    type="checkbox"
                    checked={selecionados.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    style={bs.checkbox}
                  />
                  <div style={bs.itemInfo}>
                    <span style={bs.itemNome}>{item.nome}</span>
                    <div style={bs.itemMeta}>
                      <span style={bs.tipoBadge}>{item.tipo.toUpperCase()}</span>
                      <span style={bs.itemData}>{formatarData(item.adicionadoEm)}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {selecionados.size > 0 && (
            <div style={bs.selecaoInfo}>
              {selecionados.size} item{selecionados.size > 1 ? 's' : ''} selecionado{selecionados.size > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const bs = {
  wrapper: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
  },
  toggleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'var(--navy2)',
    color: 'var(--white-dim)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    textAlign: 'left',
  },
  chevron: {
    fontSize: 14,
    color: 'var(--muted)',
    transition: 'transform 0.2s',
    flexShrink: 0,
  },
  panel: {
    borderTop: '1px solid var(--border)',
    background: 'var(--card)',
    padding: '10px 14px 12px',
  },
  info: {
    fontSize: 12,
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
    fontStyle: 'italic',
  },
  lista: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  itemLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '7px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    background: 'var(--navy2)',
    border: '1px solid var(--border)',
  },
  checkbox: {
    marginTop: 2,
    accentColor: 'var(--cyan)',
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemNome: {
    fontSize: 12,
    color: 'var(--white)',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  tipoBadge: {
    fontSize: 10,
    color: 'var(--cyan)',
    background: 'rgba(79,195,247,0.1)',
    border: '1px solid rgba(79,195,247,0.25)',
    borderRadius: 4,
    padding: '1px 5px',
    fontWeight: 600,
  },
  itemData: {
    fontSize: 10,
    color: 'var(--muted)',
  },
  selecaoInfo: {
    marginTop: 8,
    fontSize: 11,
    color: 'var(--cyan)',
    fontWeight: 600,
  },
};
