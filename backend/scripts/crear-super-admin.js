#!/usr/bin/env node
'use strict';

/**
 * Script para crear el primer usuario super_admin.
 *
 * Uso:
 *   cd backend
 *   node scripts/crear-super-admin.js
 *
 * O con variables de entorno para CI/CD:
 *   SA_NOMBRE="Admin" SA_APELLIDO="Sistema" SA_EMAIL="admin@appturnos.com" \
 *   SA_PASSWORD="SecurePass123!" node scripts/crear-super-admin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const readline = require('readline');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

const BCRYPT_ROUNDS = 12;

// ── Helpers ───────────────────────────────────────────────────────────────

function pregunta(rl, texto, oculto = false) {
  return new Promise((resolve) => {
    if (oculto && process.stdout.isTTY) {
      process.stdout.write(texto);
      process.stdin.setRawMode(true);
      let entrada = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (char) => {
        char = char.toString();
        if (char === '\n' || char === '\r' || char === '') {
          if (char === '') process.exit();
          process.stdout.write('\n');
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          resolve(entrada);
        } else if (char === '') {
          entrada = entrada.slice(0, -1);
        } else {
          entrada += char;
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(texto, resolve);
    }
  });
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔═════════════════════════════════════════╗');
  console.log('║   Crear Super Admin — App Turnos        ║');
  console.log('╚═════════════════════════════════════════╝\n');

  // Verificar conexión
  try {
    await pool.query('SELECT 1');
    console.log('✅ Base de datos conectada\n');
  } catch (err) {
    console.error('❌ No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  }

  // Verificar que la migración 014 está aplicada
  try {
    const [rows] = await pool.query(
      "SHOW COLUMNS FROM usuarios LIKE 'rol'"
    );
    if (!rows[0]?.Type?.includes('super_admin')) {
      console.error('❌ La migración 014_super_admin.sql no está aplicada.');
      console.error('   Ejecuta: cd backend && npm run migrate\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error verificando esquema:', err.message);
    process.exit(1);
  }

  // Verificar si ya existe un super_admin
  const [[{ existentes }]] = await pool.query(
    "SELECT COUNT(*) AS existentes FROM usuarios WHERE rol = 'super_admin'"
  );
  if (Number(existentes) > 0) {
    console.log(`⚠️  Ya existe ${existentes} super_admin en el sistema.`);
    console.log('   ¿Deseas crear otro? (s/n) ');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Leer datos (env vars o stdin interactivo)
  const nombre = process.env.SA_NOMBRE || await pregunta(rl, 'Nombre: ');
  const apellido = process.env.SA_APELLIDO || await pregunta(rl, 'Apellido: ');
  const email = process.env.SA_EMAIL || await pregunta(rl, 'Email: ');
  const password = process.env.SA_PASSWORD || await pregunta(rl, 'Contraseña (min 8 chars): ', true);

  rl.close();

  // Validaciones básicas
  if (!nombre.trim()) { console.error('❌ Nombre requerido'); process.exit(1); }
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('❌ Email inválido'); process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ La contraseña debe tener al menos 8 caracteres'); process.exit(1);
  }

  // Verificar email único
  const [[{ emailUsado }]] = await pool.query(
    'SELECT COUNT(*) AS emailUsado FROM usuarios WHERE email = ?',
    [email.trim().toLowerCase()]
  );
  if (Number(emailUsado) > 0) {
    console.error('❌ Ya existe un usuario con ese email'); process.exit(1);
  }

  // Crear usuario
  console.log('\n⏳ Creando super admin…');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [result] = await pool.query(
    `INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol, activo)
     VALUES (NULL, ?, ?, ?, ?, 'super_admin', 1)`,
    [nombre.trim(), apellido.trim() || '', email.trim().toLowerCase(), hash]
  );

  console.log('\n✅ Super Admin creado exitosamente!');
  console.log(`   ID:     ${result.insertId}`);
  console.log(`   Nombre: ${nombre.trim()} ${apellido.trim()}`);
  console.log(`   Email:  ${email.trim().toLowerCase()}`);
  console.log(`   Rol:    super_admin\n`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error inesperado:', err.message);
  process.exit(1);
});
