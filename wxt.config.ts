import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Context Bro',
    description: 'Web Clipper for AI Agents — share browsing context with your AI companion',
    permissions: ['activeTab', 'scripting', 'storage', 'alarms', 'tabs', 'contextMenus'],
  },
})
