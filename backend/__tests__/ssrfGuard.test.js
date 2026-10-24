'use strict';

const dns = require('dns').promises;
const { esIpPrivada, hostExterno } = require('../utils/ssrfGuard');

describe('esIpPrivada', () => {
  test('rangos privados/loopback/link-local/metadata de nube', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fe80::1', 'fc00::1']) {
      expect(esIpPrivada(ip)).toBe(true);
    }
  });

  test('IPs públicas no se marcan como privadas', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      expect(esIpPrivada(ip)).toBe(false);
    }
  });
});

describe('hostExterno', () => {
  afterEach(() => jest.restoreAllMocks());

  test('rechaza un host que resuelve a una IP interna (SSRF)', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue({ address: '169.254.169.254' });
    expect(await hostExterno('http://metadata.interno/x')).toBe(false);
  });

  test('acepta un host que resuelve a una IP pública', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue({ address: '93.184.216.34' });
    expect(await hostExterno('https://logiq360.example.com')).toBe(true);
  });

  test('rechaza protocolos distintos de http/https', async () => {
    expect(await hostExterno('file:///etc/passwd')).toBe(false);
  });

  test('rechaza URL inválida o DNS que falla, sin lanzar', async () => {
    jest.spyOn(dns, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));
    expect(await hostExterno('https://no-existe.invalid')).toBe(false);
    expect(await hostExterno('no-es-una-url')).toBe(false);
  });
});
