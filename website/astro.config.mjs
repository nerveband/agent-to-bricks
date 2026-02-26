// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://agenttobricks.com',
  integrations: [
    starlight({
      title: 'Agent to Bricks',
      description: 'Update your Bricks website with natural language.',
      logo: {
        src: './src/assets/icon.png',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/nerveband/agent-to-bricks' },
      ],
      expressiveCode: {
        themes: ['dracula'],
        styleOverrides: {
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '0.75rem',
          codeBackground: '#12101e',
          codeFontFamily: "'JetBrains Mono', monospace",
          codeFontSize: '0.85rem',
          frames: {
            editorBackground: '#12101e',
            terminalBackground: '#0d0b18',
            terminalTitlebarBackground: '#1a1830',
            editorTabBarBackground: '#1a1830',
            tooltipSuccessBackground: '#FACC15',
          },
        },
      },
      customCss: [
        './src/styles/custom.css',
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            'getting-started/introduction',
            'getting-started/installation',
            'getting-started/quick-start',
            'getting-started/configuration',
          ],
        },
        {
          label: 'CLI Reference',
          collapsed: true,
          items: [
            'cli/site-commands',
            'cli/generate-commands',
            'cli/convert-commands',
            'cli/search-commands',
            'cli/template-commands',
            'cli/class-commands',
            'cli/style-commands',
            'cli/media-commands',
            'cli/agent-commands',
            'cli/doctor-validate',
            'cli/config-update',
          ],
        },
        {
          label: 'GUI Guide',
          collapsed: true,
          items: [
            'gui/overview',
            'gui/layout-navigation',
            'gui/prompt-composer',
            'gui/managing-tools',
            'gui/sessions-history',
            'gui/keyboard-shortcuts',
          ],
        },
        {
          label: 'Plugin Reference',
          collapsed: true,
          items: [
            'plugin/rest-api',
            'plugin/authentication',
            'plugin/element-data-model',
            'plugin/global-classes',
            'plugin/snapshots',
            'plugin/settings',
          ],
        },
        {
          label: 'Guides',
          collapsed: true,
          items: [
            'guides/bring-your-own-agent',
            'guides/working-with-templates',
            'guides/html-to-bricks',
            'guides/style-profiles',
            'guides/acss-integration',
            'guides/team-onboarding',
          ],
        },
        {
          label: 'About',
          items: [
            'about/philosophy',
            'about/contributing',
            'about/credits',
          ],
        },
      ],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
