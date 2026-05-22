import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import HistoricoPanel from '../components/HistoricoPanel';
import BibliotecaSelector from '../components/BibliotecaSelector';
import RoteiroPage from './RoteiroPage';
import PerfilPage from './PerfilPage';

const FORMATOS = '.pdf,.pptx,.ppt,.docx,.doc,.txt,.md';
const ICONES = { pdf: '📄', pptx: '📊', ppt: '📊', docx: '📝', doc: '📝', txt: '📃', md: '📃' };
const MAX_MB = 50;

/* ─── Renderização de cada tipo de slide ─── */
function SlideConteudo({ slide }) {
  const base = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 44px', boxSizing: 'border-box', fontFamily: 'inherit' };

  if (slide.tipo === 'capa') return (
    <div style={{ ...base, justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg, #0d1b2a 0%, #0a2744 100%)' }}>
      <div style={{ fontSize: 11, color: '#4fc3f7', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Radioterapia</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 14, maxWidth: '80%' }}>{slide.titulo}</div>
      {slide.subtitulo && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 28 }}>{slide.subtitulo}</div>}
      <div style={{ width: 48, height: 2, background: '#4fc3f7', marginBottom: 20 }} />
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{slide.autor} · {slide.data}</div>
    </div>
  );

  if (slide.tipo === 'agenda') return (
    <div style={{ ...base, background: '#0d1b2a' }}>
      <div style={{ fontSize: 11, color: '#4fc3f7', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Agenda</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>{slide.titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(slide.itens || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(79,195,247,0.15)', border: '1px solid rgba(79,195,247,0.4)', color: '#4fc3f7', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (slide.tipo === 'secao') return (
    <div style={{ ...base, justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg, #0a2744 0%, #0d1b2a 100%)' }}>
      <div style={{ width: 36, height: 3, background: '#4fc3f7', borderRadius: 2, marginBottom: 20 }} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>{slide.titulo}</div>
      {slide.subtitulo && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{slide.subtitulo}</div>}
    </div>
  );

  if (slide.tipo === 'tabela') return (
    <div style={{ ...base, background: '#0d1b2a' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{slide.titulo}</div>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          {slide.cabecalho && (
            <thead>
              <tr>{slide.cabecalho.map((c, i) => (
                <th key={i} style={{ padding: '7px 10px', background: 'rgba(79,195,247,0.12)', color: '#4fc3f7', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid rgba(79,195,247,0.25)', whiteSpace: 'nowrap' }}>{c}</th>
              ))}</tr>
            </thead>
          )}
          <tbody>
            {(slide.linhas || []).map((linha, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                {linha.map((cel, j) => (
                  <td key={j} style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{cel}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {slide.fonte && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>{slide.fonte}</div>}
    </div>
  );

  if (slide.tipo === 'conclusao') return (
    <div style={{ ...base, background: '#0d1b2a' }}>
      <div style={{ fontSize: 11, color: '#4fc3f7', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Conclusões</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>{slide.titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {(slide.pontos || []).map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: '#4fc3f7', fontSize: 14, lineHeight: '20px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>{pt}</span>
          </div>
        ))}
      </div>
      {slide.mensagem_final && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(79,195,247,0.08)', borderLeft: '3px solid #4fc3f7', borderRadius: '0 6px 6px 0', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
          {slide.mensagem_final}
        </div>
      )}
    </div>
  );

  if (slide.tipo === 'referencias') return (
    <div style={{ ...base, background: '#0d1b2a' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 18 }}>{slide.titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {(slide.lista || []).map((ref, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, color: '#4fc3f7', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>[{i + 1}]</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{ref}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // tipo: conteudo (default)
  return (
    <div style={{ ...base, background: '#0d1b2a' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6, paddingBottom: 10, borderBottom: '1px solid rgba(79,195,247,0.2)' }}>{slide.titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, marginTop: 12, overflow: 'hidden' }}>
        {(slide.pontos || []).map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4fc3f7', flexShrink: 0, marginTop: 7 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>{pt}</span>
          </div>
        ))}
      </div>
      {slide.destaque && (
        <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.25)', borderRadius: 6, fontSize: 12, color: '#4fc3f7', fontWeight: 600 }}>
          {slide.destaque}
        </div>
      )}
      {slide.fonte && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>{slide.fonte}</div>}
    </div>
  );
}

/* ─── Inline Edit Panel ─── */
function EditPanel({ slide, onSalvar, onCancelar }) {
  const [buf, setBuf] = useState(() => JSON.parse(JSON.stringify(slide)));

  const setField = (key, val) => setBuf(prev => ({ ...prev, [key]: val }));

  const setListItem = (key, i, val) => setBuf(prev => {
    const arr = [...(prev[key] || [])];
    arr[i] = val;
    return { ...prev, [key]: arr };
  });
  const addListItem = (key) => setBuf(prev => ({ ...prev, [key]: [...(prev[key] || []), ''] }));
  const removeListItem = (key, i) => setBuf(prev => ({
    ...prev,
    [key]: (prev[key] || []).filter((_, idx) => idx !== i)
  }));

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#fff', width: '100%', boxSizing: 'border-box', marginBottom: 6 };
  const labelStyle = { fontSize: 11, color: 'rgba(79,195,247,0.8)', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };

  const renderList = (key, placeholder) => (
    <div>
      <label style={labelStyle}>{key}</label>
      {(buf[key] || []).map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
          <input value={item} onChange={e => setListItem(key, i, e.target.value)} placeholder={placeholder} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <button type="button" onClick={() => removeListItem(key, i)} style={{ background: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, padding: '0 6px', borderRadius: 4, flexShrink: 0 }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => addListItem(key)} style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 5, color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: '5px 10px', width: '100%', cursor: 'pointer', marginBottom: 8 }}>+ Adicionar</button>
    </div>
  );

  return (
    <div style={{ padding: '14px 16px', background: 'rgba(10,20,35,0.8)', borderTop: '1px solid rgba(79,195,247,0.15)' }}>
      <div style={{ fontSize: 11, color: '#4fc3f7', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Editar slide</div>

      <label style={labelStyle}>Título</label>
      <input value={buf.titulo || ''} onChange={e => setField('titulo', e.target.value)} style={inputStyle} />

      {(buf.tipo === 'capa' || buf.tipo === 'secao') && (
        <>
          <label style={labelStyle}>Subtítulo</label>
          <input value={buf.subtitulo || ''} onChange={e => setField('subtitulo', e.target.value)} style={inputStyle} />
        </>
      )}

      {buf.tipo === 'conteudo' && (
        <>
          {renderList('pontos', 'Bullet point...')}
          <label style={labelStyle}>Destaque (opcional)</label>
          <input value={buf.destaque || ''} onChange={e => setField('destaque', e.target.value)} style={inputStyle} />
        </>
      )}

      {buf.tipo === 'agenda' && renderList('itens', 'Item da agenda...')}

      {buf.tipo === 'conclusao' && (
        <>
          {renderList('pontos', 'Ponto de conclusão...')}
          <label style={labelStyle}>Mensagem final</label>
          <textarea value={buf.mensagem_final || ''} onChange={e => setField('mensagem_final', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </>
      )}

      {buf.tipo === 'referencias' && renderList('lista', 'Referência...')}

      {buf.tipo === 'tabela' && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: 10 }}>
          Edite a tabela após importar no Canva/PowerPoint.
        </div>
      )}

      {buf.tipo === 'destaque' && (
        <>
          <label style={labelStyle}>Texto de destaque</label>
          <input value={buf.destaque || ''} onChange={e => setField('destaque', e.target.value)} style={inputStyle} />
        </>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" onClick={onCancelar} style={{ ...p.btnSecundario, fontSize: 12, padding: '7px 14px' }}>Cancelar</button>
        <button type="button" onClick={() => onSalvar(buf)} style={{ ...p.btnPrimario, fontSize: 12, padding: '7px 16px' }}>Salvar alterações</button>
      </div>
    </div>
  );
}

/* ─── Modal de preview ─── */
function PreviewModal({ preview, onFechar, baixando, setBaixando, setErro }) {
  const [slides, setSlides] = useState(preview.slides);
  const [idx, setIdx] = useState(0);
  const [slideEditando, setSlideEditando] = useState(null);
  const total = slides.length;
  const slide = slides[idx];

  useEffect(() => {
    const onKey = e => {
      if (slideEditando !== null) return; // don't navigate while editing
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setIdx(i => Math.min(i + 1, total - 1));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setIdx(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onFechar, slideEditando]);

  const salvarEdit = (novoSlide) => {
    setSlides(prev => prev.map((sl, i) => i === slideEditando ? novoSlide : sl));
    setSlideEditando(null);
  };

  const baixar = async () => {
    setBaixando(true);
    try {
      const resp = await api.post('/api/apresentacao/exportar', { slides, titulo: preview.titulo }, { responseType: 'blob', timeout: 60000 });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${preview.titulo}.pptx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErro('Erro ao baixar o arquivo.');
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div style={p.overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={p.modal}>

        {/* Cabeçalho */}
        <div style={p.modalHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={p.modalTitulo}>{preview.titulo}</div>
            <div style={p.modalSub}>{total} slides gerados</div>
          </div>
          <button onClick={onFechar} style={p.btnFechar}>✕</button>
        </div>

        {/* Área do slide */}
        <div style={p.slideArea}>
          <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0} style={{ ...p.navBtn, opacity: idx === 0 ? 0.2 : 1 }}>‹</button>

          <div style={p.slideWrapper}>
            {/* Slide 16:9 */}
            <div style={p.slide}>
              <SlideConteudo slide={slide} />
            </div>

            {/* Edit panel */}
            {slideEditando === idx && (
              <EditPanel
                slide={slide}
                onSalvar={salvarEdit}
                onCancelar={() => setSlideEditando(null)}
              />
            )}

            {/* Miniaturas */}
            <div style={p.thumbStrip}>
              {slides.map((sl, i) => (
                <button
                  key={i}
                  onClick={() => { setIdx(i); setSlideEditando(null); }}
                  style={{ ...p.thumb, ...(i === idx ? p.thumbActive : {}) }}
                  title={sl.titulo || `Slide ${i + 1}`}
                >
                  <span style={p.thumbNum}>{i + 1}</span>
                  <span style={p.thumbLabel}>{sl.titulo || sl.tipo}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setIdx(i => Math.min(i + 1, total - 1))} disabled={idx === total - 1} style={{ ...p.navBtn, opacity: idx === total - 1 ? 0.2 : 1 }}>›</button>
        </div>

        {/* Rodapé */}
        <div style={p.modalFooter}>
          <span style={p.contador}>{idx + 1} / {total}</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => setSlideEditando(slideEditando === idx ? null : idx)}
              style={{ ...p.btnSecundario, fontSize: 12 }}
            >
              {slideEditando === idx ? '✕ Fechar edição' : '✎ Editar slide'}
            </button>
            <button onClick={onFechar} style={p.btnSecundario}>Voltar</button>
            <button onClick={baixar} disabled={baixando} style={p.btnPrimario}>
              {baixando ? 'Baixando...' : '⬇ Baixar .pptx'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ─── */
export default function DashboardPage() {
  const { usuario, logout } = useAuth();
  const [tema, setTema] = useState('');
  const [arquivos, setArquivos] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [erro, setErro] = useState('');
  const [preview, setPreview] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const [aba, setAba] = useState('gerar');
  const inputRef = useRef();

  // Two-step state
  const [etapaGerar, setEtapaGerar] = useState('form'); // 'form' | 'estrutura' | 'preview'
  const [estruturaTitulos, setEstruturaTitulos] = useState([]);
  const [sugerindoEstrutura, setSugerindoEstrutura] = useState(false);
  const [bibliotecaContexto, setBibliotecaContexto] = useState('');
  const [bibliotecaIds, setBibliotecaIds] = useState([]);

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

  // --- Estrutura title editing (same pattern as RoteiroPage) ---
  const setTituloEstrutura = (i, val) => setEstruturaTitulos(prev => prev.map((t, idx) => idx === i ? val : t));
  const adicionarTituloEstrutura = () => setEstruturaTitulos(prev => [...prev, '']);
  const removerTituloEstrutura = i => setEstruturaTitulos(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const onTituloEstruturaKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEstruturaTitulos(prev => {
        const novo = [...prev];
        novo.splice(i + 1, 0, '');
        return novo;
      });
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-estrutura-input]');
        if (inputs[i + 1]) inputs[i + 1].focus();
      }, 10);
    }
    if (e.key === 'Backspace' && estruturaTitulos[i] === '' && estruturaTitulos.length > 1) {
      e.preventDefault();
      removerTituloEstrutura(i);
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-estrutura-input]');
        if (inputs[i - 1]) inputs[i - 1].focus();
      }, 10);
    }
  };

  const onPasteEstrutura = (e, i) => {
    const texto = e.clipboardData.getData('text');
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length <= 1) return;
    e.preventDefault();
    setEstruturaTitulos(prev => {
      const novo = [...prev];
      novo.splice(i, 1, ...linhas);
      return novo;
    });
  };

  // Step 1: suggest structure
  const sugerirEstrutura = async () => {
    if (!tema.trim()) { setErro('Informe o tema da apresentação'); return; }
    setErro('');
    setSugerindoEstrutura(true);

    try {
      const form = new FormData();
      form.append('tema', tema.trim());
      arquivos.forEach(f => form.append('arquivos', f));

      const resp = await api.post('/api/apresentacao/estrutura', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      setEstruturaTitulos(resp.data.titulos || []);
      setEtapaGerar('estrutura');
    } catch (err) {
      let msg = 'Erro ao sugerir estrutura.';
      if (err.response?.data?.erro) msg = err.response.data.erro;
      setErro(msg);
    } finally {
      setSugerindoEstrutura(false);
    }
  };

  // Step 2: generate with approved structure (SSE streaming para progresso real)
  const gerar = async () => {
    const titulosValidos = estruturaTitulos.filter(t => t.trim());
    if (titulosValidos.length === 0) { setErro('Informe ao menos um título'); return; }
    setErro('');
    setGerando(true);
    setProgresso('Preparando…');

    try {
      const form = new FormData();
      form.append('tema', tema.trim());
      form.append('titulos', JSON.stringify(titulosValidos));
      if (bibliotecaContexto) form.append('bibliotecaContexto', bibliotecaContexto);
      if (bibliotecaIds.length > 0) form.append('bibliotecaIds', JSON.stringify(bibliotecaIds));
      arquivos.forEach(f => form.append('arquivos', f));

      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

      const response = await fetch(`${baseURL}/api/apresentacao/gerar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let concluido = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split('\n');
        buffer = linhas.pop() ?? '';

        for (const linha of linhas) {
          if (!linha.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(linha.slice(6));
            if (data.type === 'progress') {
              setProgresso(data.mensagem);
            } else if (data.type === 'done') {
              concluido = true;
              setPreview({ id: data.id, titulo: data.titulo, slides: data.slides });
              setEtapaGerar('preview');
            } else if (data.type === 'error') {
              setErro(data.mensagem || 'Erro ao gerar apresentação.');
            }
          } catch {}
        }
      }

      if (!concluido && !erro) setErro('Conexão encerrada antes de concluir. Tente novamente.');
    } catch (err) {
      setErro(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setGerando(false);
      setProgresso('');
    }
  };

  const resetForm = () => {
    setTema('');
    setArquivos([]);
    setEtapaGerar('form');
    setEstruturaTitulos([]);
    setBibliotecaContexto('');
    setBibliotecaIds([]);
    setErro('');
    setPreview(null);
  };

  const tamanhoTotal = arquivos.reduce((s, f) => s + f.size, 0);
  const formatarTamanho = b => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div style={s.page}>
      <div style={s.bgGlow} />

      {preview && etapaGerar === 'preview' && (
        <PreviewModal
          preview={preview}
          onFechar={() => { setPreview(null); resetForm(); }}
          baixando={baixando}
          setBaixando={setBaixando}
          setErro={setErro}
        />
      )}

      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLogo}>
          <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="21" stroke="#4fc3f7" strokeWidth="1.5" />
            <path d="M22 10v24M10 22h24" stroke="#4fc3f7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="22" cy="22" r="5" fill="#4fc3f7" fillOpacity="0.2" stroke="#4fc3f7" strokeWidth="1.5" />
          </svg>
          <span style={s.headerTitle}>SlideRad</span>
        </div>
        <nav style={s.nav}>
          {[
            { id: 'gerar',    label: '✦ Gerar' },
            { id: 'roteiro',  label: '✎ Roteiro' },
            { id: 'perfil',   label: '◎ Perfil' },
            { id: 'historico', label: '⏱ Histórico' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setAba(id)} style={{ ...s.navBtn, ...(aba === id ? s.navBtnActive : {}) }}>
              {label}
            </button>
          ))}
        </nav>
        <div style={s.headerUser}>
          <div style={s.avatar}>{usuario?.nome?.[0]?.toUpperCase()}</div>
          <span style={s.userName}>{usuario?.nome?.split(' ')[0]}</span>
          <button onClick={logout} style={s.logoutBtn}>Sair</button>
        </div>
      </header>

      <main style={s.main}>
        {aba === 'gerar' ? (
          <div style={s.container} className="fade-in">

            {/* ── etapa: form ── */}
            {etapaGerar === 'form' && (
              <>
                <div style={s.pageHeader}>
                  <h1 style={s.h1}>Nova apresentação</h1>
                  <p style={s.subtitle}>Informe o tema, faça upload das referências e a IA sugere a estrutura primeiro</p>
                </div>

                <div style={s.grid}>
                  {/* Coluna esquerda */}
                  <div style={s.colLeft}>
                    <div style={s.card}>
                      <div style={s.cardLabel}>Tema da apresentação *</div>
                      <textarea
                        value={tema}
                        onChange={e => setTema(e.target.value)}
                        placeholder="Ex: Fracionamento em Radioterapia Estereotáxica (SBRT): indicações, técnica e resultados clínicos"
                        rows={3}
                        style={{ resize: 'vertical', minHeight: 80 }}
                        disabled={sugerindoEstrutura}
                      />
                      <div style={s.cardHint}>Seja específico. Quanto mais detalhe, melhor o resultado</div>
                    </div>

                    {erro && <div style={s.erro} className="fade-in">⚠ {erro}</div>}

                    <button onClick={sugerirEstrutura} disabled={sugerindoEstrutura || !tema.trim()} style={s.btnGerar}>
                      {sugerindoEstrutura ? (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
                            <span className="spinner" />
                            <span>Sugerindo estrutura...</span>
                          </div>
                          <div style={s.progressoTxt}>Analisando tema e referências...</div>
                        </div>
                      ) : '⚡ Sugerir estrutura'}
                    </button>

                    {sugerindoEstrutura && (
                      <div style={s.aviso}>
                        ☕ A IA está analisando o tema. Isso leva cerca de 20-30 segundos
                      </div>
                    )}
                  </div>

                  {/* Coluna direita */}
                  <div style={s.colRight}>
                    <div style={s.card}>
                      <div style={s.cardLabel}>Arquivos de referência</div>
                      <div
                        style={{ ...s.dropzone, ...(dragging ? s.dropzoneActive : {}) }}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        onClick={() => inputRef.current?.click()}
                      >
                        <input ref={inputRef} type="file" multiple accept={FORMATOS} style={{ display: 'none' }} onChange={e => addArquivos(e.target.files)} />
                        <div style={s.dropIcon}>⬆</div>
                        <div style={s.dropTitle}>Arraste ou clique para fazer upload</div>
                        <div style={s.dropHint}>PDF · PPTX · DOCX · TXT · MD · até 50 MB por arquivo</div>
                      </div>

                      {arquivos.length > 0 && (
                        <div style={s.listaArquivos}>
                          <div style={s.listaHeader}>
                            <span>{arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''}</span>
                            <span style={{ color: 'var(--muted)' }}>{formatarTamanho(tamanhoTotal)}</span>
                          </div>
                          {arquivos.map((f, i) => {
                            const ext = f.name.split('.').pop().toLowerCase();
                            return (
                              <div key={i} style={s.arquivoItem}>
                                <span style={s.arquivoIcon}>{ICONES[ext] || '📎'}</span>
                                <div style={s.arquivoInfo}>
                                  <div style={s.arquivoNome}>{f.name}</div>
                                  <div style={s.arquivoSize}>{formatarTamanho(f.size)}</div>
                                </div>
                                <button onClick={() => removerArquivo(i)} style={s.btnRemover} disabled={sugerindoEstrutura}>✕</button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {arquivos.length === 0 && (
                        <div style={s.semArquivos}>
                          Sem arquivos de referência. A IA usará seu próprio conhecimento clínico
                        </div>
                      )}

                      <BibliotecaSelector
                        onSelecionar={ctx => setBibliotecaContexto(ctx)}
                        onIds={ids => setBibliotecaIds(ids)}
                      />
                    </div>

                    <div style={s.dicaCard}>
                      <div style={s.dicaTitulo}>💡 Como importar no Canva</div>
                      <ol style={s.dicaLista}>
                        <li>Baixe o arquivo <strong>.pptx</strong> gerado</li>
                        <li>Abra o Canva e clique em <strong>Criar design</strong></li>
                        <li>Selecione <strong>Importar arquivo</strong></li>
                        <li>Escolha o <strong>.pptx</strong> baixado</li>
                        <li>Personalize as cores e fontes no seu estilo!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── etapa: estrutura ── */}
            {etapaGerar === 'estrutura' && (
              <>
                <div style={s.pageHeader}>
                  <h1 style={s.h1}>Estrutura da apresentação</h1>
                  <p style={s.subtitle}>Revise e ajuste os títulos antes de gerar o conteúdo</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 10, padding: '5px 14px', background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.3)', borderRadius: 20, fontSize: 13, color: 'var(--cyan)' }}>
                    {tema}
                  </div>
                </div>

                <div style={{ maxWidth: 680, margin: '0 auto' }}>
                  <div style={s.card}>
                    <div style={s.cardLabel}>Títulos dos slides</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                      Enter para adicionar, Backspace no campo vazio para remover. Você pode colar uma lista.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                      {estruturaTitulos.map((titulo, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 22, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                          <input
                            data-estrutura-input
                            value={titulo}
                            onChange={e => setTituloEstrutura(i, e.target.value)}
                            onKeyDown={e => onTituloEstruturaKeyDown(e, i)}
                            onPaste={e => onPasteEstrutura(e, i)}
                            placeholder={`Título ${i + 1}`}
                            disabled={gerando}
                            style={{ flex: 1, background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: 'var(--white)', outline: 'none' }}
                          />
                          <button onClick={() => removerTituloEstrutura(i)} disabled={gerando || estruturaTitulos.length === 1} style={{ background: 'none', color: 'var(--muted)', fontSize: 11, padding: '3px 6px', borderRadius: 4, flexShrink: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>

                    <button onClick={adicionarTituloEstrutura} disabled={gerando} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--muted)', fontSize: 12, padding: '7px 12px', width: '100%', cursor: 'pointer' }}>
                      + Adicionar slide
                    </button>
                  </div>

                  {erro && <div style={{ ...s.erro, marginTop: 12 }} className="fade-in">⚠ {erro}</div>}

                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={() => { setEtapaGerar('form'); setErro(''); }} style={{ ...p.btnSecundario, flex: '0 0 auto', padding: '14px 24px', fontSize: 14 }} disabled={gerando}>
                      ← Voltar
                    </button>
                    <button onClick={gerar} disabled={gerando || estruturaTitulos.every(t => !t.trim())} style={{ ...s.btnGerar, flex: 1 }}>
                      {gerando ? (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
                            <span className="spinner" />
                            <span>Gerando apresentação...</span>
                          </div>
                          <div style={s.progressoTxt}>{progresso}</div>
                        </div>
                      ) : '⚡ Gerar apresentação'}
                    </button>
                  </div>

                  {gerando && (
                    <div style={{ ...s.aviso, marginTop: 8 }}>
                      ☕ A IA está trabalhando. Pode levar 1 a 2 minutos dependendo do conteúdo e dos arquivos
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : aba === 'roteiro' ? (
          <div style={s.container} className="fade-in">
            <RoteiroPage />
          </div>
        ) : aba === 'perfil' ? (
          <div style={s.container} className="fade-in">
            <PerfilPage />
          </div>
        ) : (
          <HistoricoPanel />
        )}
      </main>
    </div>
  );
}

/* ─── Estilos da página ─── */
const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' },
  bgGlow: { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 80% 20%, rgba(26,110,181,0.1) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 },
  header: { position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: 16, padding: '0 32px', height: 60, background: 'rgba(13,27,42,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' },
  headerLogo: { display: 'flex', alignItems: 'center', gap: 10, marginRight: 16 },
  headerTitle: { fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18, color: 'var(--white)' },
  nav: { display: 'flex', gap: 4, flex: 1 },
  navBtn: { padding: '6px 16px', background: 'none', color: 'var(--muted)', fontSize: 13, borderRadius: 6 },
  navBtnActive: { background: 'rgba(79,195,247,0.12)', color: 'var(--cyan)' },
  headerUser: { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  avatar: { width: 30, height: 30, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--white)' },
  userName: { fontSize: 13, color: 'var(--white-dim)' },
  logoutBtn: { padding: '5px 12px', background: 'none', color: 'var(--muted)', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 },
  main: { flex: 1, padding: '32px 24px', position: 'relative', zIndex: 1 },
  container: { maxWidth: 1100, margin: '0 auto' },
  pageHeader: { marginBottom: 28 },
  h1: { fontSize: 28, fontWeight: 800, color: 'var(--white)', marginBottom: 6 },
  subtitle: { color: 'var(--muted)', fontSize: 15 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
  colLeft: { display: 'flex', flexDirection: 'column', gap: 16 },
  colRight: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 20px 16px' },
  cardLabel: { fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  cardHint: { fontSize: 12, color: 'var(--muted)', marginTop: 8 },
  btnGerar: { padding: '16px', background: 'linear-gradient(135deg, var(--blue) 0%, #0d4f8c 100%)', color: 'var(--white)', fontSize: 16, borderRadius: 10, boxShadow: '0 6px 24px rgba(26,110,181,0.4)', letterSpacing: '0.02em', width: '100%' },
  aviso: { fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' },
  progressoTxt: { fontSize: 12, color: 'var(--cyan)', opacity: 0.8, animation: 'pulse 1.5s ease infinite' },
  erro: { background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.25)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#ef9a9a' },
  dropzone: { border: '2px dashed var(--border)', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 14 },
  dropzoneActive: { borderColor: 'var(--cyan)', background: 'rgba(79,195,247,0.05)' },
  dropIcon: { fontSize: 28, marginBottom: 8, color: 'var(--cyan)' },
  dropTitle: { fontSize: 14, color: 'var(--white-dim)', marginBottom: 4 },
  dropHint: { fontSize: 12, color: 'var(--muted)' },
  listaArquivos: { display: 'flex', flexDirection: 'column', gap: 8 },
  listaHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--white-dim)', fontWeight: 600, marginBottom: 4 },
  arquivoItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--navy2)', borderRadius: 8, border: '1px solid var(--border)' },
  arquivoIcon: { fontSize: 18, flexShrink: 0 },
  arquivoInfo: { flex: 1, minWidth: 0 },
  arquivoNome: { fontSize: 13, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  arquivoSize: { fontSize: 11, color: 'var(--muted)', marginTop: 1 },
  btnRemover: { background: 'none', color: 'var(--muted)', fontSize: 12, padding: '2px 6px', borderRadius: 4, flexShrink: 0 },
  semArquivos: { fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '8px 0', fontStyle: 'italic' },
  dicaCard: { background: 'rgba(79,195,247,0.06)', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 10, padding: '16px 18px' },
  dicaTitulo: { fontSize: 13, fontWeight: 600, color: 'var(--cyan)', marginBottom: 10 },
  dicaLista: { paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--white-dim)' },
};

/* ─── Estilos do preview ─── */
const p = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(5,12,20,0.92)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#0d1b2a', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 16, width: '100%', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 },
  modalTitulo: { fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  modalSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  btnFechar: { background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 16, padding: '4px 8px', borderRadius: 6, flexShrink: 0, marginLeft: 12 },
  slideArea: { display: 'flex', alignItems: 'center', gap: 8, padding: '16px 12px', flex: 1, minHeight: 0, overflowY: 'auto' },
  navBtn: { background: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 32, padding: '0 8px', borderRadius: 8, flexShrink: 0, lineHeight: 1, transition: 'opacity 0.15s' },
  slideWrapper: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, minWidth: 0 },
  slide: { width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 },
  thumbStrip: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 },
  thumb: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', maxWidth: 140, transition: 'all 0.15s' },
  thumbActive: { background: 'rgba(79,195,247,0.12)', borderColor: 'rgba(79,195,247,0.4)' },
  thumbNum: { fontSize: 10, color: '#4fc3f7', fontWeight: 700, flexShrink: 0 },
  thumbLabel: { fontSize: 10, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  modalFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 },
  contador: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' },
  btnSecundario: { padding: '9px 20px', background: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, cursor: 'pointer' },
  btnPrimario: { padding: '9px 22px', background: 'linear-gradient(135deg, #1a6eb5 0%, #0d4f8c 100%)', color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 8, boxShadow: '0 4px 16px rgba(26,110,181,0.35)', cursor: 'pointer' },
};
