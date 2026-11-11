// Motor de preguntas para caracteres, palabras, frases y pares de tonos (ver js/items.js).
// Lo usan la práctica libre, el desafío de cada nivel, la sesión de hoy y la práctica de tonos.
(function () {
  const D = window.DATOS;
  const P = window.Progreso;
  const V = window.Vistas;
  const I = window.Items;
  const esc = V.esc;
  const $app = () => document.getElementById('app');

  const barajar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const azar = a => a[Math.random() * a.length | 0];
  const base = p => V.sinTono(p.split(/[\/ ]/)[0]).toLowerCase();
  const PUNTUACION = /^[，。？！、；：,.?!]+$/;

  const TODOS = Object.keys(D.caracteres);
  const PALABRAS = D.vocabulario.palabras;
  const FRASES = D.vocabulario.frases;

  // Distractores: preferimos caracteres del mismo conjunto y de niveles cercanos
  function distractores(c, pool, n, filtro = () => true) {
    const ch = D.caracteres[c];
    const cercanos = TODOS.filter(x => Math.abs(D.caracteres[x].nivel - ch.nivel) <= 1);
    const candidatos = [...new Set([...barajar(pool.filter(x => D.caracteres[x])), ...barajar(cercanos), ...barajar(TODOS)])]
      .filter(x => x !== c && filtro(D.caracteres[x]));
    const out = [];
    for (const x of candidatos) {
      if (out.length >= n) break;
      if (!out.some(y => D.caracteres[y].significado === D.caracteres[x].significado)) out.push(x);
    }
    return out;
  }

  // Distractores de palabras o frases: misma lección o cercana, sin significados repetidos
  function otrosDe(lista, item, n, clave = 'es') {
    const cerca = barajar(lista.filter(x => x.id !== item.id && Math.abs(x.l - item.leccion) <= 1));
    const resto = barajar(lista.filter(x => x.id !== item.id));
    const out = [];
    for (const x of [...cerca, ...resto]) {
      if (out.length >= n) break;
      if (x[clave] !== item[clave === 'es' ? 'significado' : 'texto'] && !out.some(y => y[clave] === x[clave])) out.push(x);
    }
    return out;
  }

  // Formas de aplicar una marca de tono a una sílaba (para distractores de pinyin)
  const TABLA = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  function conTono(silaba, t) {
    const s = V.sinTono(silaba);
    if (t === 5) return s;
    let idx = s.search(/[ae]/);
    if (idx < 0) idx = s.indexOf('ou');
    if (idx < 0) { const m = [...s.matchAll(/[iouü]/g)]; idx = m.length ? m[m.length - 1].index : -1; }
    if (idx < 0) return s;
    return s.slice(0, idx) + TABLA[s[idx]][t - 1] + s.slice(idx + 1);
  }
  const nombreTono = t => t === 5 ? 'neutro' : t + '.º';

  // ── Preguntas sobre caracteres ──────────────────────────────────────
  const TIPOS = {
    significado(c, pool) {
      const ch = D.caracteres[c];
      const ops = barajar([c, ...distractores(c, pool, 3)]);
      return {
        tipo: 'significado', id: c, enunciado: '¿Qué significa?',
        estimulo: `<span class="hz enorme">${esc(c)}</span>`,
        opciones: ops.map(x => ({ valor: x, html: esc(D.caracteres[x].significado) })), correcta: c,
        audio: c, explicacion: ch.descripcion,
      };
    },
    caracter(c, pool) {
      const ch = D.caracteres[c];
      const ops = barajar([c, ...distractores(c, pool, 3)]);
      return {
        tipo: 'caracter', id: c, enunciado: '¿Qué carácter es?',
        estimulo: `<div class="significado grande">${esc(ch.significado)}</div>`,
        opciones: ops.map(x => ({ valor: x, html: `<span class="hz op-grande">${esc(x)}</span>` })), correcta: c,
        audio: c, explicacion: ch.descripcion,
      };
    },
    pinyin(c) {
      const ch = D.caracteres[c];
      const sil = ch.pinyin.split(/[\/ ]/)[0];
      const opciones = new Set([sil]);
      // Primero, la misma sílaba con otros tonos (lo más útil para entrenar el oído)
      for (const t of barajar([1, 2, 3, 4])) { if (opciones.size >= 3) break; opciones.add(conTono(sil, t)); }
      for (const x of barajar(TODOS)) { if (opciones.size >= 4) break; const s = D.caracteres[x].pinyin.split(/[\/ ]/)[0]; if (base(s) !== base(sil)) opciones.add(s); }
      return {
        tipo: 'pinyin', id: c, enunciado: '¿Cómo se pronuncia?',
        estimulo: `<span class="hz enorme">${esc(c)}</span><div class="sig-peq">${esc(ch.significado)}</div>`,
        opciones: barajar([...opciones]).map(x => ({ valor: x, html: `<span class="py op-py">${esc(x)}</span>` })), correcta: sil,
        audio: c, explicacion: `${ch.pinyin} — ${ch.tono === 5 ? 'tono neutro' : ch.tono + '.º tono'}.`,
      };
    },
    escuchar(c, pool) {
      const ch = D.caracteres[c];
      const distintos = distractores(c, pool, 3, x => base(x.pinyin) !== base(ch.pinyin) || x.tono !== ch.tono);
      return {
        tipo: 'escuchar', id: c, enunciado: 'Escucha y elige el carácter',
        estimulo: botonEscuchar(c),
        opciones: barajar([c, ...distintos]).map(x => ({ valor: x, html: `<span class="hz op-grande">${esc(x)}</span>` })), correcta: c,
        audio: c, autoAudio: true, explicacion: `${ch.pinyin}: ${ch.significado}.`,
      };
    },
    tono(c) {
      const ch = D.caracteres[c];
      const sil = ch.pinyin.split(/[\/ ]/)[0];
      return {
        tipo: 'tono', id: c, enunciado: '¿Qué tono tiene?',
        estimulo: `<span class="hz enorme">${esc(c)}</span><div class="py grande">${esc(V.sinTono(sil))} <button class="btn-audio" data-decir="${esc(c)}" aria-label="Escuchar">${window.Iconos.svg('altavoz')}</button></div>`,
        opciones: [1, 2, 3, 4, 5].map(t => ({ valor: t, html: `<span class="${V.tonoClase(t)} op-tono">${nombreTono(t)}<small>${conTono('a', t)}</small></span>` })),
        correcta: ch.tono, audio: c, autoAudio: true, explicacion: `${ch.pinyin} (${ch.significado}).`,
      };
    },
    componer(c, pool) {
      const ch = D.caracteres[c];
      const comps = ch.componentes.filter(k => k.c && k.c !== '—');
      const ops = barajar([c, ...distractores(c, pool, 3, x => x.componentes.some(k => comps.some(m => m.c === k.c)) || Math.random() < 0.3)]);
      return {
        tipo: 'componer', id: c, enunciado: '¿Qué carácter se forma con estos componentes?',
        estimulo: `<div class="composicion centrada">${comps.map((k, i) => `${i ? '<span class="mas">+</span>' : ''}<span class="comp"><span class="hz">${esc(k.c)}</span><small>${esc(k.nombre)}</small></span>`).join('')}<span class="mas">=</span><span class="comp resultado"><span class="hz">?</span></span></div>`,
        opciones: ops.map(x => ({ valor: x, html: `<span class="hz op-grande">${esc(x)}</span>` })), correcta: c,
        audio: c, explicacion: ch.descripcion,
      };
    },
    componente(c) {
      const ch = D.caracteres[c];
      const comps = ch.componentes.filter(k => k.c && k.c !== '—' && k.c !== c);
      const bueno = azar(comps);
      const otros = barajar(D.componentes.map(f => f.c)).filter(x => !comps.some(k => k.c === x) && !ch.descomposicion?.includes(x)).slice(0, 3);
      return {
        tipo: 'componente', id: c, enunciado: '¿Qué componente contiene este carácter?',
        estimulo: `<span class="hz enorme">${esc(c)}</span><div class="sig-peq">${esc(ch.significado)}</div>`,
        opciones: barajar([bueno.c, ...otros]).map(x => ({ valor: x, html: `<span class="hz op-grande">${esc(x)}</span>` })), correcta: bueno.c,
        audio: c, explicacion: `${c} = ${comps.map(k => `${k.c} (${k.nombre})`).join(' + ')}. ${ch.descripcion}`,
      };
    },

    // ── Palabras ──
    palabraSignificado(id) {
      const it = I.get(id);
      const ops = barajar([{ id, es: it.significado }, ...otrosDe(PALABRAS, it, 3)]);
      return {
        tipo: 'palabraSignificado', id, enunciado: '¿Qué significa esta palabra?',
        estimulo: `<span class="hz palabra-grande">${esc(it.texto)}</span> <button class="btn-audio" data-decir="${esc(it.texto)}" aria-label="Escuchar">${window.Iconos.svg('altavoz')}</button>`,
        opciones: ops.map(x => ({ valor: x.id, html: esc(x.es) })), correcta: id,
        audio: it.texto, explicacion: `${it.texto} (${it.pinyin}): ${it.significado}.`,
      };
    },
    palabraTexto(id) {
      const it = I.get(id);
      const ops = barajar([{ id, w: it.texto }, ...otrosDe(PALABRAS, it, 3)]);
      return {
        tipo: 'palabraTexto', id, enunciado: '¿Cómo se dice en chino?',
        estimulo: `<div class="significado grande">${esc(it.significado)}</div>`,
        opciones: ops.map(x => ({ valor: x.id, html: `<span class="hz op-palabra">${esc(x.w)}</span>` })), correcta: id,
        audio: it.texto, explicacion: `${it.texto} (${it.pinyin}): ${it.significado}.`,
      };
    },
    palabraPinyin(id) {
      const it = I.get(id);
      const largo = [...it.texto].length;
      const parecidas = PALABRAS.filter(p => p.id !== id && [...p.w].length === largo && p.py !== it.pinyin);
      const ops = barajar([{ id, py: it.pinyin }, ...barajar(parecidas).filter((p, i, a) => a.findIndex(q => q.py === p.py) === i).slice(0, 3)]);
      return {
        tipo: 'palabraPinyin', id, enunciado: '¿Cómo se pronuncia?',
        estimulo: `<span class="hz palabra-grande">${esc(it.texto)}</span><div class="sig-peq">${esc(it.significado)}</div>`,
        opciones: ops.map(x => ({ valor: x.id, html: `<span class="py op-py">${esc(x.py)}</span>` })), correcta: id,
        audio: it.texto, explicacion: `${it.texto}: ${it.pinyin}.`,
      };
    },
    palabraEscuchar(id) {
      const it = I.get(id);
      const ops = barajar([{ id, w: it.texto }, ...otrosDe(PALABRAS, it, 3)]);
      return {
        tipo: 'palabraEscuchar', id, enunciado: 'Escucha y elige la palabra',
        estimulo: botonEscuchar(it.texto),
        opciones: ops.map(x => ({ valor: x.id, html: `<span class="hz op-palabra">${esc(x.w)}</span>` })), correcta: id,
        audio: it.texto, autoAudio: true, explicacion: `${it.texto} (${it.pinyin}): ${it.significado}.`,
      };
    },

    // ── Frases ──
    fraseTraducir(id) {
      const it = I.get(id);
      const ops = barajar([{ id, es: it.significado }, ...otrosDe(FRASES, it, 3)]);
      return {
        tipo: 'fraseTraducir', id, enunciado: '¿Qué significa esta frase?',
        estimulo: `<div class="hz frase-grande">${esc(it.texto)}</div><button class="btn-audio" data-decir="${esc(it.texto)}" aria-label="Escuchar">${window.Iconos.svg('altavoz')}</button>`,
        opciones: ops.map(x => ({ valor: x.id, html: esc(x.es) })), correcta: id,
        audio: it.texto, explicacion: `${it.pinyin} — ${it.significado}`,
      };
    },
    fraseEscuchar(id) {
      const it = I.get(id);
      const ops = barajar([{ id, es: it.significado }, ...otrosDe(FRASES, it, 3)]);
      return {
        tipo: 'fraseEscuchar', id, enunciado: 'Escucha la frase: ¿qué significa?',
        estimulo: botonEscuchar(it.texto),
        opciones: ops.map(x => ({ valor: x.id, html: esc(x.es) })), correcta: id,
        audio: it.texto, autoAudio: true, explicacion: `${it.texto} — ${it.pinyin}`,
      };
    },
    fraseOrdenar(id) {
      const it = I.get(id);
      const piezas = it.tokens.filter(t => !PUNTUACION.test(t));
      const final = it.tokens.filter(t => PUNTUACION.test(t)).pop() || '';
      let fichas = barajar(piezas.map((t, i) => ({ t, i })));
      // Que no salga ya ordenada
      for (let k = 0; k < 5 && fichas.every((f, j) => f.t === piezas[j]); k++) fichas = barajar(fichas);
      return {
        tipo: 'fraseOrdenar', id, ordenar: true, enunciado: 'Ordena las palabras para formar la frase',
        estimulo: `<div class="significado grande">${esc(it.significado)}</div>`,
        fichas, solucion: piezas.join(''), final,
        audio: it.texto, explicacion: `${it.texto} — ${it.pinyin}`,
      };
    },

    // ── Producción: recordar sin opciones ──
    escribirPinyin(id) {
      const it = I.get(id);
      const pinyin = it.tipo === 'caracter' ? it.pinyin.split(/[\/ ]/)[0] : it.pinyin;
      return {
        tipo: 'escribirPinyin', id, escribir: 'pinyin', enunciado: 'Escribe el pinyin con sus tonos',
        estimulo: `<span class="hz ${it.tipo === 'caracter' ? 'enorme' : 'palabra-grande'}">${esc(it.texto)}</span><div class="sig-peq">${esc(it.significado)}</div>`,
        solucion: pinyin, audio: it.texto,
        explicacion: `${it.texto} se escribe ${pinyin}.`,
      };
    },
    escribirCaracter(id) {
      const it = I.get(id);
      return {
        tipo: 'escribirCaracter', id, escribir: 'caracter', enunciado: 'Escribe el carácter de memoria',
        estimulo: `<div class="significado grande">${esc(it.significado)}</div><div class="py grande ${V.tonoClase(it.tono)}">${esc(it.pinyin)}</div>`,
        audio: it.texto, explicacion: D.caracteres[id].descripcion,
      };
    },

    // ── Pares de tonos ──
    parTonos(id) {
      const it = I.get(id);
      const [a, b] = it.tonos;
      const clave = t => t.join('-');
      const todos = [];
      for (let x = 1; x <= 4; x++) for (let y = 1; y <= 5; y++) todos.push([x, y]);
      // Distractores difíciles: comparten un tono con la respuesta
      const cerca = barajar(todos.filter(t => clave(t) !== clave(it.tonos) && (t[0] === a || t[1] === b)));
      const ops = barajar([it.tonos, ...cerca.slice(0, 3)]);
      const etiqueta = t => `<span class="${V.tonoClase(t[0])}">${nombreTono(t[0])}</span> + <span class="${V.tonoClase(t[1])}">${nombreTono(t[1])}</span>`;
      return {
        tipo: 'parTonos', id, srs: false, enunciado: '¿Qué tonos oyes?',
        estimulo: `${botonEscuchar(it.texto)}<div class="py grande">${esc(V.sinTono(it.pinyin))}</div>`,
        opciones: ops.map(t => ({ valor: clave(t), html: `<span class="op-tono">${etiqueta(t)}</span>` })), correcta: clave(it.tonos),
        audio: it.texto, autoAudio: true,
        explicacion: `${it.texto} ${it.pinyin} (${it.significado}).${a === 3 && b === 3 ? ' Ojo: dos terceros tonos seguidos se pronuncian 2.º + 3.º.' : ''}`,
      };
    },
  };

  // data-repetir: "escuchar otra vez" repite con la misma voz (las preguntas de escucha varían de voz)
  function botonEscuchar(texto) {
    return `<button class="btn-escuchar" data-decir="${esc(texto)}" data-repetir>${window.Iconos.svg('altavoz')}<small>Pulsa para escuchar otra vez</small></button>`;
  }

  // Tipos de pregunta que tienen sentido para cada elemento.
  // Los de producción (escribir el pinyin, escribir el carácter de memoria) solo cuando el elemento ya se ha
  // practicado algo: recordar sin opciones fija más que reconocer, pero exige haberlo visto antes.
  function tiposPosibles(id) {
    const it = I.get(id);
    const voz = window.Voz.disponible() && window.Voz.activa();
    const practicado = P.dominio(id) >= 1 && (P.char(id)?.aciertos || 0) >= 1;
    if (it.tipo === 'caracter') {
      const ch = D.caracteres[id];
      const t = ['significado', 'caracter', 'pinyin', 'tono'];
      if (voz) t.push('escuchar');
      const comps = ch.componentes.filter(k => k.c && k.c !== '—' && k.c !== id);
      if (comps.length >= 2) t.push('componer');
      if (comps.length >= 1) t.push('componente');
      if (practicado) t.push('escribirPinyin', 'escribirPinyin', ...(window.HanziWriter && window.TRAZOS?.[id] ? ['escribirCaracter', 'escribirCaracter'] : []));
      return t;
    }
    if (it.tipo === 'palabra') return ['palabraSignificado', 'palabraTexto', 'palabraPinyin', ...(voz ? ['palabraEscuchar'] : []), ...(practicado ? ['escribirPinyin', 'escribirPinyin'] : [])];
    if (it.tipo === 'frase') {
      const piezas = it.tokens.filter(t => !PUNTUACION.test(t)).length;
      return [...(piezas >= 3 ? ['fraseOrdenar', 'fraseOrdenar'] : []), 'fraseTraducir', ...(voz ? ['fraseEscuchar'] : [])];
    }
    if (it.tipo === 'tonos') return ['parTonos'];
    return [];
  }

  function pregunta(id, pool, soloTipo) {
    const tipo = soloTipo || azar(tiposPosibles(id));
    return TIPOS[tipo](id, pool);
  }

  function generar(ids, n, soloTipo) {
    const lista = [];
    let orden = barajar(ids);
    while (lista.length < n) {
      if (!orden.length) orden = barajar(ids);
      lista.push(pregunta(orden.pop(), ids, soloTipo));
    }
    return lista;
  }

  // ── Sesión de preguntas ─────────────────────────────────────────────
  // opts: { titulo, volver, chars (ids), n (Infinity = práctica libre), modo, nivel,
  //         preguntas (lista ya preparada), sinSRS (no cambia la repetición espaciada), alTerminar(s) }
  function iniciar(opts) {
    const s = { ...opts, i: 0, aciertos: 0, fallos: [], respondida: false, nOriginal: opts.nOriginal || opts.n };
    const soloTipo = s.modo === 'tonos' ? 'tono' : s.modo === 'pares' ? 'parTonos' : null;
    if (s.preguntas) { s.preguntas = s.preguntas.slice(); s.n = s.preguntas.length; }
    else s.preguntas = generar(s.chars, isFinite(s.n) ? s.n : 10, soloTipo);
    s.soloTipo = soloTipo;
    pintar(s);
  }

  function pintar(s) {
    if (!isFinite(s.n) && s.i >= s.preguntas.length - 2) s.preguntas.push(...generar(s.chars, 10, s.soloTipo));
    if (s.i >= s.n) return final(s);
    const q = s.preguntas[s.i];
    s.respondida = false;
    const total = isFinite(s.n) ? s.n : null;
    $app().innerHTML = `
      <nav class="migas"><a href="${s.volver}">← ${esc(s.titulo)}</a>
        <span class="marcador"><span class="m-ok">${window.Iconos.svg('check')} ${s.aciertos}</span><span class="m-mal">${window.Iconos.svg('x')} ${s.fallos.length}</span>${total ? '' : ' · <a href="#" id="terminar">Terminar</a>'}</span></nav>
      ${total ? `<div class="progreso-fino"><span style="width:${s.i / total * 100}%"></span></div>` : ''}
      ${s.sinSRS ? '<p class="nota centrada-txt">Práctica extra: no cambia tu repaso programado.</p>' : ''}
      <section class="pregunta">
        <p class="enunciado-q">${q.enunciado}${total ? ` <small>${s.i + 1}/${total}</small>` : ''}</p>
        <div class="estimulo">${q.estimulo}</div>
        ${q.ordenar ? htmlOrdenar(q) : q.escribir === 'pinyin' ? htmlPinyin() : q.escribir === 'caracter' ? htmlCaracter() : `
        <div class="opciones ${q.opciones.length === 5 ? 'cinco' : ''}">
          ${q.opciones.map((o, k) => `<button class="opcion" data-k="${k}"><kbd>${k + 1}</kbd>${o.html}</button>`).join('')}
        </div>`}
        <div id="feedback" aria-live="polite"></div>
      </section>`;
    // Las preguntas de escucha suenan cada vez con una voz distinta
    if (q.autoAudio) setTimeout(() => window.Voz.decir(q.audio, undefined, { variar: true }), 250);
    const term = document.getElementById('terminar');
    if (term) term.onclick = e => { e.preventDefault(); registrar(s); s.n = s.i; final(s); };
    const teclasQ = { Enter: () => s.respondida && siguiente(s) };
    if (q.ordenar) montarOrdenar(s, q);
    else if (q.escribir === 'pinyin') montarPinyin(s, q);
    else if (q.escribir === 'caracter') montarCaracter(s, q);
    else {
      $app().querySelectorAll('.opcion').forEach(b => b.onclick = () => responder(s, q.opciones[+b.dataset.k].valor, +b.dataset.k));
      q.opciones.forEach((o, k) => teclasQ[String(k + 1)] = () => !s.respondida && responder(s, o.valor, k));
    }
    // Tras acertar, responder() añade: 1 = Difícil, 2 o Enter = Bien, 3 = Fácil (valoración para FSRS)
    V.teclas(teclasQ);
    s.teclasQ = teclasQ;
  }

  // ── Escribir el pinyin ──
  function htmlPinyin() {
    return `
      <form class="escribir-py" id="form-py" autocomplete="off">
        <input class="campo campo-py" id="campo-py" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false"
          placeholder="ni3 hao3" aria-label="Pinyin con números de tono">
        <button class="btn">Comprobar</button>
      </form>
      <p class="nota centrada-txt">Escribe el tono con un número tras cada sílaba (5 o nada = neutro). ü se escribe <b>v</b>: nv3 = nǚ.</p>`;
  }
  function montarPinyin(s, q) {
    const campo = document.getElementById('campo-py');
    campo.focus({ preventScroll: true });
    document.getElementById('form-py').onsubmit = e => {
      e.preventDefault();
      if (s.respondida || !campo.value.trim()) return;
      const r = window.Pronunciar.compararPinyin(campo.value, q.solucion);
      campo.disabled = true;
      campo.classList.add(r.ok ? 'bien' : 'mal');
      q.detallePinyin = r;
      responder(s, campo.value, -1, r.ok);
    };
  }
  function detallePinyinHTML(r) {
    if (!r || r.ok) return '';
    const marcar = d => window.Iconos.svg(d.sonido && d.tono ? 'check' : d.sonido ? 'tonos' : 'x', d.sonido && d.tono ? 'c-ok' : d.sonido ? 'c-aviso' : 'c-mal');
    return `<ul class="detalle-py">${r.detalle.map(d => `<li>${marcar(d)} <b>${esc(d.esperado.s)}${d.esperado.t}</b>${d.escrito ? ` · escribiste ${esc(d.escrito.s)}${d.escrito.t}` : ' · falta'}${d.sonido && !d.tono ? ' (el sonido está bien, el tono no)' : ''}</li>`).join('')}</ul>
      ${r.faltanTonos ? '<p class="aviso-mal">Recuerda escribir el número de tono tras cada sílaba.</p>' : ''}`;
  }

  // ── Escribir el carácter de memoria (sin guía) ──
  function htmlCaracter() {
    return `
      <div class="trazos-caja grande"><div id="hw" class="hw cuadricula"></div></div>
      <div class="fila botones centrada"><button class="btn sec" id="no-recuerdo">No me acuerdo</button></div>`;
  }
  function montarCaracter(s, q) {
    const ch = D.caracteres[q.id];
    const w = V.montarWriter(q.id, { showOutline: false, showCharacter: false, width: 260, height: 260 });
    if (!w) return responder(s, null, -1, false);
    const caja = document.querySelector('.trazos-caja');
    // En pantallas táctiles, que trazar no desplace la página
    caja.style.touchAction = 'none';
    w.quiz({
      showHintAfterMisses: 3,
      onComplete: r => { if (!s.respondida) responder(s, null, -1, r.totalMistakes <= Math.max(1, Math.floor(ch.trazos / 4))); },
    });
    document.getElementById('no-recuerdo').onclick = () => {
      if (s.respondida) return;
      responder(s, null, -1, false);
      const ver = V.montarWriter(q.id, { width: 260, height: 260 });
      ver && ver.animateCharacter();
    };
  }

  // Ejercicio de ordenar: se tocan las fichas en orden; se pueden devolver tocándolas otra vez
  function htmlOrdenar(q) {
    return `
      <div class="ordenar">
        <div class="respuesta-orden hz" id="respuesta" aria-live="polite"><span class="hueco">Toca las palabras en orden…</span></div>
        <div class="fichas hz" id="fichas">${q.fichas.map((f, k) => `<button class="ficha-p" data-k="${k}">${esc(f.t)}</button>`).join('')}</div>
        <div class="fila botones centrada">
          <button class="btn sec" id="borrar-orden">↺ Empezar de nuevo</button>
          <button class="btn" id="comprobar" disabled>Comprobar</button>
        </div>
      </div>`;
  }
  function montarOrdenar(s, q) {
    const elegidas = [];
    const $resp = document.getElementById('respuesta');
    const $comp = document.getElementById('comprobar');
    const repintar = () => {
      $resp.innerHTML = elegidas.length
        ? elegidas.map((k, j) => `<button class="ficha-p puesta" data-j="${j}">${esc(q.fichas[k].t)}</button>`).join('') + `<span>${esc(q.final)}</span>`
        : '<span class="hueco">Toca las palabras en orden…</span>';
      document.querySelectorAll('#fichas .ficha-p').forEach(b => { b.disabled = elegidas.includes(+b.dataset.k) || s.respondida; });
      $comp.disabled = elegidas.length !== q.fichas.length || s.respondida;
      $resp.querySelectorAll('.puesta').forEach(b => b.onclick = () => { if (!s.respondida) { elegidas.splice(+b.dataset.j, 1); repintar(); } });
    };
    document.querySelectorAll('#fichas .ficha-p').forEach(b => b.onclick = () => {
      if (s.respondida) return;
      elegidas.push(+b.dataset.k);
      window.Voz.decir(q.fichas[+b.dataset.k].t);
      repintar();
    });
    document.getElementById('borrar-orden').onclick = () => { if (!s.respondida) { elegidas.length = 0; repintar(); } };
    $comp.onclick = () => {
      const dada = elegidas.map(k => q.fichas[k].t).join('');
      responder(s, dada, -1, dada === q.solucion);
      repintar();
      $resp.classList.add(dada === q.solucion ? 'bien' : 'mal');
    };
  }

  function responder(s, valor, k, forzado) {
    if (s.respondida) return;
    s.respondida = true;
    const q = s.preguntas[s.i];
    const bien = forzado !== undefined ? forzado : valor === q.correcta;
    if (bien) s.aciertos++; else s.fallos.push(q.id);
    // El registro en la repetición espaciada espera a la valoración (Difícil/Bien/Fácil) o al «Continuar»
    s.pendiente = !s.sinSRS && q.srs !== false ? { id: q.id, bien } : null;
    // Reaprendizaje en la sesión de hoy: lo fallado vuelve a preguntarse al final (una vez)
    if (!bien && s.modo === 'sesion') {
      s.repetidos = s.repetidos || new Set();
      if (!s.repetidos.has(q.id)) {
        s.repetidos.add(q.id);
        const otra = pregunta(q.id, s.preguntas.map(p => p.id));
        otra.repaso = true; // la nota de FSRS ya se puso al fallar
        otra.srs = false;
        s.preguntas.push(otra);
        s.n = s.preguntas.length;
      }
    }
    if (!q.ordenar && !q.escribir) {
      $app().querySelectorAll('.opcion').forEach((b, j) => {
        b.disabled = true;
        if (q.opciones[j].valor === q.correcta) b.classList.add('correcta');
        else if (j === k) b.classList.add('incorrecta');
      });
    }
    const it = I.get(q.id);
    const enlace = it.tipo === 'caracter'
      ? `<a href="#/caracter/${encodeURIComponent(it.texto)}" target="_blank" class="hz">${esc(it.texto)}</a>`
      : `<span class="hz">${esc(it.texto)}</span>`;
    document.getElementById('feedback').innerHTML = `
      <div class="feedback ${bien ? 'ok' : 'mal'}">
        <div class="fb-titulo">${bien ? '¡Correcto! 🎉' : 'No exactamente…'}</div>
        <div class="fb-char">${enlace}
          <span class="py ${it.tono ? V.tonoClase(it.tono) : ''}">${esc(it.pinyin)}</span> <span>${esc(it.significado)}</span> ${V.hablar(it.texto)}</div>
        ${q.escribir === 'pinyin' ? detallePinyinHTML(q.detallePinyin) : ''}
        <p>${esc(q.explicacion)}</p>
        ${q.repaso ? '<p class="nota">↻ Repaso de un fallo anterior de esta sesión.</p>' : ''}
        ${bien && s.pendiente ? `
        <div class="valoracion" role="group" aria-label="¿Cómo te resultó?">
          <span class="nota">¿Cómo te resultó?</span>
          <button class="btn sec" data-nota="2">😓 Difícil <kbd>1</kbd></button>
          <button class="btn" id="siguiente" data-nota="3">🙂 Bien <kbd>Enter</kbd></button>
          <button class="btn sec" data-nota="4">😎 Fácil <kbd>3</kbd></button>
        </div>` : `<button class="btn" id="siguiente">Continuar <kbd>Enter</kbd></button>`}
      </div>`;
    document.querySelectorAll('#feedback [data-nota]').forEach(b => b.onclick = () => siguiente(s, +b.dataset.nota));
    document.getElementById('siguiente').onclick = () => siguiente(s, 3);
    document.getElementById('siguiente').focus({ preventScroll: true });
    if (s.teclasQ) {
      s.teclasQ.Enter = () => siguiente(s, 3);
      if (bien && s.pendiente) { s.teclasQ['1'] = () => siguiente(s, 2); s.teclasQ['2'] = () => siguiente(s, 3); s.teclasQ['3'] = () => siguiente(s, 4); }
    }
    if (bien) window.Voz.decir(q.audio);
  }

  // Guarda en la repetición espaciada la respuesta pendiente (con su valoración)
  function registrar(s, nota = 3) {
    if (s.pendiente) { P.responder(s.pendiente.id, s.pendiente.bien, nota); s.pendiente = null; }
  }

  function siguiente(s, nota = 3) { registrar(s, nota); s.i++; pintar(s); }

  function final(s) {
    V.teclas(null);
    if (s.alTerminar) return s.alTerminar(s);
    const total = s.i;
    const pct = total ? s.aciertos / total : 0;
    let extra = '';
    if (s.modo === 'desafio' && total) {
      const antes = P.nivel(s.nivel).estrellas;
      const est = P.terminarNivel(s.nivel, pct);
      const desbloquea = est > 0 && antes === 0 && s.nivel < D.niveles.length;
      extra = `<div class="estrellas-grandes">${V.estrellas(est)}</div>
        ${est === 0 ? `<p>Necesitas un 70 % para ganar la primera estrella. ¡Repasa y vuelve a intentarlo!</p>` : ''}
        ${desbloquea ? `<p class="desbloqueo">🔓 ¡Has desbloqueado el <a href="#/nivel/${s.nivel + 1}">nivel ${s.nivel + 1}</a>!</p>` : ''}`;
    }
    const fallados = [...new Set(s.fallos)];
    $app().innerHTML = `
      <section class="final">
        <h1>${pct >= 0.85 ? '¡Excelente! 太棒了!' : pct >= 0.7 ? '¡Muy bien! 很好!' : '¡Sigue practicando! 加油!'}</h1>
        <div class="puntuacion"><b>${s.aciertos}</b> / ${total} <span>(${Math.round(pct * 100)} %)</span></div>
        ${extra}
        ${fallados.length ? `<h3>Para repasar</h3><div class="chips">${fallados.map(V.chipItem).join('')}</div>` : ''}
        <div class="fila botones centrada">
          <button class="btn" id="otra">Otra vez</button>
          ${fallados.length ? `<button class="btn sec" id="solo-fallos">Practicar solo los fallos</button>` : ''}
          <a class="btn sec" href="${s.volver}">Volver</a>
        </div>
      </section>`;
    const reinicio = { ...s, preguntas: undefined, n: s.nOriginal || s.n };
    document.getElementById('otra').onclick = () => iniciar(reinicio);
    const sf = document.getElementById('solo-fallos');
    if (sf) sf.onclick = () => iniciar({ ...reinicio, chars: fallados, n: Math.max(6, fallados.length * 2), modo: s.modo === 'desafio' ? 'practica' : s.modo });
  }

  window.Quiz = { iniciar, pregunta, generar, tiposPosibles };
})();
