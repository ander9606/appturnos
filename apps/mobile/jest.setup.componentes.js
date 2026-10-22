// Los iconos cargan su fuente de forma asíncrona y eso dispara avisos de act() en cada test.
// No aportan nada a lo que se prueba, así que se sustituyen por un componente vacío.
jest.mock('@expo/vector-icons', () => new Proxy({}, { get: () => () => null }));
