(() => {
  'use strict';
  const token = new URLSearchParams(location.search).get('s');
  const status = document.getElementById('connection');
  const pad = document.getElementById('touchpad');
  if (!token || !/^[a-f0-9-]{36}$/i.test(token)) {
    status.textContent = 'Enlace inválido. Escanea el QR de la PC.';
    return;
  }
  if (!window.supabase?.createClient) {
    status.textContent = 'No se pudo cargar la conexión. Revisa Internet.';
    return;
  }

  const client = supabase.createClient(
    'https://msxptdklbdxeaheqcbmc.supabase.co',
    'sb_publishable_g6XPAfwi05KqohaBm0uL3g_umR1yBIc',
  );
  const channel = client.channel(`control-${token}`);
  let subscribed = false;
  let lastHost = 0;
  let lastHello = 0;

  const send = (event, payload = {}) => {
    if (subscribed) channel.send({ type: 'broadcast', event, payload });
  };

  channel.on('broadcast', { event: 'state' }, () => {
    lastHost = Date.now();
    status.textContent = 'Conectado a la PC';
    status.classList.add('connected');
  }).subscribe((state) => {
    subscribed = state === 'SUBSCRIBED';
    if (subscribed) {
      status.textContent = 'Buscando la PC…';
      send('hello');
      lastHello = Date.now();
    } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
      status.textContent = 'Error de conexión. Revisa Internet y Realtime.';
      status.classList.remove('connected');
    }
  });

  setInterval(() => {
    if (!subscribed) return;
    if (Date.now() - lastHost > 7000) {
      status.textContent = 'Esperando la PC…';
      status.classList.remove('connected');
      if (Date.now() - lastHello > 2500) {
        send('hello');
        lastHello = Date.now();
      }
    }
    send('ping');
  }, 2000);

  pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (!subscribed || Date.now() - lastHost > 7000) return;
    const rect = pad.getBoundingClientRect();
    send('tap', {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    });
    pad.classList.add('pressed');
    setTimeout(() => pad.classList.remove('pressed'), 130);
  });
  pad.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      send('tap', { x: 0.5, y: 0.5 });
    }
  });
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => send('button', { action: button.dataset.action }));
  });
})();
