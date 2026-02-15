import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      // Allow importing shared domain helpers from ../shared in dev.
      // Note: setting `server.fs.allow` overrides Vite's defaults; include the app root too,
      // otherwise Vite may 403 on normal /src/* module requests.
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../shared')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          const pkgMatch = normalizedId.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/);
          const pkgName = pkgMatch?.[1] || '';

          if (
            normalizedId.includes('/ag-grid')
            || normalizedId.includes('/handsontable')
            || normalizedId.includes('/@handsontable/')
          ) {
            return 'vendor-data-grid';
          }
          if (pkgName.startsWith('@fullcalendar/')) {
            return 'vendor-calendar';
          }
          if (pkgName === 'docx') {
            return 'vendor-export';
          }
          if (pkgName === 'antd') {
            const antdModuleMatch = normalizedId.match(/\/node_modules\/antd\/(?:es|lib)\/([^/]+)/);
            const moduleName = antdModuleMatch?.[1] || '';

            const dataEntryModules = new Set([
              'auto-complete',
              'button',
              'checkbox',
              'date-picker',
              'form',
              'input',
              'input-number',
              'radio',
              'rate',
              'select',
              'slider',
              'switch',
              'time-picker',
              'tree-select',
              'upload'
            ]);
            const dataDisplayModules = new Set([
              'avatar',
              'badge',
              'calendar',
              'card',
              'carousel',
              'collapse',
              'descriptions',
              'empty',
              'image',
              'list',
              'popover',
              'segmented',
              'statistic',
              'table',
              'tabs',
              'tag',
              'timeline',
              'tooltip',
              'tour',
              'tree',
              'typography'
            ]);
            const feedbackModules = new Set([
              'alert',
              'drawer',
              'message',
              'modal',
              'notification',
              'popconfirm',
              'progress',
              'result',
              'skeleton',
              'spin'
            ]);
            const layoutModules = new Set([
              'affix',
              'anchor',
              'app',
              'breadcrumb',
              'col',
              'divider',
              'dropdown',
              'flex',
              'float-button',
              'layout',
              'menu',
              'pagination',
              'row',
              'space',
              'splitter',
              'steps'
            ]);

            if (dataEntryModules.has(moduleName)) return 'vendor-antd-entry';
            if (dataDisplayModules.has(moduleName)) return 'vendor-antd-display';
            if (feedbackModules.has(moduleName)) return 'vendor-antd-feedback';
            if (layoutModules.has(moduleName)) return 'vendor-antd-layout';
            return 'vendor-antd-core';
          }
          if (pkgName === '@ant-design/icons') {
            return 'vendor-antd-icons';
          }
          if (pkgName.startsWith('rc-')) return 'vendor-antd-rc';
          if (
            normalizedId.includes('/react/')
            || normalizedId.includes('/react-dom/')
            || normalizedId.includes('/react-router-dom/')
            || normalizedId.includes('/scheduler/')
          ) {
            return 'vendor-react';
          }
          return 'vendor-misc';
        }
      }
    }
  }
})
