'use strict';

const dns = require('dns').promises;
const net = require('net');

function esIpPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) // incluye 169.254.169.254 (metadata de nube)
    );
  }
  const ip6 = ip.toLowerCase();
  return ip6 === '::1' || ip6.startsWith('fe80:') || ip6.startsWith('fc') || ip6.startsWith('fd');
}

/**
 * Confirma que una URL resuelve a un host externo antes de que el backend le
 * haga una petición server-side — evita SSRF cuando el host sale de un dato
 * de un tenant de confianza baja (integración logiq360, etc.).
 * ponytail: valida DNS una vez antes del fetch, no protege contra DNS
 * rebinding (TOCTOU entre este check y el fetch real) — si eso importa, hay
 * que fijar la IP resuelta con un dispatcher custom en vez de volver a resolver.
 */
async function hostExterno(urlStr) {
  try {
    const { hostname, protocol } = new URL(urlStr);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    const { address } = await dns.lookup(hostname);
    return !esIpPrivada(address);
  } catch {
    return false;
  }
}

module.exports = { hostExterno, esIpPrivada };
