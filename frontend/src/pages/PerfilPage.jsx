import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../lib/api';

const FORMATOS_BIB = '.pdf,.pptx,.ppt,.docx,.doc,.txt,.md';
const MAX_MB_BIB = 50;

function formatarDataBib(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function BibliotecaSection() {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [adicionando, setAdicionando] = useState(false);
  const [removendo, setRemovendo] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [erro, setErro] = useState('');
  const [expandido, setExpandido] = useState(null);
  // Vincular state
  const [vincularAberto, setVincularAberto] = useState(null); // id do item sendo vinculado
  const [aulasDisponiveis, setAulasDisponiveis] = useState(null); // { apresentacoes, roteiros }
  const [aulasCarregando, setAulasCarregando] = useState(false);
  const [vinculando, setVinculando] = useState(new Set()); // Set<'tipo:aulaId'>
  const inputRef = useRef();

  const carregar = () => {
    setCarregando(true);
    api.get('/api/biblioteca?comUso=true')
      .then(r => setItens(r.data.itens || []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  };

  const carregarAulas = async () => {
    if (aulasDisponiveis) return;
    setAulasCarregando(true);
    try {
      const [histResp, rotResp] = await Promise.all([
        api.get('/api/historico'),
        api.get('/api/roteiro/lista'),
      ]);
      setAulasDisponiveis({
        apresentacoes: histResp.data || [],
        roteiros: rotResp.data.roteiros || [],
      });
    } catch {
      setAulasDisponiveis({ apresentacoes: [], roteiros: [] });
    } finally {
      setAulasCarregando(false);
    }
  };

  const abrirVincular = (itemId) => {
    setVincularAberto(itemId);
    setExpandido(null);
    carregarAulas();
  };

  const toggleVinculo = async (itemId, aulaId, aulaType, atualmenteVinculado) => {
    const key = `${aulaType}:${aulaId}`;
    setVinculando(prev => new Set(prev).add(key));
    try {
      await api.post('/api/biblioteca/vincular', {
        itemId, aulaId, aulaType, vincular: !atualmenteVinculado,
      });
      setItens(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const usadoEm = item.usadoEm || [];
        if (!atualmenteVinculado) {
          const listaAulas = aulaType === 'apresentacao'
            ? aulasDisponiveis.apresentacoes
            : aulasDisponiveis.roteiros;
          const aula = listaAulas.find(a => a.id === aulaId);
          return {
            ...item,
            usadoEm: [...usadoEm, {
              tipo: aulaType,
              id: aulaId,
              titulo: aula ? (aula.titulo || aula.tema) : 'Aula',
              criadoEm: aula ? aula.criadoEm : new Date().toISOString(),
            }],
          };
        } else {
          return {
            ...item,
            usadoEm: usadoEm.filter(u => !(u.tipo === aulaType && u.id === aulaId)),
          };
        }
      }));
    } catch {
      /* silencia erro de rede */
    } finally {
      setVinculando(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  useEffect(() => { carregar(); }, []);

  const addArquivos = useCallback(async (files) => {
    const validos = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return FORMATOS_BIB.includes(ext) && f.size <= MAX_MB_BIB * 1024 * 1024;
    });
    if (validos.length === 0) return;
    setAdicionando(true);
    setErro('');
    try {
      const form = new FormData();
      validos.forEach(f => form.append('arquivos', f));
      const resp = await api.post('/api/biblioteca/adicionar', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      setItens(prev => [...prev, ...(resp.data.itens || [])]);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao adicionar à biblioteca.');
    } finally {
      setAdicionando(false);
    }
  }, []);

  const remover = async (id) => {
    setRemovendo(id);
    try {
      await api.delete(`/api/biblioteca/${id}`);
      setItens(prev => prev.filter(i => i.id !== id));
    } catch {
      setErro('Erro ao remover item.');
    } finally {
      setRemovendo(null);
    }
  };

  const onDrop = e => {
    e.preventDefault();
    setDragging(false);
    addArquivos(e.dataTransfer.files);
  };

  const formatarTamanho = b => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div style={bib.section}>
      <div style={bib.sectionHeader}>
        <h3 style={bib.sectionTitle}>📚 Biblioteca de referências</h3>
        <p style={bib.sectionSub}>Salve artigos, protocolos e materiais de referência. Eles ficam disponíveis para usar em qualquer geração.</p>
      </div>

      <div style={bib.grid}>
        {/* Upload */}
        <div style={bib.card}>
          <div style={bib.cardLabel}>Adicionar referências</div>
          <div
            style={{ ...bib.dropzone, ...(dragging ? bib.dropzoneActive : {}) }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" multiple accept={FORMATOS_BIB} style={{ display: 'none' }} onChange={e => addArquivos(e.target.files)} />
            <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
            <div style={{ fontSize: 13, color: 'var(--white-dim)', marginBottom: 3 }}>Arraste ou clique para adicionar</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>PDF · PPTX · DOCX · TXT · MD · até 50 MB</div>
          </div>
          {adicionando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
              <span className="spinner" style={{ width: 12, height: 12 }} /> Extraindo e salvando...
            </div>
          )}
          {erro && <div style={bib.erro}>⚠ {erro}</div>}
        </div>

        {/* Lista / Painel de vinculação */}
        <div style={bib.card}>
          {vincularAberto ? (
            /* ── modo vincular ── */
            <>
              <div style={bib.vincularTop}>
                <button onClick={() => setVincularAberto(null)} style={bib.btnVoltar}>← Voltar</button>
                <div style={bib.cardLabel}>Vincular referência</div>
              </div>
              <div style={bib.vincularItemNome}>
                {itens.find(i => i.id === vincularAberto)?.nome}
              </div>

              {aulasCarregando ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                  <span className="spinner" style={{ width: 12, height: 12 }} /> Carregando aulas...
                </div>
              ) : !aulasDisponiveis || (aulasDisponiveis.apresentacoes.length === 0 && aulasDisponiveis.roteiros.length === 0) ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                  Nenhuma aula gerada ainda. Gere uma apresentação ou roteiro primeiro.
                </div>
              ) : (
                <div style={bib.aulaLista}>
                  {aulasDisponiveis.apresentacoes.length > 0 && (
                    <>
                      <div style={bib.aulaGrupoLabel}>⬡ Apresentações PPTX</div>
                      {aulasDisponiveis.apresentacoes.map(ap => {
                        const linked = (itens.find(i => i.id === vincularAberto)?.usadoEm || [])
                          .some(u => u.tipo === 'apresentacao' && u.id === ap.id);
                        const key = `apresentacao:${ap.id}`;
                        return (
                          <label key={ap.id} style={{ ...bib.aulaItem, opacity: vinculando.has(key) ? 0.6 : 1 }}>
                            <input
                              type="checkbox"
                              checked={linked}
                              disabled={vinculando.has(key)}
                              onChange={() => toggleVinculo(vincularAberto, ap.id, 'apresentacao', linked)}
                              style={bib.aulaCheck}
                            />
                            <div style={bib.aulaInfo}>
                              <span style={bib.aulaTitulo}>{ap.titulo || ap.tema}</span>
                              <span style={bib.aulaData}>{formatarDataBib(ap.criadoEm)}</span>
                            </div>
                          </label>
                        );
                      })}
                    </>
                  )}
                  {aulasDisponiveis.roteiros.length > 0 && (
                    <>
                      <div style={{ ...bib.aulaGrupoLabel, marginTop: aulasDisponiveis.apresentacoes.length > 0 ? 12 : 0 }}>✎ Roteiros</div>
                      {aulasDisponiveis.roteiros.map(rot => {
                        const linked = (itens.find(i => i.id === vincularAberto)?.usadoEm || [])
                          .some(u => u.tipo === 'roteiro' && u.id === rot.id);
                        const key = `roteiro:${rot.id}`;
                        return (
                          <label key={rot.id} style={{ ...bib.aulaItem, opacity: vinculando.has(key) ? 0.6 : 1 }}>
                            <input
                              type="checkbox"
                              checked={linked}
                              disabled={vinculando.has(key)}
                              onChange={() => toggleVinculo(vincularAberto, rot.id, 'roteiro', linked)}
                              style={bib.aulaCheck}
                            />
                            <div style={bib.aulaInfo}>
                              <span style={bib.aulaTitulo}>{rot.titulo}</span>
                              <span style={bib.aulaData}>{formatarDataBib(rot.criadoEm)}</span>
                            </div>
                          </label>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ── modo lista normal ── */
            <>
              <div style={bib.cardLabel}>Itens salvos {itens.length > 0 && `(${itens.length})`}</div>
              {carregando ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                  <span className="spinner" style={{ width: 12, height: 12 }} /> Carregando...
                </div>
              ) : itens.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Nenhuma referência salva ainda.</div>
              ) : (
                <div style={bib.lista}>
                  {itens.map(item => {
                    const usos = item.usadoEm || [];
                    const isExpand = expandido === item.id;
                    return (
                      <div key={item.id} style={bib.item}>
                        <div style={bib.itemInfo}>
                          <span style={bib.itemNome}>{item.nome}</span>
                          <div style={bib.itemMeta}>
                            <span style={bib.tipoBadge}>{item.tipo.toUpperCase()}</span>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatarTamanho(item.tamanho)}</span>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatarDataBib(item.adicionadoEm)}</span>
                            {usos.length > 0 ? (
                              <button
                                onClick={() => setExpandido(isExpand ? null : item.id)}
                                style={bib.badgeUso}
                              >
                                📎 {usos.length} aula{usos.length > 1 ? 's' : ''} {isExpand ? '▴' : '▾'}
                              </button>
                            ) : (
                              <span style={bib.badgeSemUso}>Não vinculada</span>
                            )}
                          </div>
                          {isExpand && (
                            <div style={bib.usoLista}>
                              {usos.map((uso, i) => (
                                <div key={i} style={bib.usoItem}>
                                  <span style={{ ...bib.usoTipo, color: uso.tipo === 'apresentacao' ? 'var(--cyan)' : '#b39ddb' }}>
                                    {uso.tipo === 'apresentacao' ? '⬡ PPTX' : '✎ Roteiro'}
                                  </span>
                                  <span style={bib.usoTitulo}>{uso.titulo}</span>
                                  <span style={bib.usoData}>{formatarDataBib(uso.criadoEm)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => abrirVincular(item.id)}
                            style={bib.btnVincular}
                            title="Vincular a aulas"
                          >
                            🔗
                          </button>
                          <button
                            onClick={() => remover(item.id)}
                            disabled={removendo === item.id}
                            style={bib.btnRemover}
                            title="Remover"
                          >
                            {removendo === item.id ? '...' : '✕'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const bib = {
  section: { marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 },
  sectionHeader: { borderTop: '1px solid var(--border)', paddingTop: 24 },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: 'var(--white)', marginBottom: 6 },
  sectionSub: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardLabel: { fontFamily: 'var(--font-head)', fontSize: 12, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  dropzone: { border: '2px dashed var(--border)', borderRadius: 8, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  dropzoneActive: { borderColor: 'var(--cyan)', background: 'rgba(79,195,247,0.05)' },
  erro: { background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.25)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#ef9a9a' },
  lista: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' },
  item: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--navy2)', borderRadius: 7, border: '1px solid var(--border)' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemNome: { fontSize: 12, color: 'var(--white)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemMeta: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 },
  tipoBadge: { fontSize: 10, color: 'var(--cyan)', background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 3, padding: '1px 5px', fontWeight: 600 },
  btnRemover: { background: 'none', color: 'var(--muted)', fontSize: 12, padding: '2px 6px', borderRadius: 4, flexShrink: 0, cursor: 'pointer' },

  badgeUso: {
    background: 'rgba(79,195,247,0.08)', border: '1px solid rgba(79,195,247,0.2)',
    borderRadius: 10, padding: '1px 7px', fontSize: 10, color: 'var(--cyan)',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  badgeSemUso: {
    fontSize: 10, color: 'var(--muted)', fontStyle: 'italic',
  },
  usoLista: {
    marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4,
    borderTop: '1px solid var(--border)', paddingTop: 6,
  },
  usoItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 6px', background: 'rgba(255,255,255,0.03)',
    borderRadius: 5, minWidth: 0,
  },
  usoTipo: {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.05em', flexShrink: 0,
  },
  usoTitulo: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)',
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  usoData: {
    fontSize: 10, color: 'var(--muted)', flexShrink: 0,
  },

  btnVincular: {
    background: 'none', color: 'var(--muted)', fontSize: 13,
    padding: '2px 5px', borderRadius: 4, cursor: 'pointer',
    transition: 'color 0.15s',
  },

  // Painel de vinculação
  vincularTop: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4,
  },
  btnVoltar: {
    background: 'none', color: 'var(--muted)', fontSize: 12,
    padding: '3px 8px', border: '1px solid var(--border)',
    borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  vincularItemNome: {
    fontSize: 12, color: 'var(--white-dim)', fontWeight: 600,
    padding: '6px 10px', background: 'var(--navy2)',
    border: '1px solid var(--border)', borderRadius: 6,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  aulaLista: {
    display: 'flex', flexDirection: 'column', gap: 4,
    maxHeight: 320, overflowY: 'auto',
  },
  aulaGrupoLabel: {
    fontSize: 10, fontWeight: 700, color: 'var(--cyan)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    paddingBottom: 4, borderBottom: '1px solid var(--border)',
    marginBottom: 2,
  },
  aulaItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
    background: 'var(--navy2)', border: '1px solid var(--border)',
    transition: 'border-color 0.15s',
  },
  aulaCheck: {
    accentColor: 'var(--cyan)', flexShrink: 0,
  },
  aulaInfo: {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1,
  },
  aulaTitulo: {
    fontSize: 12, color: 'var(--white)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  aulaData: {
    fontSize: 10, color: 'var(--muted)',
  },
};

const FORMATOS = '.pdf,.pptx,.ppt,.docx,.doc';
const FORMATOS_REF = '.pdf,.pptx,.ppt,.docx,.doc,.txt,.md';
const MAX_MB = 50;

export default function PerfilPage() {
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [arquivos, setArquivos] = useState([]);
  const [referencias, setReferencias] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [draggingRef, setDraggingRef] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [editando, setEditando] = useState(false);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [refreshBiblioteca, setRefreshBiblioteca] = useState(0);
  const inputRef = useRef();
  const inputRefRef = useRef();

  useEffect(() => {
    api.get('/api/perfil').then(r => {
      if (r.data.perfil) setPerfil(r.data.perfil);
    }).catch(() => {}).finally(() => setCarregando(false));
  }, []);

  const addArquivos = useCallback(files => {
    const novos = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return FORMATOS.includes(ext) && f.size <= MAX_MB * 1024 * 1024;
    });
    setArquivos(prev => {
      const existentes = new Set(prev.map(a => a.name + a.size));
      return [...prev, ...novos.filter(f => !existentes.has(f.name + f.size))];
    });
  }, []);

  const addReferencias = useCallback(files => {
    const novos = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return FORMATOS_REF.includes(ext) && f.size <= MAX_MB * 1024 * 1024;
    });
    setReferencias(prev => {
      const existentes = new Set(prev.map(a => a.name + a.size));
      return [...prev, ...novos.filter(f => !existentes.has(f.name + f.size))];
    });
  }, []);

  const removerArquivo = i => setArquivos(prev => prev.filter((_, idx) => idx !== i));
  const removerReferencia = i => setReferencias(prev => prev.filter((_, idx) => idx !== i));

  const onDrop = e => {
    e.preventDefault();
    setDragging(false);
    addArquivos(e.dataTransfer.files);
  };

  const onDropRef = e => {
    e.preventDefault();
    setDraggingRef(false);
    addReferencias(e.dataTransfer.files);
  };

  const analisar = async () => {
    if (arquivos.length === 0) { setErro('Selecione ao menos uma apresentação'); return; }
    setErro('');
    setAnalisando(true);

    const etapas = [
      'Extraindo conteúdo das apresentações...',
      'Identificando padrões de estrutura...',
      'Analisando estilo e profundidade...',
      'Gerando perfil personalizado...',
    ];
    let ei = 0;
    setProgresso(etapas[0]);
    const interval = setInterval(() => {
      ei = Math.min(ei + 1, etapas.length - 1);
      setProgresso(etapas[ei]);
    }, 8000);

    try {
      const form = new FormData();
      arquivos.forEach(f => form.append('apresentacoes', f));
      referencias.forEach(f => form.append('referencias', f));

      const resp = await api.post('/api/perfil/adicionar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });

      setPerfil(resp.data);
      setArquivos([]);
      setReferencias([]);
      if (resp.data.numReferencias > 0) setRefreshBiblioteca(n => n + 1);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao analisar apresentações.');
    } finally {
      clearInterval(interval);
      setAnalisando(false);
      setProgresso('');
    }
  };

  const salvarEdicao = async () => {
    if (!textoEdicao.trim()) return;
    setSalvando(true);
    try {
      const resp = await api.put('/api/perfil/descricao', { descricao: textoEdicao });
      setPerfil(prev => ({ ...prev, descricao: resp.data.descricao, atualizadoEm: resp.data.atualizadoEm }));
      setEditando(false);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const formatarData = iso => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatarTamanho = b => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const tamanhoTotal = arquivos.reduce((s, f) => s + f.size, 0);

  if (carregando) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 14, padding: '40px 0' }}>
      <span className="spinner" /> Carregando perfil...
    </div>
  );

  return (
    <div style={pf.page}>
      <div style={pf.abaHeader}>
        <h2 style={pf.abaTitle}>Perfil de apresentação</h2>
        <p style={pf.abaSub}>
          Faça upload das suas apresentações anteriores. A IA aprende seu estilo, estrutura e forma de abordar os temas e usa isso em tudo que gerar pra você.
        </p>
      </div>

      <div style={pf.grid}>
        {/* Coluna esquerda: upload */}
        <div style={pf.colLeft}>
          <div style={pf.card}>
            <div style={pf.cardLabel}>
              {perfil ? 'Adicionar mais apresentações' : 'Suas apresentações anteriores'}
            </div>
            <div style={pf.cardHint}>
              {perfil
                ? 'Novas apresentações são incorporadas ao perfil existente. Quanto mais exemplos, mais preciso fica.'
                : 'Envie apresentações que você já fez. PPTX e PDF funcionam melhor.'}
            </div>

            <div
              style={{ ...pf.dropzone, ...(dragging ? pf.dropzoneActive : {}) }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" multiple accept={FORMATOS} style={{ display: 'none' }} onChange={e => addArquivos(e.target.files)} />
              <div style={pf.dropIcon}>📂</div>
              <div style={pf.dropTitle}>Arraste ou clique para selecionar</div>
              <div style={pf.dropHint}>PPTX · PDF · DOCX · até 50 MB por arquivo</div>
            </div>

            {arquivos.length > 0 && (
              <div style={pf.listaArquivos}>
                <div style={pf.listaHeader}>
                  <span>{arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''} selecionado{arquivos.length > 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--muted)' }}>{formatarTamanho(tamanhoTotal)}</span>
                </div>
                {arquivos.map((f, i) => (
                  <div key={i} style={pf.arquivoItem}>
                    <span style={{ fontSize: 16 }}>📊</span>
                    <div style={pf.arquivoInfo}>
                      <div style={pf.arquivoNome}>{f.name}</div>
                      <div style={pf.arquivoSize}>{formatarTamanho(f.size)}</div>
                    </div>
                    <button onClick={() => removerArquivo(i)} style={pf.btnRemover} disabled={analisando}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Referências opcionais */}
            <div style={pf.refSection}>
              <div style={pf.refLabel}>
                <span style={pf.refLabelTitle}>📎 Referências dessas aulas</span>
                <span style={pf.refLabelOpt}>opcional</span>
              </div>
              <div style={pf.refHint}>
                Artigos, guidelines ou materiais que você usou para preparar essas aulas.
                Serão salvos na biblioteca e vinculados automaticamente.
              </div>
              <div
                style={{ ...pf.refDropzone, ...(draggingRef ? pf.dropzoneActive : {}) }}
                onDragOver={e => { e.preventDefault(); setDraggingRef(true); }}
                onDragLeave={() => setDraggingRef(false)}
                onDrop={onDropRef}
                onClick={() => inputRefRef.current?.click()}
              >
                <input
                  ref={inputRefRef}
                  type="file"
                  multiple
                  accept={FORMATOS_REF}
                  style={{ display: 'none' }}
                  onChange={e => addReferencias(e.target.files)}
                />
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Arraste ou clique · PDF · PPTX · DOCX · TXT
                </span>
              </div>
              {referencias.length > 0 && (
                <div style={pf.listaArquivos}>
                  {referencias.map((f, i) => (
                    <div key={i} style={pf.arquivoItem}>
                      <span style={{ fontSize: 14 }}>📎</span>
                      <div style={pf.arquivoInfo}>
                        <div style={pf.arquivoNome}>{f.name}</div>
                        <div style={pf.arquivoSize}>{formatarTamanho(f.size)}</div>
                      </div>
                      <button onClick={() => removerReferencia(i)} style={pf.btnRemover} disabled={analisando}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {erro && <div style={pf.erro}>⚠ {erro}</div>}

            <button
              onClick={analisar}
              disabled={analisando || arquivos.length === 0}
              style={pf.btnAnalisar}
            >
              {analisando ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="spinner" />
                    <span>Analisando apresentações...</span>
                  </div>
                  <div style={pf.progressoTxt}>{progresso}</div>
                </div>
              ) : perfil ? '↻ Atualizar perfil com novas apresentações' : '✦ Gerar perfil de estilo'}
            </button>

            {analisando && (
              <div style={pf.aviso}>
                ☕ Isso pode levar alguns minutos dependendo da quantidade de arquivos
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita: perfil atual */}
        <div style={pf.colRight}>
          {perfil ? (
            <div style={pf.card}>
              <div style={pf.perfilHeader}>
                <div>
                  <div style={pf.cardLabel}>Perfil aprendido</div>
                  <div style={pf.perfilMeta}>
                    {perfil.apresentacoes?.length
                      ? `${perfil.apresentacoes.length} apresentação${perfil.apresentacoes.length > 1 ? 'ões' : ''} analisada${perfil.apresentacoes.length > 1 ? 's' : ''}`
                      : 'Perfil ativo'
                    }
                    {perfil.atualizadoEm && ` · atualizado em ${formatarData(perfil.atualizadoEm)}`}
                  </div>
                </div>
                {!editando && (
                  <button
                    onClick={() => { setTextoEdicao(perfil.descricao); setEditando(true); }}
                    style={pf.btnEditar}
                  >
                    ✎ Editar
                  </button>
                )}
              </div>

              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea
                    value={textoEdicao}
                    onChange={e => setTextoEdicao(e.target.value)}
                    rows={12}
                    style={{ ...pf.textareaEdicao }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditando(false)} style={pf.btnCancelar}>Cancelar</button>
                    <button onClick={salvarEdicao} disabled={salvando} style={pf.btnSalvar}>
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={pf.perfilTexto}>{perfil.descricao}</div>
              )}

              <div style={pf.perfilRodape}>
                <div style={pf.badgeAtivo}>✓ Ativo em todas as gerações</div>
              </div>
            </div>
          ) : (
            <div style={pf.cardVazio}>
              <div style={pf.vazioIcone}>🎯</div>
              <div style={pf.vazioTitulo}>Nenhum perfil ainda</div>
              <div style={pf.vazioDesc}>
                Faça upload das suas apresentações anteriores e a IA vai aprender como você estrutura e apresenta os temas. Isso será usado em todas as futuras gerações.
              </div>
              <div style={pf.vazioLista}>
                <div style={pf.vazioItem}>✓ Estrutura típica das suas aulas</div>
                <div style={pf.vazioItem}>✓ Nível de detalhe técnico que você usa</div>
                <div style={pf.vazioItem}>✓ Elementos que você sempre inclui</div>
                <div style={pf.vazioItem}>✓ Seu estilo de linguagem clínica</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <BibliotecaSection key={refreshBiblioteca} />
    </div>
  );
}

const pf = {
  page: { display: 'flex', flexDirection: 'column', gap: 24 },
  abaHeader: { marginBottom: 4 },
  abaTitle: { fontSize: 22, fontWeight: 800, color: 'var(--white)', marginBottom: 4 },
  abaSub: { color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 700 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
  colLeft: { display: 'flex', flexDirection: 'column', gap: 16 },
  colRight: { display: 'flex', flexDirection: 'column', gap: 16 },

  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 },
  cardLabel: { fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  cardHint: { fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginTop: -8 },

  dropzone: { border: '2px dashed var(--border)', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  dropzoneActive: { borderColor: 'var(--cyan)', background: 'rgba(79,195,247,0.05)' },
  dropIcon: { fontSize: 28, marginBottom: 8 },
  dropTitle: { fontSize: 13, color: 'var(--white-dim)', marginBottom: 4 },
  dropHint: { fontSize: 11, color: 'var(--muted)' },

  listaArquivos: { display: 'flex', flexDirection: 'column', gap: 6 },
  listaHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--white-dim)', fontWeight: 600 },
  arquivoItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--navy2)', borderRadius: 8, border: '1px solid var(--border)' },
  arquivoInfo: { flex: 1, minWidth: 0 },
  arquivoNome: { fontSize: 12, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  arquivoSize: { fontSize: 11, color: 'var(--muted)', marginTop: 1 },
  btnRemover: { background: 'none', color: 'var(--muted)', fontSize: 11, padding: '2px 6px', borderRadius: 4, flexShrink: 0 },

  erro: { background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef9a9a' },

  refSection: {
    borderTop: '1px solid var(--border)', paddingTop: 14,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  refLabel: { display: 'flex', alignItems: 'center', gap: 8 },
  refLabelTitle: { fontSize: 13, fontWeight: 600, color: 'var(--white-dim)' },
  refLabelOpt: {
    fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)', borderRadius: 10, padding: '1px 7px',
  },
  refHint: { fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 },
  refDropzone: {
    display: 'flex', alignItems: 'center', gap: 10,
    border: '1px dashed var(--border)', borderRadius: 8,
    padding: '10px 14px', cursor: 'pointer', transition: 'all 0.2s',
  },

  btnAnalisar: { padding: '14px', background: 'linear-gradient(135deg, var(--blue) 0%, #0d4f8c 100%)', color: 'var(--white)', fontSize: 14, borderRadius: 10, boxShadow: '0 6px 24px rgba(26,110,181,0.4)', letterSpacing: '0.02em' },
  aviso: { fontSize: 12, color: 'var(--muted)', textAlign: 'center' },
  progressoTxt: { fontSize: 11, color: 'var(--cyan)', opacity: 0.8, animation: 'pulse 1.5s ease infinite' },

  perfilHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  perfilMeta: { fontSize: 12, color: 'var(--muted)', marginTop: 3 },
  btnEditar: { background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, padding: '5px 12px', borderRadius: 6, flexShrink: 0, cursor: 'pointer' },
  perfilTexto: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.75, whiteSpace: 'pre-wrap' },
  textareaEdicao: { background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--white)', lineHeight: 1.7, resize: 'vertical', minHeight: 240 },
  btnCancelar: { padding: '7px 16px', background: 'none', color: 'var(--muted)', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' },
  btnSalvar: { padding: '7px 18px', background: 'var(--blue)', color: 'var(--white)', fontSize: 12, borderRadius: 6, cursor: 'pointer' },

  perfilRodape: { marginTop: 4 },
  badgeAtivo: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#81c784', background: 'rgba(67,160,71,0.1)', border: '1px solid rgba(67,160,71,0.25)', borderRadius: 20, padding: '4px 12px' },

  cardVazio: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '36px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 },
  vazioIcone: { fontSize: 36, marginBottom: 4 },
  vazioTitulo: { fontSize: 16, fontWeight: 700, color: 'var(--white)' },
  vazioDesc: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, maxWidth: 340 },
  vazioLista: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, alignItems: 'flex-start', width: '100%', maxWidth: 280 },
  vazioItem: { fontSize: 12, color: 'rgba(79,195,247,0.8)' },
};
