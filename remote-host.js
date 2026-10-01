/* Conexión temporal entre la PC y un teléfono mediante Supabase Realtime. */
(() => {
  'use strict';

  const url = 'https://msxptdklbdxeaheqcbmc.supabase.co';
  const key = 'sb_publishable_g6XPAfwi05KqohaBm0uL3g_umR1yBIc';
  const status = document.getElementById('estado-control');
  const dialogStatus = document.getElementById('estado-control-dialogo');
  const link = document.getElementById('enlace-control');
  const dialog = document.getElementById('dialogo-control');
  const token = crypto.randomUUID();
  const controlUrl = new URL('control.html', location.href);
  controlUrl.searchParams.set('s', token);
  link.href = controlUrl.href;
  link.textContent = controlUrl.href;

  function showStatus(message) {
    status.textContent = message;
    dialogStatus.textContent = message;
  }

  if (location.protocol === 'file:') {
    showStatus('Abre la PC desde GitHub Pages o un servidor HTTPS.');
    return;
  }
  if (!window.supabase?.createClient || !window.QRCode) {
    showStatus('No se cargaron las librerías de conexión. Revisa Internet.');
    return;
  }

  new QRCode(document.getElementById('qr-control'), {
    text: controlUrl.href, width: 192, height: 192,
    correctLevel: QRCode.CorrectLevel.M,
  });
  new QRCode(document.getElementById('qr-control-dialogo'), {
    text: controlUrl.href, width: 192, height: 192,
    correctLevel: QRCode.CorrectLevel.M,
  });

  document.getElementById('btn-ver-qr').addEventListener('click', () => dialog.showModal());
  document.getElementById('btn-cerrar-qr').addEventListener('click', () => dialog.close());

  const client = supabase.createClient(url, key);
  const channel = client.channel(`control-${token}`);
  let subscribed = false;
  let lastPhone = 0;
  let lastTap = 0;

  const send = (event, payload = {}) => {
    if (subscribed) channel.send({ type: 'broadcast', event, payload });
  };

  function currentScreen() {
    return document.querySelector('.pantalla.activa')?.id || 'pantalla-inicio';
  }

  function pressCanvas(x, y) {
    if (currentScreen() !== 'pantalla-juego') return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return;
    if (Date.now() - lastTap < 100) return;
    lastTap = Date.now();
    const canvas = document.querySelector('#contenedor-phaser canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + x * rect.width;
    const clientY = rect.top + y * rect.height;
    for (const type of ['pointerdown', 'pointerup']) {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        button: 0, buttons: type === 'pointerdown' ? 1 : 0,
        clientX, clientY,
      }));
    }
  }

  const buttons = {
    start: 'btn-jugar', scan: 'btn-escaner', next: 'btn-siguiente-nivel',
    retry: 'btn-reintentar', again: 'btn-jugar-de-nuevo',
    continue: 'btn-continuar-pregunta',
  };

  function pressButton(action) {
    if (typeof action !== 'string') return;
    if (action.startsWith('answer-') && currentScreen() === 'pantalla-pregunta') {
      const index = Number(action.slice(7));
      if (Number.isInteger(index) && index >= 0 && index < 4) {
        document.querySelectorAll('#opciones-pregunta button')[index]?.click();
      }
      return;
    }
    if (action === 'retry' && currentScreen() === 'pantalla-victoria') action = 'again';
    if (action === 'next' && currentScreen() === 'pantalla-pregunta') action = 'continue';
    const id = buttons[action];
    if (id) document.getElementById(id)?.click();
  }

  channel
    .on('broadcast', { event: 'hello' }, () => {
      lastPhone = Date.now();
      showStatus('Teléfono conectado');
      send('state', { screen: currentScreen() });
    })
    .on('broadcast', { event: 'ping' }, () => { lastPhone = Date.now(); })
    .on('broadcast', { event: 'tap' }, ({ payload }) => {
      if (Date.now() - lastPhone < 7000) pressCanvas(payload?.x, payload?.y);
    })
    .on('broadcast', { event: 'button' }, ({ payload }) => {
      if (Date.now() - lastPhone < 7000) pressButton(payload?.action);
    })
    .subscribe((state) => {
      subscribed = state === 'SUBSCRIBED';
      if (subscribed) showStatus('Esperando al teléfono…');
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        showStatus('No se pudo conectar. Revisa Realtime en Supabase.');
      }
    });

  setInterval(() => {
    if (lastPhone && Date.now() - lastPhone > 7000) {
      lastPhone = 0;
      showStatus('Teléfono desconectado. Vuelve a escanear el QR.');
    }
    send('state', { screen: currentScreen() });
  }, 2000);
})();
