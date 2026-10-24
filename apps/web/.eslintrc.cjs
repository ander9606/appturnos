// ponytail: solo colores + hooks (sin eslint-plugin-react ni typescript-eslint/recommended) — upgrade path: extender 'plugin:@typescript-eslint/recommended' y react-hooks.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react-hooks'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // Colores: nada de hex literales; usar variables CSS / clases de Tailwind (docs/DISENO.md §2).
    'no-restricted-syntax': ['error', {
      selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
      message: "Hex literal: usa una variable CSS o clase de Tailwind del tema (docs/DISENO.md §2). La landing y las mockups son la excepción.",
    }],
  },
  overrides: [
    // La landing y su simulador dibujan pantallas de la app con colores propios.
    { files: ['src/pages/landing/**'], rules: { 'no-restricted-syntax': 'off' } },
  ],
};
