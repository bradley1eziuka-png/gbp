import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', '.data/**', 'next-env.d.ts', 'scripts/**'] },
  {
    rules: {
      // Controlled form state is intentionally synced from props/drafts in effects.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
