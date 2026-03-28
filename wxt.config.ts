import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  manifest: {
    name: 'ScreenshotR',
    description: 'One-keystroke screenshot capture with automatic organization',
    version: '0.1.0',
    permissions: ['activeTab', 'storage', 'offscreen'],
    commands: {
      'capture-screenshot': {
        suggested_key: {
          default: 'Ctrl+Shift+X',
          mac: 'Command+Shift+X',
        },
        description: 'Capture a screenshot of the visible page',
      },
    },
  },
});
