// Motor de preguntas: práctica libre, desafío por nivel, repaso espaciado y práctica de tonos.
(function () {
  const D = window.DATOS;
  const P = window.Progreso;
  const V = window.Vistas;
  const esc = V.esc;
  const $app = () => document.getElementById('app');

  const barajar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const azar = a => a[Math.random() * a.length | 0];
  const base = p => V.sinTono(p.split(/[\/ ]/)[0]).toLowerCase();

  const TODOS = Object.keys(D.caracteres);

  // Distractores: preferimos caracteres del mismo conjunto y de niveles cercanos
  function distractores(c, pool, n, filtro = () => true) {
    const ch = D.caracteres[c];
    const cercanos = TODOS.filter(x => Math.abs(D.caracteres[x].nivel - ch.nivel) <= 1);
    const candidatos = [...new Set([...barajar(pool), ...barajar(cercanos), ...barajar(TODOS)])]
      .filter(x => x !== c && filtro(D.caracteres[x]));
    const out = [];
    for (const x of candidatos) {
      if (out.length >= n) break;
      if (!out.some(y => D.caracteres[y].significado === D.caracteres[x].significado)) out.push(x);
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

  const TIPOS = {
    significado(c, pool) {
      const ch = D.caracteres[c];
      const ops = barajar([c, ...distractores(c, pool, 3)]);
      return {
        tipo: 'significado', c, enunciado: '¿Qué significa?',
        estimulo: `<span class="hz enorme">${esc(c)}</span>`,
        opciones: ops.map(x => ({ valor: x, html: esc(D.caracteres[x].significado) })), correcta: c,
        audio: c, explicacion: ch.descripcion,
      };
    },
    caracter(c, pool) {
      const ch = D.caracteres[c];
      const ops = barajar([c, ...distractores(c, pool, 3)]);
      return {
        tipo: 'caracter', c, enunciado: '¿Qué carácter es?',
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
        tipo: 'pinyin', c, enunciado: '¿Cómo se pronuncia?',
        estimulo: `<span class="hz enorme">${esc(c)}</span><div class="sig-peq">${esc(ch.significado)}</div>`,
        opciones: barajar([...opciones]).map(x => ({ valor: x, html: `<span class="py op-py">${esc(x)}</span>` })), correcta: sil,
        audio: c, explicacion: `${ch.pinyin} — ${ch.tono === 5 ? 'tono neutro' : ch.tono + '.º tono'}.`,
      };
    },
    escuchar(c, pool) {
      const ch = D.caracteres[c];
      const distintos = distractores(c, pool, 3, x => base(x.pinyin) !== base(ch.pinyin) || x.tono !== ch.tono);
      return {
        tipo: 'escuchar', c, enunciado: 'Escucha y elige el carácter',
        estimulo: `<button class="btn-escuchar" data-decir="${esc(c)}">🔊<small>Pulsa para escuchar otra vez</small></button>`,
        opciones: barajar([c, ...distintos]).map(x => ({ valor: x, html: `<span class="hz op-grande">${esc(x)}</span>` })), correcta: c,
        audio: c, autoAudio: true, explicacion: `${ch.pinyin}: ${ch.significado}.`,
      };
    },
    tono(c) {
      const ch = D.caracteres[c];
      const sil = ch.pinyin.split(/[\/ ]/)[0];
      return {
        tipo: 'tono', c, enunciado: '¿Qué tono tiene?',
        estimulo: `<span class="hz enorme">${esc(c)}</span><div class="py grande">${esc(V.sinTono(sil))} <button class="btn-audio" data-decir="${esc(c)}">🔊</button></div>`,
        opciones: [1, 2, 3, 4, 5].map(t => ({ valor: t, html: `<span class="${V.tonoClase(t)} op-tono">${t === 5 ? 'neutro' : t + '.º'}<small>${conTono('a', t)}</small></span>` })),
        correcta: ch.tono, audio: c, autoAudio: true, explicacion: `${ch.pinyin} (${ch.significado}).`,
      };
    },
    componer(c, pool) {
      const ch = D.caracteres[c];
      const comps = ch.componentes.filter(k => k.c && k.c !== '—');
      const ops = barajar([c, ...distractores(c, pool, 3, x => x.componentes.some(k => comps.some(m => m.c === k.c)) || Math.random() < 0.3)]);
      return {
        tipo: 'componer', c, enunciado: '¿Qué carácter se forma con estos componentes?',
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
        tipo: 'componente', c, enunciado: '¿Qué componente contiene este carácter?',
        estimulo: `<span class="hz enorme">${esc(c)}</span><div class="sig-peq">${esc(ch.significado)}</div>`,
        opciones: barajar([bueno.c, ...otros]).map(x => ({ valor: x, html: `<span class="hz op-grande">${esc(x)}</span>` })), correcta: bueno.c,
        audio: c, explicacion: `${c} = ${comps.map(k => `${k.c} (${k.nombre})`).join(' + ')}. ${ch.descripcion}`,
      };
    },
  };

  function tiposPosibles(c) {
    const ch = D.caracteres[c];
    const t = ['significado', 'caracter', 'pinyin', 'tono'];
    if (window.Voz.disponible()) t.push('escuchar');
    const comps = ch.componentes.filter(k => k.c && k.c !== '—' && k.c !== c);
    if (comps.length >= 2) t.push('componer');
    if (comps.length >= 1) t.push('componente');
    return t;
  }

  function generar(chars, n, soloTipo) {
    const lista = [];
    let orden = barajar(chars);
    while (lista.length < n) {
      if (!orden.length) orden = barajar(chars);
      const c = orden.pop();
      const tipo = soloTipo || azar(tiposPosibles(c));
      lista.push(TIPOS[tipo](c, chars));
    }
    return lista;
  }

  // ── Sesión de preguntas ─────────────────────────────────────────────
  // opts: { titulo, volver, chars, n (Infinity = práctica libre), modo: 'practica'|'desafio'|'repaso'|'tonos', nivel }
  function iniciar(opts) {
    const s = { ...opts, i: 0, aciertos: 0, fallos: [], respondida: false, preguntas: [] };
    const infinita = !isFinite(s.n);
    s.preguntas = generar(s.chars, infinita ? 10 : s.n, s.modo === 'tonos' ? 'tono' : null);
    pintar(s);
  }

  function pintar(s) {
    if (!isFinite(s.n) && s.i >= s.preguntas.length - 2) s.preguntas.push(...generar(s.chars, 10, s.modo === 'tonos' ? 'tono' : null));
    if (s.i >= s.n) return final(s);
    const q = s.preguntas[s.i];
    s.respondida = false;
    const total = isFinite(s.n) ? s.n : null;
    $app().innerHTML = `
      <nav class="migas"><a href="${s.volver}">← ${esc(s.titulo)}</a>
        <span class="marcador">✅ ${s.aciertos} · ❌ ${s.fallos.length}${total ? '' : ' · <a href="#" id="terminar">Terminar</a>'}</span></nav>
      ${total ? `<div class="progreso-fino"><span style="width:${s.i / total * 100}%"></span></div>` : ''}
      <section class="pregunta">
        <p class="enunciado-q">${q.enunciado}${total ? ` <small>${s.i + 1}/${total}</small>` : ''}</p>
        <div class="estimulo">${q.estimulo}</div>
        <div class="opciones ${q.opciones.length === 5 ? 'cinco' : ''}">
          ${q.opciones.map((o, k) => `<button class="opcion" data-k="${k}"><kbd>${k + 1}</kbd>${o.html}</button>`).join('')}
        </div>
        <div id="feedback" aria-live="polite"></div>
      </section>`;
    if (q.autoAudio) setTimeout(() => window.Voz.decir(q.audio), 250);
    $app().querySelectorAll('.opcion').forEach(b => b.onclick = () => responder(s, +b.dataset.k));
    const term = document.getElementById('terminar');
    if (term) term.onclick = e => { e.preventDefault(); s.n = s.i; final(s); };
    const teclasQ = {};
    q.opciones.forEach((_, k) => teclasQ[String(k + 1)] = () => !s.respondida && responder(s, k));
    teclasQ.Enter = () => s.respondida && siguiente(s);
    V.teclas(teclasQ);
  }

  function responder(s, k) {
    if (s.respondida) return;
    s.respondida = true;
    const q = s.preguntas[s.i];
    const elegida = q.opciones[k];
    const bien = elegida.valor === q.correcta;
    if (bien) s.aciertos++; else s.fallos.push(q.c);
    P.responder(q.c, bien);
    $app().querySelectorAll('.opcion').forEach((b, j) => {
      b.disabled = true;
      if (q.opciones[j].valor === q.correcta) b.classList.add('correcta');
      else if (j === k) b.classList.add('incorrecta');
    });
    const ch = D.caracteres[q.c];
    document.getElementById('feedback').innerHTML = `
      <div class="feedback ${bien ? 'ok' : 'mal'}">
        <div class="fb-titulo">${bien ? '¡Correcto! 🎉' : 'No exactamente…'}</div>
        <div class="fb-char"><a href="#/caracter/${encodeURIComponent(q.c)}" target="_blank" class="hz">${esc(q.c)}</a>
          <span class="py ${V.tonoClase(ch.tono)}">${esc(ch.pinyin)}</span> <span>${esc(ch.significado)}</span> ${V.hablar(q.c)}</div>
        <p>${esc(q.explicacion)}</p>
        <button class="btn" id="siguiente">Continuar <kbd>Enter</kbd></button>
      </div>`;
    document.getElementById('siguiente').onclick = () => siguiente(s);
    document.getElementById('siguiente').focus({ preventScroll: true });
    if (bien) window.Voz.decir(q.audio);
  }

  function siguiente(s) { s.i++; pintar(s); }

  function final(s) {
    V.teclas(null);
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
        ${fallados.length ? `<h3>Para repasar</h3><div class="chips">${fallados.map(V.chip).join('')}</div>` : ''}
        <div class="fila botones centrada">
          <a class="btn" href="${location.hash}" id="otra">Otra vez</a>
          ${fallados.length ? `<button class="btn sec" id="solo-fallos">Practicar solo los fallos</button>` : ''}
          <a class="btn sec" href="${s.volver}">Volver</a>
        </div>
      </section>`;
    document.getElementById('otra').onclick = e => { e.preventDefault(); iniciar({ ...s }); };
    const sf = document.getElementById('solo-fallos');
    if (sf) sf.onclick = () => iniciar({ ...s, chars: fallados, n: Math.max(6, fallados.length * 2), modo: s.modo === 'desafio' ? 'practica' : s.modo, titulo: s.titulo });
  }

  window.Quiz = { iniciar };
})();
