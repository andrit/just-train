import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig }          from 'vite'
import path                     from 'path'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],

  addons: [
    '@storybook/addon-essentials',   // Controls, Actions, Docs, Viewport, Backgrounds
    '@storybook/addon-a11y',         // Accessibility audit panel
    '@storybook/addon-interactions', // Play function step-through
  ],

  framework: {
    name:    '@storybook/react-vite',
    options: {},
  },

  docs: {
    autodocs: 'tag',
  },

  // Thread the same path aliases used by the app so @/ and @trainer-app/shared
  // resolve identically inside stories and the Storybook build.
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '../src'),
          '@trainer-app/shared': path.resolve(
            __dirname,
            '../../../packages/shared/src/index.ts',
          ),
        },
      },
    })
  },
}

export default config
