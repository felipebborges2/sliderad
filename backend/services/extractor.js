const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

// Extrai texto de PDF
async function extractPDF(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      type: 'pdf',
      filename: path.basename(filePath),
      content: data.text.slice(0, 80000), // limite de contexto
      pages: data.numpages
    };
  } catch (err) {
    console.error('Erro ao extrair PDF:', err.message);
    return { type: 'pdf', filename: path.basename(filePath), content: '', error: err.message };
  }
}

// Extrai texto de PPTX
async function extractPPTX(filePath) {
  try {
    const officeParser = require('officeparser');
    const content = await new Promise((resolve, reject) => {
      officeParser.parseOffice(filePath, (data, err) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    return {
      type: 'pptx',
      filename: path.basename(filePath),
      content: (content || '').slice(0, 80000)
    };
  } catch (err) {
    console.error('Erro ao extrair PPTX:', err.message);
    return { type: 'pptx', filename: path.basename(filePath), content: '', error: err.message };
  }
}

// Extrai texto de DOCX
async function extractDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      type: 'docx',
      filename: path.basename(filePath),
      content: result.value.slice(0, 80000)
    };
  } catch (err) {
    return { type: 'docx', filename: path.basename(filePath), content: '', error: err.message };
  }
}

// Extrai texto de TXT/MD
async function extractText(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      type: 'txt',
      filename: path.basename(filePath),
      content: content.slice(0, 80000)
    };
  } catch (err) {
    return { type: 'txt', filename: path.basename(filePath), content: '', error: err.message };
  }
}

// Dispatcher principal
async function extractFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':  return extractPDF(filePath);
    case '.pptx': return extractPPTX(filePath);
    case '.ppt':  return extractPPTX(filePath);
    case '.docx': return extractDOCX(filePath);
    case '.doc':  return extractDOCX(filePath);
    case '.txt':
    case '.md':   return extractText(filePath);
    default:
      return { type: ext, filename: path.basename(filePath), content: '', error: 'Formato não suportado para extração de texto' };
  }
}

module.exports = { extractFileContent };
