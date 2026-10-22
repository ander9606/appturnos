module.exports = {
  extends: ['expo'],
  ignorePatterns: ['/dist/*'],
  rules: {
    // Colores: nada de hex literales; usar COLORS/ACCENT/alpha() de lib/designTokens.ts (docs/DISENO.md §2.4).
    'no-restricted-syntax': ['error', {
      selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
      message: "Hex literal: usa un token de '@/lib/designTokens' (COLORS, ACCENT, alpha()). Si falta un color, agrégalo ahí.",
    }],
    // Inter: el Text/TextInput de la app traduce font-semibold → Inter_600SemiBold (docs/DISENO.md §3).
    // Con el de react-native el texto se ve en la fuente del sistema.
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'react-native',
        importNames: ['Text', 'TextInput'],
        message: "Importa Text/TextInput de '@/components/ui/Text' para que usen Inter.",
      }],
    }],
  },
  overrides: [
    { files: ['components/ui/Text.tsx'], rules: { 'no-restricted-imports': 'off' } },
    { files: ['lib/designTokens.ts', '**/__tests__/**'], rules: { 'no-restricted-syntax': 'off' } },
    // jest.mock() se iza por encima de los import, así que las fábricas de mocks de componentes necesitan require().
    { files: ['**/__tests__/**'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  ],
};
