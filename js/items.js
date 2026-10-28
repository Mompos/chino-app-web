// Elementos de estudio: caracteres, palabras y frases, con un identificador común.
//   carácter → el propio carácter ("好")       palabra → "p:你好"
//   frase    → "f:<lección>-<n>" ("f:1-3")    par de tonos → "t:<tonos>" ("t:23")
// El progreso (js/progreso.js) guarda cada elemento por su identificador.
(function () {
  const D = window.DATOS;
  const V = D.vocabulario;
  const palabras = Object.fromEntries(V.palabras.map(p => [p.id, p]));
  const frases = Object.fromEntries(V.frases.map(f => [f.id, f]));
  const tonos = Object.fromEntries(V.tonos.map(t => [t.id, t]));

  const MARCAS = { 'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'ē': 1, 'é': 2, 'ě': 3, 'è': 4, 'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
    'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4, 'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4, 'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4 };
  function tonoDe(silaba) { for (const ch of silaba) if (MARCAS[ch]) return MARCAS[ch]; return 5; }

  function get(id) {
    if (D.caracteres[id]) {
      const ch = D.caracteres[id];
      return { tipo: 'caracter', id, texto: id, pinyin: ch.pinyin, significado: ch.significado, tono: ch.tono, leccion: ch.leccionLibro, nivel: ch.nivel };
    }
    if (palabras[id]) {
      const p = palabras[id];
      return { tipo: 'palabra', id, texto: p.w, pinyin: p.py, significado: p.es, leccion: p.l };
    }
    if (frases[id]) {
      const f = frases[id];
      return { tipo: 'frase', id, texto: f.zh, pinyin: f.py, significado: f.es, leccion: f.l, tokens: f.tokens };
    }
    if (tonos[id]) {
      const t = tonos[id];
      return { tipo: 'tonos', id, texto: t.w, pinyin: t.py, significado: t.es, tonos: t.t };
    }
    return null;
  }

  // Las palabras de un solo carácter ya se estudian como caracteres: no se repiten en el repaso
  const palabrasRepaso = V.palabras.filter(p => [...p.w].length > 1 || !D.caracteres[p.w]).map(p => p.id);

  window.Items = {
    get,
    existe: id => !!get(id),
    tonoDe,
    palabrasRepaso,
    palabrasDe: l => V.palabras.filter(p => p.l === l),
    frasesDe: l => V.frases.filter(f => f.l === l),
    // Todos los caracteres (de los que hay ficha) que contiene un texto
    caracteresDe: texto => [...new Set([...texto].filter(c => D.caracteres[c]))],
    pares: () => V.tonos,
  };
})();
