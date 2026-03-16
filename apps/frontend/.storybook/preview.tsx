import type { Preview, Decorator } from '@storybook/react'
import { MemoryRouter }            from 'react-router-dom'
import '../src/index.css'

/**
 * RouterDecorator — wraps every story in a MemoryRouter so any component
 * that uses `<NavLink>`, `useNavigate`, or `<Link>` renders without errors.
 */
const RouterDecorator: Decorator = (Story) => (
  <MemoryRouter>
    <Story />
  </MemoryRouter>
)

const preview: Preview = {
  decorators: [RouterDecorator],

  parameters: {
    // Match the app's dark background so colours render accurately
    backgrounds: {
      default: 'brand-primary',
      values: [
        { name: 'brand-primary',   value: '#1a1a2e' },
        { name: 'brand-secondary', value: '#16213e' },
        { name: 'brand-accent',    value: '#0f3460' },
        { name: 'white',           value: '#ffffff' },
      ],
    },

    // Default viewport to mobile-first (the app's primary use case)
    viewport: {
      defaultViewport: 'mobile2',
    },

    // Autodocs layout
    docs: {
      theme: {
        base: 'dark',
      },
    },

    // Actions: auto-capture all on* props as actions
    actions: { argTypesRegex: '^on[A-Z].*' },

    // Controls: infer types from TypeScript interfaces
    controls: {
      matchers: {
        color:   /(background|color)$/i,
        date:    /Date$/i,
        boolean: /^(is|has|show|open|loading|disabled|required|danger)/i,
      },
    },
  },
}

export default preview
