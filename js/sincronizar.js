// Pasar el progreso de un dispositivo a otro sin cuentas ni servidores.
// El progreso se compacta y comprime en un código ("HZ1…"), que viaja como enlace, código QR
// o texto copiado. Al recibirlo se FUSIONA con el progreso del otro dispositivo (Progreso.fusionar):
// no se pierde nada de ninguno de los dos.
(function () {
  const P = window.Progreso;
  const V = window.Vistas;
  const esc = V.esc;
  const $app = () => document.getElementById('app');
  const DIA = 24 * 60 * 60 * 1000;
  const WEB = 'https://mompos.github.io/chino-app-web/';

  // base64url ⇄ bytes
  const aB64 = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const deB64 = txt => { const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };

  async function transformar(bytes, Clase) {
    const flujo = new Blob([bytes]).stream().pipeThrough(new Clase('deflate-raw'));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  }

  // Solo lo necesario. Versión 2: cada elemento visto como
  //   [id, caja, aciertos, fallos, minuto del próximo repaso, tarjeta FSRS compacta o 0]
  // tarjeta: [estabilidad, dificultad, estado, repasos, olvidos, minuto del último repaso, días programados, paso de aprendizaje]
  // (La versión 1 guardaba el día del próximo repaso y no tenía tarjeta FSRS; se sigue aceptando.)
  const MIN = 60 * 1000;
  const r3 = x => Math.round(x * 1000) / 1000;
  function compactar() {
    const e = P.estado();
    return {
      v: 2,
      c: Object.entries(e.chars).filter(([, r]) => r.visto).map(([id, r]) => {
        const t = r.fsrs;
        return [id, r.caja, r.aciertos, r.fallos, Math.round(r.proximo / MIN),
          t ? [r3(t.stability), r3(t.difficulty), t.state, t.reps, t.lapses, t.last_review ? Math.round(t.last_review / MIN) : 0, t.scheduled_days, t.learning_steps || 0] : 0];
      }),
      n: e.niveles, r: e.racha, s: e.sesion, u: e.ajustes.desbloquearTodo ? 1 : 0,
    };
  }
  function expandir(o) {
    if (!o || (o.v !== 1 && o.v !== 2) || !Array.isArray(o.c)) throw new Error('formato');
    const unidad = o.v === 1 ? DIA : MIN;
    return {
      chars: Object.fromEntries(o.c.map(([id, caja, aciertos, fallos, cuando, t]) => {
        const r = { caja, aciertos, fallos, visto: true, proximo: cuando * unidad };
        if (Array.isArray(t)) {
          r.fsrs = { due: r.proximo, stability: t[0], difficulty: t[1], state: t[2], reps: t[3], lapses: t[4],
            last_review: t[5] ? t[5] * MIN : null, scheduled_days: t[6], learning_steps: t[7] };
        }
        return [id, r];
      })),
      niveles: o.n || {}, racha: o.r || { dias: 0, ultimo: null }, sesion: o.s || {}, ajustes: { desbloquearTodo: !!o.u },
    };
  }

  async function codificar() {
    const bytes = new TextEncoder().encode(JSON.stringify(compactar()));
    if (window.CompressionStream) return 'HZ1z' + aB64(await transformar(bytes, CompressionStream));
    return 'HZ1j' + aB64(bytes);
  }
  async function decodificar(texto) {
    // Acepta el código suelto o un enlace que lo contenga
    const m = String(texto).match(/HZ1[zj][A-Za-z0-9_-]+/);
    if (!m) throw new Error('No encuentro ningún código de progreso en ese texto.');
    const tipo = m[0][3], datos = deB64(m[0].slice(4));
    if (tipo === 'z' && !window.DecompressionStream) throw new Error('Este navegador es demasiado antiguo para leer el código.');
    const bytes = tipo === 'z' ? await transformar(datos, DecompressionStream) : datos;
    return expandir(JSON.parse(new TextDecoder().decode(bytes)));
  }

  function enlace(codigo) {
    const base = /^https?:$/.test(location.protocol) && !/localhost|127\.0\.0\.1/.test(location.hostname)
      ? location.origin + location.pathname : WEB;
    return `${base}#/sincronizar/${codigo}`;
  }

  // En iPhone, la app instalada y Safari guardan el progreso por separado
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  async function pantalla(codigoRecibido) {
    $app().innerHTML = `
      <nav class="migas"><a href="#/mas">← Más</a></nav>
      <section class="portada"><h1>Sincronizar <span class="hz">同步</span></h1>
        <p>Pasa tu progreso entre la computadora, el iPhone y Android. No hace falta cuenta: el progreso viaja en un código, y al recibirlo se <b>fusiona</b> con el del otro dispositivo (de cada carácter, palabra o frase se queda el registro con más práctica).</p></section>
      <div id="recibido"></div>
      <section class="caja-repaso">
        <h2>${window.Iconos.svg('enviar')} Enviar mi progreso</h2>
        <div id="envio"><p class="nota">Preparando el código…</p></div>
      </section>
      <section class="caja-repaso">
        <h2>${window.Iconos.svg('sincronizar')} Recibir progreso</h2>
        <p>Pega aquí el código o el enlace que copiaste en el otro dispositivo:</p>
        <textarea id="codigo-pegado" rows="3" class="campo" placeholder="HZ1… o https://…#/sincronizar/HZ1…" spellcheck="false" autocapitalize="off"></textarea>
        <div class="fila botones"><button class="btn" id="btn-fusionar">Fusionar con mi progreso</button></div>
        <div id="msg-recibir" aria-live="polite"></div>
      </section>`;

    document.getElementById('btn-fusionar').onclick = () => recibir(document.getElementById('codigo-pegado').value, document.getElementById('msg-recibir'));
    if (codigoRecibido) mostrarRecibido(codigoRecibido);

    const codigo = await codificar();
    const url = enlace(codigo);
    let qr = '';
    try {
      const q = window.qrcode(0, 'L');
      q.addData(url);
      q.make();
      qr = `<div class="qr">${q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
        <p class="nota">Escanéalo con la cámara del otro dispositivo.${esIOS ? '' : ' En iPhone, se abrirá Safari: copia allí el código y pégalo dentro de la app instalada.'}</p>`;
    } catch (e) {
      qr = '<p class="nota">Tu progreso ya es demasiado grande para un código QR: usa «Copiar» o «Compartir».</p>';
    }
    document.getElementById('envio').innerHTML = `
      ${qr}
      <div class="fila botones">
        <button class="btn" id="btn-copiar">Copiar enlace</button>
        ${navigator.share ? '<button class="btn sec" id="btn-compartir">Compartir…</button>' : ''}
      </div>
      <p class="nota">Envíatelo por WhatsApp o correo y ábrelo (o pégalo abajo) en el otro dispositivo. Código de ${codigo.length} caracteres.</p>`;
    document.getElementById('btn-copiar').onclick = async () => {
      try { await navigator.clipboard.writeText(url); V.toast('Enlace copiado.'); }
      catch (e) { prompt('Copia este enlace:', url); }
    };
    const comp = document.getElementById('btn-compartir');
    if (comp) comp.onclick = () => navigator.share({ title: 'Mi progreso de 汉字 Paso a Paso', text: 'Abre este enlace en la app para pasar mi progreso:', url }).catch(() => {});
  }

  async function mostrarRecibido(codigo) {
    const caja = document.getElementById('recibido');
    try {
      const otro = await decodificar(codigo);
      const n = Object.keys(otro.chars).length;
      caja.innerHTML = `
        <section class="caja-repaso destacada">
          <h2>${window.Iconos.svg('sincronizar')} Progreso recibido</h2>
          <p>Este enlace trae <b>${n}</b> elementos estudiados.</p>
          ${esIOS && !instalada ? `<p class="aviso-mal">Estás en Safari. Si tienes la app instalada en la pantalla de inicio, su progreso está separado: copia el código y pégalo dentro de la app.</p>
            <div class="fila botones"><button class="btn sec" id="btn-copiar-cod">Copiar código</button></div>` : ''}
          <div class="fila botones"><button class="btn" id="btn-fusionar-rec">Fusionar con mi progreso</button></div>
          <div id="msg-rec" aria-live="polite"></div>
        </section>`;
      document.getElementById('btn-fusionar-rec').onclick = () => recibir(codigo, document.getElementById('msg-rec'));
      const cc = document.getElementById('btn-copiar-cod');
      if (cc) cc.onclick = async () => { try { await navigator.clipboard.writeText(codigo); V.toast('Código copiado.'); } catch (e) { prompt('Copia este código:', codigo); } };
    } catch (e) {
      caja.innerHTML = `<p class="aviso-mal">El enlace no contiene un progreso válido (${esc(e.message)}).</p>`;
    }
  }

  async function recibir(texto, $msg) {
    try {
      const otro = await decodificar(texto);
      const r = P.fusionar(otro);
      $msg.innerHTML = `<p class="aviso-bien">${window.Iconos.svg('check')} Progreso fusionado: ${r.nuevos} elementos nuevos y ${r.actualizados} actualizados.</p>`;
      window.App && window.App.actualizarBadge();
    } catch (e) {
      $msg.innerHTML = `<p class="aviso-mal">${esc(e.message === 'formato' ? 'El código no es válido.' : e.message)}</p>`;
    }
  }

  window.Sincronizar = { pantalla, codificar, decodificar };
})();
