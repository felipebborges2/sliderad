const pptxgen = require('pptxgenjs');
const path = require('path');

// Paleta clínica: azul escuro profissional
const CORES = {
  primaria: '1B3A6B',      // azul escuro
  secundaria: '2E6DB4',    // azul médio
  acento: '4FC3F7',        // azul claro
  branco: 'FFFFFF',
  cinzaClaro: 'F4F6F9',
  cinzaMedio: 'B0BEC5',
  cinzaTexto: '1A2332',
  destaque: 'E8F4FD',
  tabelaHeader: '1B3A6B',
  tabelaLinha1: 'FFFFFF',
  tabelaLinha2: 'F0F7FF',
  secaoFundo: '1B3A6B',
  vermelho: 'E53935',
  verde: '43A047'
};

function slideCapa(pres, dados) {
  const slide = pres.addSlide();
  slide.background = { color: CORES.primaria };

  // Faixa lateral esquerda decorativa
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625,
    fill: { color: CORES.acento },
    line: { color: CORES.acento }
  });

  // Faixa inferior
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 4.8, w: 10, h: 0.825,
    fill: { color: '162F58' },
    line: { color: '162F58' }
  });

  // Ícone/símbolo médico decorativo
  slide.addShape(pres.shapes.OVAL, {
    x: 7.8, y: 0.4, w: 1.8, h: 1.8,
    fill: { color: CORES.secundaria, transparency: 60 },
    line: { color: CORES.acento, width: 1.5 }
  });
  slide.addShape(pres.shapes.OVAL, {
    x: 8.1, y: 0.7, w: 1.2, h: 1.2,
    fill: { color: CORES.acento, transparency: 80 },
    line: { color: CORES.acento, width: 1 }
  });

  // Título principal
  slide.addText(dados.titulo || dados.tema, {
    x: 0.5, y: 1.4, w: 8.8, h: 1.5,
    fontSize: 34, bold: true, color: CORES.branco,
    fontFace: 'Calibri', align: 'left',
    wrap: true
  });

  // Subtítulo
  if (dados.subtitulo) {
    slide.addText(dados.subtitulo, {
      x: 0.5, y: 2.95, w: 8.8, h: 0.6,
      fontSize: 16, color: CORES.acento,
      fontFace: 'Calibri', align: 'left', italic: true
    });
  }

  // Linha separadora
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 3.65, w: 8, h: 0.03,
    fill: { color: CORES.acento, transparency: 40 },
    line: { color: CORES.acento, transparency: 40 }
  });

  // Autor e data
  slide.addText(dados.autor || 'Residência em Radioterapia', {
    x: 0.5, y: 4.85, w: 7, h: 0.35,
    fontSize: 13, color: CORES.cinzaMedio,
    fontFace: 'Calibri', align: 'left'
  });
  if (dados.data) {
    slide.addText(dados.data, {
      x: 8.5, y: 4.85, w: 1.3, h: 0.35,
      fontSize: 13, color: CORES.cinzaMedio,
      fontFace: 'Calibri', align: 'right'
    });
  }
}

function slideAgenda(pres, dados) {
  const slide = pres.addSlide();
  slide.background = { color: CORES.branco };

  // Cabeçalho
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.1,
    fill: { color: CORES.primaria }, line: { color: CORES.primaria }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: CORES.acento }, line: { color: CORES.acento }
  });

  slide.addText(dados.titulo || 'Agenda', {
    x: 0.4, y: 0.15, w: 9, h: 0.8,
    fontSize: 26, bold: true, color: CORES.branco, fontFace: 'Calibri'
  });

  // Itens da agenda em grid 2 colunas se muitos
  const itens = dados.itens || [];
  const metade = Math.ceil(itens.length / 2);
  const col1 = itens.slice(0, metade);
  const col2 = itens.slice(metade);

  col1.forEach((item, i) => {
    const y = 1.4 + i * 0.65;
    slide.addShape(pres.shapes.OVAL, {
      x: 0.4, y: y + 0.08, w: 0.3, h: 0.3,
      fill: { color: CORES.secundaria }, line: { color: CORES.secundaria }
    });
    slide.addText(String(i + 1), {
      x: 0.4, y: y + 0.06, w: 0.3, h: 0.3,
      fontSize: 10, bold: true, color: CORES.branco,
      fontFace: 'Calibri', align: 'center'
    });
    slide.addText(item, {
      x: 0.85, y: y, w: 3.8, h: 0.45,
      fontSize: 14, color: CORES.cinzaTexto, fontFace: 'Calibri'
    });
  });

  col2.forEach((item, i) => {
    const idx = metade + i;
    const y = 1.4 + i * 0.65;
    slide.addShape(pres.shapes.OVAL, {
      x: 5.2, y: y + 0.08, w: 0.3, h: 0.3,
      fill: { color: CORES.secundaria }, line: { color: CORES.secundaria }
    });
    slide.addText(String(idx + 1), {
      x: 5.2, y: y + 0.06, w: 0.3, h: 0.3,
      fontSize: 10, bold: true, color: CORES.branco,
      fontFace: 'Calibri', align: 'center'
    });
    slide.addText(item, {
      x: 5.65, y: y, w: 3.8, h: 0.45,
      fontSize: 14, color: CORES.cinzaTexto, fontFace: 'Calibri'
    });
  });

  addRodape(slide, pres);
}

function slideSecao(pres, dados) {
  const slide = pres.addSlide();
  slide.background = { color: CORES.primaria };

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625,
    fill: { color: CORES.acento }, line: { color: CORES.acento }
  });

  // Número/ícone de seção decorativo
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 2.1, w: 1.2, h: 0.06,
    fill: { color: CORES.acento }, line: { color: CORES.acento }
  });

  slide.addText(dados.titulo, {
    x: 0.5, y: 2.2, w: 9, h: 1.2,
    fontSize: 36, bold: true, color: CORES.branco,
    fontFace: 'Calibri', align: 'left', wrap: true
  });

  if (dados.subtitulo) {
    slide.addText(dados.subtitulo, {
      x: 0.5, y: 3.5, w: 9, h: 0.6,
      fontSize: 16, color: CORES.acento,
      fontFace: 'Calibri', align: 'left', italic: true
    });
  }
}

function slideConteudo(pres, dados) {
  const slide = pres.addSlide();
  slide.background = { color: CORES.branco };

  // Cabeçalho azul
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0,
    fill: { color: CORES.primaria }, line: { color: CORES.primaria }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: CORES.acento }, line: { color: CORES.acento }
  });

  slide.addText(dados.titulo, {
    x: 0.3, y: 0.1, w: 9.3, h: 0.8,
    fontSize: 22, bold: true, color: CORES.branco,
    fontFace: 'Calibri', wrap: true
  });

  const pontos = dados.pontos || [];
  const temDestaque = !!dados.destaque;
  const larguraPontos = temDestaque ? 6.0 : 9.3;

  // Bullets
  if (pontos.length > 0) {
    const itensFormatados = pontos.map((p, i) => {
      const linhas = [];
      if (i > 0) linhas.push({ text: '', options: { breakLine: true } });
      linhas.push({ text: p, options: { bullet: false, breakLine: false } });
      return linhas;
    }).flat();

    // Remove o primeiro breakLine desnecessário
    const primeiroBR = itensFormatados.findIndex(x => x.text === '');
    if (primeiroBR === 0) itensFormatados.shift();

    slide.addText(
      pontos.map((p, i) => [
        ...(i > 0 ? [{ text: '', options: { breakLine: true } }] : []),
        { text: `•  ${p}`, options: {} }
      ]).flat(),
      {
        x: 0.3, y: 1.15, w: larguraPontos, h: 3.8,
        fontSize: 14, color: CORES.cinzaTexto, fontFace: 'Calibri',
        valign: 'top', wrap: true, paraSpaceAfter: 4, lineSpacingMultiple: 1.15
      }
    );
  }

  // Card de destaque lateral
  if (temDestaque) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 6.5, y: 1.15, w: 3.1, h: 2.6,
      fill: { color: CORES.primaria }, line: { color: CORES.primaria }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 6.5, y: 1.15, w: 3.1, h: 0.38,
      fill: { color: CORES.acento }, line: { color: CORES.acento }
    });
    slide.addText('DESTAQUE', {
      x: 6.5, y: 1.18, w: 3.1, h: 0.32,
      fontSize: 10, bold: true, color: CORES.primaria,
      fontFace: 'Calibri', align: 'center'
    });
    slide.addText(dados.destaque, {
      x: 6.6, y: 1.6, w: 2.9, h: 2.0,
      fontSize: 13, color: CORES.branco, fontFace: 'Calibri',
      wrap: true, valign: 'middle', align: 'center', italic: true
    });
  }

  // Rodapé de fonte
  if (dados.fonte) {
    slide.addText(`📄 ${dados.fonte}`, {
      x: 0.3, y: 5.1, w: 9.3, h: 0.35,
      fontSize: 10, color: CORES.cinzaMedio, fontFace: 'Calibri', italic: true
    });
  }

  addRodape(slide, pres);
}

function slideTabelaLayout(pres, dados) {
  const slide = pres.addSlide();
  slide.background = { color: CORES.branco };

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0,
    fill: { color: CORES.primaria }, line: { color: CORES.primaria }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: CORES.acento }, line: { color: CORES.acento }
  });

  slide.addText(dados.titulo, {
    x: 0.3, y: 0.1, w: 9.3, h: 0.8,
    fontSize: 22, bold: true, color: CORES.branco, fontFace: 'Calibri'
  });

  const cabecalho = dados.cabecalho || [];
  const linhas = dados.linhas || [];
  const numCols = cabecalho.length || (linhas[0] ? linhas[0].length : 1);
  const colW = Array(numCols).fill(9.3 / numCols);

  const tableData = [
    cabecalho.map(h => ({
      text: h,
      options: { bold: true, color: CORES.branco, fill: { color: CORES.tabelaHeader }, align: 'center', fontSize: 13 }
    })),
    ...linhas.map((linha, i) =>
      linha.map(cel => ({
        text: String(cel),
        options: { color: CORES.cinzaTexto, fill: { color: i % 2 === 0 ? CORES.tabelaLinha1 : CORES.tabelaLinha2 }, fontSize: 12, align: 'center' }
      }))
    )
  ];

  slide.addTable(tableData, {
    x: 0.3, y: 1.2, w: 9.3,
    colW,
    border: { pt: 0.5, color: CORES.cinzaMedio },
    rowH: 0.42
  });

  if (dados.fonte) {
    slide.addText(`📄 ${dados.fonte}`, {
      x: 0.3, y: 5.1, w: 9.3, h: 0.35,
      fontSize: 10, color: CORES.cinzaMedio, fontFace: 'Calibri', italic: true
    });
  }

  addRodape(slide, pres);
}

function slideConclusao(pres, dados) {
  const slide = pres.addSlide();
  slide.background = { color: CORES.primaria };

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625,
    fill: { color: CORES.acento }, line: { color: CORES.acento }
  });

  slide.addText(dados.titulo || 'Conclusões', {
    x: 0.4, y: 0.3, w: 9, h: 0.7,
    fontSize: 28, bold: true, color: CORES.branco, fontFace: 'Calibri'
  });

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 1.1, w: 8.5, h: 0.03,
    fill: { color: CORES.acento, transparency: 50 }, line: { color: CORES.acento, transparency: 50 }
  });

  const pontos = dados.pontos || [];
  pontos.forEach((p, i) => {
    const y = 1.25 + i * 0.65;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: y + 0.1, w: 0.3, h: 0.3,
      fill: { color: CORES.acento }, line: { color: CORES.acento }
    });
    slide.addText(p, {
      x: 0.85, y: y, w: 8.7, h: 0.5,
      fontSize: 14, color: CORES.branco, fontFace: 'Calibri', wrap: true
    });
  });

  if (dados.mensagem_final) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: 4.5, w: 9.1, h: 0.85,
      fill: { color: CORES.secundaria }, line: { color: CORES.secundaria }
    });
    slide.addText(dados.mensagem_final, {
      x: 0.5, y: 4.55, w: 8.9, h: 0.75,
      fontSize: 14, color: CORES.branco, fontFace: 'Calibri',
      align: 'center', valign: 'middle', italic: true, wrap: true
    });
  }
}

function slideReferencias(pres, dados) {
  const slide = pres.addSlide();
  slide.background = { color: CORES.branco };

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0,
    fill: { color: CORES.primaria }, line: { color: CORES.primaria }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: CORES.acento }, line: { color: CORES.acento }
  });

  slide.addText('Referências', {
    x: 0.3, y: 0.1, w: 9.3, h: 0.8,
    fontSize: 22, bold: true, color: CORES.branco, fontFace: 'Calibri'
  });

  const lista = dados.lista || [];
  lista.forEach((ref, i) => {
    slide.addText(`${i + 1}. ${ref}`, {
      x: 0.4, y: 1.15 + i * 0.52, w: 9.2, h: 0.45,
      fontSize: 12, color: CORES.cinzaTexto, fontFace: 'Calibri', wrap: true
    });
  });

  addRodape(slide, pres);
}

function addRodape(slide, pres) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.4, w: 10, h: 0.225,
    fill: { color: CORES.primaria, transparency: 80 },
    line: { color: CORES.primaria, transparency: 80 }
  });
  slide.addText('Residência em Radioterapia', {
    x: 0.3, y: 5.42, w: 5, h: 0.2,
    fontSize: 9, color: CORES.cinzaMedio, fontFace: 'Calibri'
  });
}

function buildPresentation(conteudo) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'Sistema de Apresentações';
  pres.title = conteudo.titulo || conteudo.tema;

  for (const slide of conteudo.slides) {
    switch (slide.tipo) {
      case 'capa':        slideCapa(pres, slide); break;
      case 'agenda':      slideAgenda(pres, slide); break;
      case 'secao':       slideSecao(pres, slide); break;
      case 'tabela':      slideTabelaLayout(pres, slide); break;
      case 'conclusao':   slideConclusao(pres, slide); break;
      case 'referencias': slideReferencias(pres, slide); break;
      default:            slideConteudo(pres, slide); break;
    }
  }

  return pres;
}

async function gerarPPTX({ conteudo, outputPath }) {
  const pres = buildPresentation(conteudo);
  await pres.writeFile({ fileName: outputPath });
  return outputPath;
}

async function gerarPPTXBuffer({ conteudo }) {
  const pres = buildPresentation(conteudo);
  const buffer = await pres.write({ outputType: 'nodebuffer' });
  return buffer;
}

module.exports = { gerarPPTX, gerarPPTXBuffer };
