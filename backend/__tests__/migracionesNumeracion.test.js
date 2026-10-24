'use strict';

// Dos migraciones con el mismo número (dos ramas que tomaron "el siguiente") no rompen
// el runner —lleva el control por nombre de archivo—, pero dejan el orden de aplicación
// ambiguo en producción. Este test falla antes de llegar ahí.
const fs = require('fs');
const path = require('path');

const archivos = fs.readdirSync(path.join(__dirname, '../migrations/sql')).filter((f) => f.endsWith('.sql')).sort();
const numero = (f) => f.match(/^(\d+[a-z]?)_/)?.[1];

test('todas las migraciones empiezan con un número', () => {
  expect(archivos.filter((f) => !numero(f))).toEqual([]);
});

test('no hay dos migraciones con el mismo número', () => {
  const vistos = new Map();
  const repetidos = [];
  for (const f of archivos) {
    const n = numero(f);
    if (vistos.has(n)) repetidos.push([vistos.get(n), f]);
    vistos.set(n, f);
  }
  expect(repetidos).toEqual([]);
});
