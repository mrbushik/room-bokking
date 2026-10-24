import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// UI tests opt into jsdom with a per-file @vitest-environment directive.
// MSW server setup, isolated repositories and clocks are added in M3/M4.
afterEach(() => {
  cleanup()
})
