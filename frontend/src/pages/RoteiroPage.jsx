import { useState, useRef, useCallback } from 'react';
import api from '../lib/api';
import BibliotecaSelector from '../components/BibliotecaSelector';

const FORMATOS = '.pdf,.pptx,.ppt,.docx,.doc,.txt,.md';
const ICONES = { pdf: '📄', pptx: '📊', ppt: '📊', docx: '📝', doc: '📝', txt: '📃', md: '📃' };
const MAX_MB = 50;

/* ─── Card de resultado de um slide ─── */
function SlideResultado({ slide, indice, total, roteiroId, todosTitulos, onAtualizar }) {
  const [regenerando, setRegenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const textoParaCopiar = slide.formato === 'topicos'
    ? `${slide.titulo}\n\n${(slide.topicos || []).map(t => `• ${t}`).join('\n')}`
    : `${slide.titulo}\n\n${slide.texto || ''}`;

  const copiar = async () => {
    await navigator.clipboard.writeText(textoParaCopiar);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const regenerar = async () => {
    setRegenerando(true);
    try {
      const resp = await api.post('/api/roteiro/regenerar', {
        roteiroId,
        titulo: slide.titulo,
        indice,
      });
      onAtualizar(indice, resp.data.slide);
    } catch (err) {
      console.error('Erro ao regenerar:', err);
    } finally {
      setRegenerando(false);
    }
  };

  return (
    <div style={r.slideCard}>
      <div style={r.slideHeader}>
        <div style={r.slideNumTitulo}>
          <span style={r.slideNum}>{indice + 1}<span style={{ opacity: 0.4 }}>/{total}</span></span>
          <span style={r.slideTitulo}>{slide.titulo}</span>
        </div>
        <div style={r.slideAcoes}>
          <button onClick={copiar} style={r.btnAcao} title="Copiar">
            {copiado ? '✓' : '⎘'}
          </button>
          <button onClick={regenerar} disabled={regenerando} style={r.btnAcao} title="Regenerar">
            {regenerando ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '↻'}
          </button>
        </div>
      </div>

      <div style={r.slideConteudo}>
        {slide.formato === 'topicos' ? (
          <ul style={r.lista}>
            {(slide.topicos || []).map((t, i) => (
              <li key={i} style={r.listaItem}>
                <span style={r.bullet} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={r.textoCorrido}>{slide.texto}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Página de roteiro ─── */
export default function RoteiroPage() {
  const [titulos, setTitulos] = useState(['']);
  const [arquivos, setArquivos] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null); // { id, slides }
  const [bibliotecaContexto, setBibliotecaContexto] = useState('');
  const [bibliotecaIds, setBibliotecaIds] = useState([]);
  const inputRef = useRef();
  const resultadoRef = useRef();

  /* Títulos dinâmicos */
  const setTitulo = (i, val) => setTitulos(prev => prev.map((t, idx) => idx === i ? val : t));
  const adicionarTitulo = () => setTitulos(prev => [...prev, '']);
  const removerTitulo = i => setTitulos(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const onTituloKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTitulos(prev => {
        const novo = [...prev];
        novo.splice(i + 1, 0, '');
        return novo;
      });
      // foco no próximo input
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-titulo-input]');
        if (inputs[i + 1]) inputs[i + 1].focus();
      }, 10);
    }
    if (e.key === 'Backspace' && titulos[i] === '' && titulos.length > 1) {
      e.preventDefault();
      removerTitulo(i);
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-titulo-input]');
        if (inputs[i - 1]) inputs[i - 1].focus();
      }, 10);
    }
  };

  /* Colar lista de títulos */
  const onPaste = (e, i) => {
    const texto = e.clipboardData.getData('text');
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length <= 1) return;
    e.preventDefault();
    setTitulos(prev => {
      const novo = [...prev];
      novo.splice(i, 1, ...linhas);
      return novo;
    });
  };

  /* Arquivos */
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

  const removerArquivo = i => setArquivos(prev => prev.filter((_, idx) => idx !== i));

  const onDrop = e => {
    e.preventDefault();
    setDragging(false);
    addArquivos(e.dataTransfer.files);
  };

  /* Gerar */
  const gerar = async () => {
    const titulosValidos = titulos.map(t => t.trim()).filter(Boolean);
    if (titulosValidos.length === 0) { setErro('Informe ao menos um título de slide'); return; }
    setErro('');
    setResultado(null);
    setGerando(true);

    const etapas = [
      'Extraindo conteúdo das referências...',
      'Analisando material clínico...',
      'Gerando conteúdo slide a slide...',
      'Revisando e completando os textos...',
      'Finalizando...',
    ];
    let ei = 0;
    setProgresso(etapas[0]);
    const interval = setInterval(() => {
      ei = Math.min(ei + 1, etapas.length - 1);
      setProgresso(etapas[ei]);
    }, 6000);

    try {
      const form = new FormData();
      form.append('titulos', JSON.stringify(titulosValidos));
      if (bibliotecaContexto) form.append('bibliotecaContexto', bibliotecaContexto);
      if (bibliotecaIds.length > 0) form.append('bibliotecaIds', JSON.stringify(bibliotecaIds));
      arquivos.forEach(f => form.append('arquivos', f));

      const resp = await api.post('/api/roteiro/gerar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 240000,
      });

      setResultado({ id: resp.data.id, slides: resp.data.slides });
      setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      const msg = err.response?.data?.erro || 'Erro ao gerar conteúdo.';
      setErro(msg);
    } finally {
      clearInterval(interval);
      setGerando(false);
      setProgresso('');
    }
  };

  const atualizarSlide = (indice, novoSlide) => {
    setResultado(prev => {
      const slides = [...prev.slides];
      slides[indice] = novoSlide;
      return { ...prev, slides };
    });
  };

  const copiarTudo = async () => {
    if (!resultado) return;
    const texto = resultado.slides.map(sl => {
      const corpo = sl.formato === 'topicos'
        ? (sl.topicos || []).map(t => `• ${t}`).join('\n')
        : (sl.texto || '');
      return `${sl.titulo}\n\n${corpo}`;
    }).join('\n\n' + '─'.repeat(40) + '\n\n');
    await navigator.clipboard.writeText(texto);
  };

  const novaConsulta = () => {
    setResultado(null);
    setTitulos(['']);
    setArquivos([]);
    setBibliotecaIds([]);
    setErro('');
  };

  const tamanhoTotal = arquivos.reduce((s, f) => s + f.size, 0);
  const formatarTamanho = b => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div style={r.page}>
      {/* Cabeçalho da aba */}
      <div style={r.abaHeader}>
        <h2 style={r.abaTitle}>Gerador de conteúdo por slide</h2>
        <p style={r.abaSub}>Informe os títulos dos slides e a IA preenche o conteúdo de cada um com base nas suas referências</p>
      </div>

      {!resultado ? (
        <div style={r.grid}>
          {/* Coluna esquerda: títulos */}
          <div style={r.colLeft}>
            <div style={r.card}>
              <div style={r.cardLabel}>Títulos dos slides</div>
              <div style={r.cardHint2}>Um título por linha. Enter para adicionar, Backspace no campo vazio para remover. Você também pode colar uma lista.</div>

              <div style={r.listaTitulos}>
                {titulos.map((titulo, i) => (
                  <div key={i} style={r.tituloRow}>
                    <span style={r.tituloNum}>{i + 1}</span>
                    <input
                      data-titulo-input
                      value={titulo}
                      onChange={e => setTitulo(i, e.target.value)}
                      onKeyDown={e => onTituloKeyDown(e, i)}
                      onPaste={e => onPaste(e, i)}
                      placeholder={`Título do slide ${i + 1}`}
                      disabled={gerando}
                      style={r.tituloInput}
                    />
                    <button onClick={() => removerTitulo(i)} disabled={gerando || titulos.length === 1} style={r.btnRemTitulo}>✕</button>
                  </div>
                ))}
              </div>

              <button onClick={adicionarTitulo} disabled={gerando} style={r.btnAdd}>
                + Adicionar slide
              </button>
            </div>

            {erro && <div style={r.erro}>⚠ {erro}</div>}

            <button onClick={gerar} disabled={gerando || titulos.every(t => !t.trim())} style={r.btnGerar}>
              {gerando ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="spinner" />
                    <span>Gerando conteúdo...</span>
                  </div>
                  <div style={r.progressoTxt}>{progresso}</div>
                </div>
              ) : '⚡ Gerar conteúdo'}
            </button>

            {gerando && (
              <div style={r.aviso}>
                ☕ A IA está trabalhando. Pode levar alguns minutos dependendo da quantidade de slides e referências
              </div>
            )}
          </div>

          {/* Coluna direita: arquivos */}
          <div style={r.colRight}>
            <div style={r.card}>
              <div style={r.cardLabel}>Arquivos de referência</div>
              <div
                style={{ ...r.dropzone, ...(dragging ? r.dropzoneActive : {}) }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" multiple accept={FORMATOS} style={{ display: 'none' }} onChange={e => addArquivos(e.target.files)} />
                <div style={r.dropIcon}>⬆</div>
                <div style={r.dropTitle}>Arraste ou clique para fazer upload</div>
                <div style={r.dropHint}>PDF · PPTX · DOCX · TXT · MD · até 50 MB por arquivo</div>
              </div>

              {arquivos.length > 0 && (
                <div style={r.listaArquivos}>
                  <div style={r.listaHeader}>
                    <span>{arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''}</span>
                    <span style={{ color: 'var(--muted)' }}>{formatarTamanho(tamanhoTotal)}</span>
                  </div>
                  {arquivos.map((f, i) => {
                    const ext = f.name.split('.').pop().toLowerCase();
                    return (
                      <div key={i} style={r.arquivoItem}>
                        <span style={r.arquivoIcon}>{ICONES[ext] || '📎'}</span>
                        <div style={r.arquivoInfo}>
                          <div style={r.arquivoNome}>{f.name}</div>
                          <div style={r.arquivoSize}>{formatarTamanho(f.size)}</div>
                        </div>
                        <button onClick={() => removerArquivo(i)} style={r.btnRemover} disabled={gerando}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {arquivos.length === 0 && (
                <div style={r.semArquivos}>Sem arquivos. A IA usará seu próprio conhecimento clínico</div>
              )}

              <BibliotecaSelector
                onSelecionar={ctx => setBibliotecaContexto(ctx)}
                onIds={ids => setBibliotecaIds(ids)}
              />
            </div>

            <div style={r.dicaCard}>
              <div style={r.dicaTitulo}>💡 Como usar</div>
              <ul style={r.dicaLista}>
                <li>Liste os títulos dos seus slides na ordem desejada</li>
                <li>Faça upload das suas referências para um resultado mais preciso</li>
                <li>A IA vai preencher cada slide com conteúdo técnico completo</li>
                <li>Use o botão ↻ para regenerar qualquer slide individualmente</li>
                <li>Copie o conteúdo e cole direto no PowerPoint ou Canva</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Resultados */
        <div ref={resultadoRef}>
          <div style={r.resultadoHeader}>
            <div>
              <div style={r.resultadoTitulo}>{resultado.slides.length} slides gerados</div>
              <div style={r.resultadoSub}>Clique em ↻ para regenerar qualquer slide individualmente</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={copiarTudo} style={r.btnSecundario}>⎘ Copiar tudo</button>
              <button onClick={novaConsulta} style={r.btnSecundario}>Nova consulta</button>
            </div>
          </div>

          <div style={r.listaSlides}>
            {resultado.slides.map((slide, i) => (
              <SlideResultado
                key={i}
                slide={slide}
                indice={i}
                total={resultado.slides.length}
                roteiroId={resultado.id}
                todosTitulos={resultado.slides.map(s => s.titulo)}
                onAtualizar={atualizarSlide}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const r = {
  page: { display: 'flex', flexDirection: 'column', gap: 24 },
  abaHeader: { marginBottom: 4 },
  abaTitle: { fontSize: 22, fontWeight: 800, color: 'var(--white)', marginBottom: 4 },
  abaSub: { color: 'var(--muted)', fontSize: 14 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
  colLeft: { display: 'flex', flexDirection: 'column', gap: 16 },
  colRight: { display: 'flex', flexDirection: 'column', gap: 16 },

  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 20px 16px' },
  cardLabel: { fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  cardHint2: { fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 },

  listaTitulos: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  tituloRow: { display: 'flex', alignItems: 'center', gap: 8 },
  tituloNum: { fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 18, textAlign: 'right', flexShrink: 0 },
  tituloInput: { flex: 1, background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: 'var(--white)', outline: 'none' },
  btnRemTitulo: { background: 'none', color: 'var(--muted)', fontSize: 11, padding: '3px 6px', borderRadius: 4, flexShrink: 0 },
  btnAdd: { background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--muted)', fontSize: 12, padding: '7px 12px', width: '100%', cursor: 'pointer', transition: 'all 0.15s' },

  btnGerar: { padding: '16px', background: 'linear-gradient(135deg, var(--blue) 0%, #0d4f8c 100%)', color: 'var(--white)', fontSize: 16, borderRadius: 10, boxShadow: '0 6px 24px rgba(26,110,181,0.4)', letterSpacing: '0.02em' },
  aviso: { fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' },
  progressoTxt: { fontSize: 12, color: 'var(--cyan)', opacity: 0.8, animation: 'pulse 1.5s ease infinite' },
  erro: { background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.25)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#ef9a9a' },

  dropzone: { border: '2px dashed var(--border)', borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 14 },
  dropzoneActive: { borderColor: 'var(--cyan)', background: 'rgba(79,195,247,0.05)' },
  dropIcon: { fontSize: 26, marginBottom: 6, color: 'var(--cyan)' },
  dropTitle: { fontSize: 13, color: 'var(--white-dim)', marginBottom: 3 },
  dropHint: { fontSize: 11, color: 'var(--muted)' },
  listaArquivos: { display: 'flex', flexDirection: 'column', gap: 8 },
  listaHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--white-dim)', fontWeight: 600, marginBottom: 4 },
  arquivoItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--navy2)', borderRadius: 8, border: '1px solid var(--border)' },
  arquivoIcon: { fontSize: 18, flexShrink: 0 },
  arquivoInfo: { flex: 1, minWidth: 0 },
  arquivoNome: { fontSize: 13, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  arquivoSize: { fontSize: 11, color: 'var(--muted)', marginTop: 1 },
  btnRemover: { background: 'none', color: 'var(--muted)', fontSize: 12, padding: '2px 6px', borderRadius: 4, flexShrink: 0 },
  semArquivos: { fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '6px 0', fontStyle: 'italic' },

  dicaCard: { background: 'rgba(79,195,247,0.06)', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 10, padding: '16px 18px' },
  dicaTitulo: { fontSize: 13, fontWeight: 600, color: 'var(--cyan)', marginBottom: 10 },
  dicaLista: { paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--white-dim)' },

  resultadoHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16 },
  resultadoTitulo: { fontSize: 18, fontWeight: 700, color: 'var(--white)' },
  resultadoSub: { fontSize: 12, color: 'var(--muted)', marginTop: 3 },
  btnSecundario: { padding: '8px 16px', background: 'none', color: 'var(--white-dim)', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer' },

  listaSlides: { display: 'flex', flexDirection: 'column', gap: 14 },
  slideCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  slideHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 12 },
  slideNumTitulo: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  slideNum: { fontSize: 11, color: 'var(--cyan)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  slideTitulo: { fontSize: 14, fontWeight: 600, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  slideAcoes: { display: 'flex', gap: 4, flexShrink: 0 },
  btnAcao: { background: 'none', color: 'var(--muted)', fontSize: 15, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 28 },
  slideConteudo: { padding: '14px 18px 16px' },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  listaItem: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 },
  bullet: { width: 5, height: 5, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0, marginTop: 8 },
  textoCorrido: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: 0 },
};
