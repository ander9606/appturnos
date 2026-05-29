'use strict';

/**
 * Seed de usuarios de prueba — uno por cada rol.
 * Uso: cd backend && node scripts/seed-test-users.js
 *
 * Crea la empresa "Empresa Demo" y 6 usuarios (uno por rol).
 * Contraseña de todos: Test1234!
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

const PASSWORD = 'Test1234!';
const BCRYPT_ROUNDS = 10;

const EMPRESA = {
  nombre: 'Empresa Demo',
  slug:   'empresa-demo',
  nit:    '900000001-1',
  ciudad: 'Bogotá',
  plan:   'profesional',
};

const USUARIOS = [
  { nombre: 'Admin',      apellido: 'Demo',    email: 'admin@demo.com',     rol: 'admin_empresa'      },
  { nombre: 'Jefe',       apellido: 'Turnos',  email: 'jturnos@demo.com',   rol: 'jefe_turnos'        },
  { nombre: 'Jefe',       apellido: 'Nomina',  email: 'jnomina@demo.com',   rol: 'jefe_nomina'        },
  { nombre: 'Asistente',  apellido: 'Nomina',  email: 'nomina@demo.com',    rol: 'nomina'              },
  { nombre: 'Trabajador', apellido: 'Turnos',  email: 'wturnos@demo.com',   rol: 'trabajador_turnos'  },
  { nombre: 'Trabajador', apellido: 'Nomina',  email: 'wnomina@demo.com',   rol: 'trabajador_nomina'  },
];

async function main() {
  console.log('\n╔═════════════════════════════════════════╗');
  console.log('║   Seed usuarios de prueba               ║');
  console.log('╚═════════════════════════════════════════╝\n');

  try { await pool.query('SELECT 1'); console.log('✅ Base de datos conectada\n'); }
  catch (e) { console.error('❌ DB error:', e.message); process.exit(1); }

  // Crear o recuperar empresa demo
  let empresaId;
  const [[existe]] = await pool.query(
    'SELECT id FROM empresas WHERE slug = ?', [EMPRESA.slug]
  );
  if (existe) {
    empresaId = existe.id;
    console.log(`ℹ️  Empresa "${EMPRESA.nombre}" ya existe (id=${empresaId})`);
  } else {
    const [r] = await pool.query(
      'INSERT INTO empresas (nombre, slug, nit, ciudad, plan) VALUES (?,?,?,?,?)',
      [EMPRESA.nombre, EMPRESA.slug, EMPRESA.nit, EMPRESA.ciudad, EMPRESA.plan]
    );
    empresaId = r.insertId;
    console.log(`✅ Empresa "${EMPRESA.nombre}" creada (id=${empresaId})`);
  }

  const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

  console.log('\nUsuarios:\n');
  for (const u of USUARIOS) {
    const [[dup]] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ?', [u.email]
    );
    if (dup) {
      console.log(`  ⚠️  ${u.rol.padEnd(22)} ${u.email} — ya existe, omitido`);
      continue;
    }
    const [r] = await pool.query(
      `INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [empresaId, u.nombre, u.apellido, u.email, hash, u.rol]
    );
    console.log(`  ✅ ${u.rol.padEnd(22)} ${u.email}  (id=${r.insertId})`);
  }

  console.log(`\n🔑 Contraseña de todos: ${PASSWORD}\n`);
  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
