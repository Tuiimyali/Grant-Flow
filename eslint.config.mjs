import { dirname } from 'path'
import { fileURLToPath } from 'url'
import coreWebVitals from 'eslint-config-next/core-web-vitals'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config = [
  ...coreWebVitals,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Common pattern: setState in useEffect for hydration guards and data sync
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default config
