module.exports = {
  extends: ['expo'],
  ignorePatterns: ['/dist/*'],
  rules: {
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
  overrides: [{ files: ['components/ui/Text.tsx'], rules: { 'no-restricted-imports': 'off' } }],
};
