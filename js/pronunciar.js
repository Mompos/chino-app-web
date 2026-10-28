// Pronunciación: grabarte y comparar tu curva de tono con la de cada tono.
// Todo ocurre en el dispositivo: el audio no se guarda ni se envía a ningún sitio.
//   1. Se capta el micrófono y se estima la frecuencia de la voz (autocorrelación) ~60 veces por segundo.
//   2. La curva se pasa a semitonos respecto a tu tono medio (así sirve para voces graves y agudas).
//   3. Se divide en sílabas y cada una se compara con el contorno ideal de su tono.
(function () {
  const V = window.Vistas;
  const I = window.Items;
  const esc = V.esc;

  // Contornos ideales en la escala de 5 niveles de Chao (5 = agudo, 1 = grave)
  const CONTORNO = { 1: [5, 5], 2: [3, 5], 3: [2, 1, 4], 4: [5, 1], 5: [2.5, 2.5] };
  const ST_POR_NIVEL = 2.2; // semitonos entre niveles (rango típico de una voz al hablar: ~9 semitonos)

  // ── Pinyin → tonos de cada sílaba ──
  // La "r" final de erhua (哪儿 nǎr) solo cuenta si no la sigue una vocal (si no, es la inicial de la sílaba siguiente: shēngrì)
  const SILABA = /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ueng|ang|eng|ing|ong|ian|iao|uai|uan|üan|ai|ei|ao|ou|an|en|in|un|ün|ia|ie|iu|ua|uo|ui|üe|ue|er|a|o|e|i|u|ü)(?:r(?![aeiouü]))?/g;
  function tonosDe(pinyin, texto) {
    const limpio = pinyin.toLowerCase().replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü' ]/g, ' ');
    const tonos = [];
    let erhua = 0;
    for (const trozo of limpio.split(/[' ]+/).filter(Boolean)) {
      const base = V.sinTono(trozo);
      let m;
      SILABA.lastIndex = 0;
      while ((m = SILABA.exec(base))) {
        if (!m[0]) { SILABA.lastIndex++; continue; }
        if (m[0].length > 1 && m[0].endsWith('r') && m[0] !== 'er') erhua++;
        // Las marcas de tono están en las vocales, que caen siempre dentro de su sílaba
        tonos.push(I.tonoDe(trozo.slice(m.index, m.index + m[0].length)));
      }
    }
    // Una sílaba por carácter, salvo cada 儿 pegado a la sílaba anterior (一点儿 yìdiǎnr: 3 caracteres, 2 sílabas)
    const n = [...texto].filter(c => /\p{Script=Han}/u.test(c)).length;
    return tonos.length === n - erhua ? tonos : null;
  }

  // Tono que realmente se pronuncia: dos terceros seguidos → el primero se dice como segundo
  function realizados(tonos) {
    const r = tonos.slice();
    for (let i = r.length - 2; i >= 0; i--) if (tonos[i] === 3 && tonos[i + 1] === 3) r[i] = 2;
    return r;
  }

  // ── Detección de la frecuencia (autocorrelación normalizada) ──
  function frecuencia(original, srOriginal) {
    // Se reduce a ~12 kHz (sobra para la voz) para que el cálculo sea ligero también en móviles
    const paso = Math.max(1, Math.round(srOriginal / 12000));
    const sr = srOriginal / paso;
    const n = Math.floor(original.length / paso);
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < paso; j++) s += original[i * paso + j];
      buf[i] = s / paso;
    }
    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    const minLag = Math.floor(sr / 450), maxLag = Math.floor(sr / 70);
    let mejor = 0, lagMejor = -1;
    const corr = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag + 1; lag++) {
      let s = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < n - lag; i++) { s += buf[i] * buf[i + lag]; e1 += buf[i] * buf[i]; e2 += buf[i + lag] * buf[i + lag]; }
      corr[lag] = s / Math.sqrt(e1 * e2 || 1);
    }
    // Los múltiplos del periodo correlan casi igual de bien (error de octava): se elige el PRIMER pico
    // que esté cerca del máximo, no el más alto
    const picos = [];
    for (let lag = minLag + 1; lag <= maxLag; lag++) {
      if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1]) picos.push(lag);
    }
    const maximo = Math.max(0, ...picos.map(l => corr[l]));
    lagMejor = picos.find(l => corr[l] >= maximo * 0.9) ?? -1;
    mejor = lagMejor >= 0 ? corr[lagMejor] : 0;
    if (lagMejor < 0 || mejor < 0.75) return { rms, f0: null };
    // Interpolación parabólica para afinar el periodo
    const a = corr[lagMejor - 1], b = corr[lagMejor], c = corr[lagMejor + 1];
    const desplaz = (a - c) / (2 * (a - 2 * b + c) || 1);
    return { rms, f0: sr / (lagMejor + desplaz) };
  }

  const mediana = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  // ── Grabación ──
  let grab = null;
  async function grabar(alTerminar, alFrame) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const frames = [];
    const t0 = performance.now();
    let ruido = 0.005, voz = false, ultimaVoz = 0, raf;
    const parar = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach(t => t.stop());
      ctx.close();
      grab = null;
      alTerminar(frames);
    };
    const paso = () => {
      an.getFloatTimeDomainData(buf);
      const t = performance.now() - t0;
      const { rms, f0 } = frecuencia(buf, ctx.sampleRate);
      if (t < 250) ruido = Math.max(ruido, rms * 1.8); // primer cuarto de segundo: nivel de ruido de fondo
      const sonora = f0 && rms > ruido * 1.5;
      frames.push({ t, f0: sonora ? f0 : null });
      if (sonora) { voz = true; ultimaVoz = t; }
      alFrame && alFrame(frames);
      // Para sola tras 0,8 s de silencio después de hablar, o a los 5 s
      if ((voz && t - ultimaVoz > 800) || t > 5000) return parar();
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    grab = { parar };
  }

  // ── Análisis ──
  function analizar(frames, tonos) {
    const voz = frames.filter(f => f.f0);
    if (voz.length < 8) return null;
    const med = mediana(voz.map(f => f.f0));
    // Quitar saltos de octava y suavizar
    let pts = voz.filter(f => f.f0 / med < 1.8 && med / f.f0 < 1.8).map(f => ({ t: f.t, st: 12 * Math.log2(f.f0 / med) }));
    pts = pts.map((p, i) => ({ t: p.t, st: mediana(pts.slice(Math.max(0, i - 2), i + 3).map(q => q.st)) }));
    if (pts.length < 8) return null;

    // Tramos sonoros separados por pausas de más de 60 ms
    const tramos = [];
    for (const p of pts) {
      const ult = tramos[tramos.length - 1];
      if (ult && p.t - ult[ult.length - 1].t < 60) ult.push(p); else tramos.push([p]);
    }
    const largos = tramos.filter(tr => tr[tr.length - 1].t - tr[0].t > 50);
    const n = tonos.length;
    let silabas;
    if (largos.length === n) silabas = largos;
    else {
      // Si no se distinguen las sílabas por las pausas, se reparte el tiempo a partes iguales
      const ini = pts[0].t, fin = pts[pts.length - 1].t, d = (fin - ini) / n;
      silabas = Array.from({ length: n }, (_, k) => pts.filter(p => p.t >= ini + k * d && p.t <= ini + (k + 1) * d + 1));
    }
    const reales = realizados(tonos);
    const resultado = silabas.map((s, k) => evaluar(s, reales[k], tonos[k]));
    return { pts, silabas, resultado, reales };
  }

  function evaluar(s, tono, escrito) {
    if (!s || s.length < 3) return { tono, ok: false, consejo: 'No se oyó esta sílaba. Habla un poco más alto y despacio.' };
    const cuarto = Math.max(1, Math.floor(s.length / 4));
    const ini = s.slice(0, cuarto).reduce((a, p) => a + p.st, 0) / cuarto;
    const fin = s.slice(-cuarto).reduce((a, p) => a + p.st, 0) / cuarto;
    const min = Math.min(...s.map(p => p.st));
    const media = s.reduce((a, p) => a + p.st, 0) / s.length;
    const cambio = fin - ini;
    const nota = escrito === 3 && tono === 2 ? ' (3.º seguido de 3.º: se dice como 2.º)' : '';
    switch (tono) {
      case 1: return Math.abs(cambio) <= 2 && media >= -1.5
        ? { tono, ok: true, consejo: 'Alto y plano. ¡Bien!' }
        : { tono, ok: false, consejo: cambio < -2 ? 'Tu voz cae: mantenla arriba y plana.' : cambio > 2 ? 'Tu voz sube: mantenla plana.' : 'Hazlo más agudo, como un "aaa" sostenido.' };
      case 2: return cambio >= 1.5
        ? { tono, ok: true, consejo: 'Sube como una pregunta. ¡Bien!' + nota }
        : { tono, ok: false, consejo: 'Debe subir claramente, como al preguntar "¿Qué?".' + nota };
      case 3: return (media <= -0.5 || min < ini - 1.5)
        ? { tono, ok: true, consejo: 'Baja hasta lo grave. ¡Bien!' }
        : { tono, ok: false, consejo: 'Baja más la voz, hasta lo más grave que puedas.' };
      case 4: return cambio <= -2.5
        ? { tono, ok: true, consejo: 'Cae con fuerza. ¡Bien!' }
        : { tono, ok: false, consejo: 'Empieza arriba y cae rápido y seco, como una orden: "¡No!".' };
      default: return { tono, ok: true, consejo: 'Tono neutro: corto y suave.' };
    }
  }

  // ── Gráfica ──
  const ANCHO = 600, ALTO = 220, RANGO = 8;
  const y = st => ALTO / 2 - (Math.max(-RANGO, Math.min(RANGO, st)) / RANGO) * (ALTO / 2 - 12);
  function grafica(analisis, frames, tonos) {
    const lineasGuia = [-6, -3, 0, 3, 6].map(st => `<line x1="0" x2="${ANCHO}" y1="${y(st)}" y2="${y(st)}" class="guia"/>`).join('');
    if (!analisis) {
      // Durante la grabación: curva en bruto
      const voz = (frames || []).filter(f => f.f0);
      const med = mediana(voz.map(f => f.f0)) || 1;
      const tmax = Math.max(1500, ...(frames || []).map(f => f.t));
      const pts = voz.map(f => `${(f.t / tmax * ANCHO).toFixed(1)},${y(12 * Math.log2(f.f0 / med)).toFixed(1)}`).join(' ');
      return `<svg viewBox="0 0 ${ANCHO} ${ALTO}" class="curva">${lineasGuia}<polyline points="${pts}" class="tuya"/></svg>`;
    }
    const { pts, silabas, reales } = analisis;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t, x = t => ((t - t0) / (t1 - t0 || 1)) * (ANCHO - 20) + 10;
    const ideales = silabas.map((s, k) => {
      if (!s.length) return '';
      const a = x(s[0].t), b = x(s[s.length - 1].t);
      const c = CONTORNO[reales[k]];
      const puntos = c.map((nivel, j) => `${(a + (b - a) * j / (c.length - 1)).toFixed(1)},${y((nivel - 3) * ST_POR_NIVEL).toFixed(1)}`).join(' ');
      return `<polyline points="${puntos}" class="ideal ${V.tonoClase(reales[k])}"/>`;
    }).join('');
    const tuya = `<polyline points="${pts.map(p => `${x(p.t).toFixed(1)},${y(p.st).toFixed(1)}`).join(' ')}" class="tuya"/>`;
    return `<svg viewBox="0 0 ${ANCHO} ${ALTO}" class="curva" role="img" aria-label="Tu curva de tono comparada con la ideal">${lineasGuia}${ideales}${tuya}</svg>`;
  }

  // ── Ventana de práctica ──
  function boton(texto, pinyin) {
    return `<button class="btn sec" data-pronunciar="${esc(texto)}" data-py="${esc(pinyin)}">🎙️ Pronunciar</button>`;
  }

  function abrir(texto, pinyin) {
    let dlg = document.getElementById('dlg-pron');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-pron';
      dlg.className = 'dialogo';
      document.body.appendChild(dlg);
      dlg.addEventListener('close', () => grab && grab.parar());
    }
    const tonos = tonosDe(pinyin, texto) || [...texto].map(c => window.DATOS.caracteres[c]?.tono || 5);
    const soporte = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    dlg.innerHTML = `
      <form method="dialog" class="cerrar-dlg"><button aria-label="Cerrar">✕</button></form>
      <h3>🎙️ Pronuncia y compara</h3>
      <div class="hz frase-grande">${esc(texto)}</div>
      <div class="py grande">${esc(pinyin)}</div>
      <div class="tonos-esperados">${realizados(tonos).map((t, k) => `<span class="etq-tono ${V.tonoClase(t)}">${t === 5 ? 'neutro' : t + '.º'}${tonos[k] !== t ? '*' : ''}</span>`).join('')}</div>
      <div id="pron-grafica">${grafica(null, [], tonos)}</div>
      <p class="nota leyenda-curva"><span class="muestra-ideal"></span> contorno ideal · <span class="muestra-tuya"></span> tu voz</p>
      <div id="pron-resultado" aria-live="polite"></div>
      <div class="fila botones centrada">
        <button class="btn sec" id="pron-oir">🔊 Escuchar</button>
        <button class="btn" id="pron-grabar" ${soporte ? '' : 'disabled'}>● Grabar</button>
      </div>
      <p class="nota">${soporte ? 'Pulsa Grabar y di la palabra. La grabación se detiene sola al callarte. El audio no sale de tu dispositivo.' : 'Este navegador no permite usar el micrófono.'}</p>`;
    dlg.showModal();
    const $g = dlg.querySelector('#pron-grafica'), $r = dlg.querySelector('#pron-resultado'), $b = dlg.querySelector('#pron-grabar');
    dlg.querySelector('#pron-oir').onclick = () => window.Voz.decir(texto);
    $b.onclick = async () => {
      if (grab) { grab.parar(); return; }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      $r.innerHTML = '';
      $b.textContent = '■ Parar';
      $b.classList.add('grabando');
      try {
        await grabar(frames => {
          $b.textContent = '● Grabar otra vez';
          $b.classList.remove('grabando');
          const an = analizar(frames, tonos);
          $g.innerHTML = grafica(an, frames, tonos);
          $r.innerHTML = an ? resultadoHTML(an) : '<p class="aviso-mal">No te he oído bien. Acércate al micrófono y habla un poco más alto.</p>';
        }, frames => { $g.innerHTML = grafica(null, frames, tonos); });
      } catch (e) {
        $b.textContent = '● Grabar';
        $b.classList.remove('grabando');
        $r.innerHTML = `<p class="aviso-mal">No se pudo usar el micrófono${e && e.name === 'NotAllowedError' ? ': permite el acceso al micrófono para esta app' : ''}.</p>`;
      }
    };
  }

  function resultadoHTML(an) {
    const bien = an.resultado.filter(r => r.ok).length;
    return `
      <p class="nota-pron"><b>${bien} de ${an.resultado.length}</b> sílabas con el tono correcto ${bien === an.resultado.length ? '🎉' : ''}</p>
      <ul class="lista-pron">${an.resultado.map((r, k) => `<li class="${r.ok ? 'ok' : 'mal'}">${r.ok ? '✅' : '⚠️'} Sílaba ${k + 1} <span class="${V.tonoClase(r.tono)}">(${r.tono === 5 ? 'neutro' : r.tono + '.º'})</span>: ${esc(r.consejo)}</li>`).join('')}</ul>`;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pronunciar]');
    if (b) { e.preventDefault(); abrir(b.dataset.pronunciar, b.dataset.py); }
  });

  window.Pronunciar = { boton, abrir, tonosDe, realizados, analizar, frecuencia };
})();
