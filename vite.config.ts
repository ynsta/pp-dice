import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import * as fs from 'node:fs';

function foundrySyncPlugin() {
  return {
    name: 'foundry-sync',
    closeBundle: async () => {
      const configPath = resolve(__dirname, 'foundryconfig.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.dataPath) {
            const targetDir = resolve(config.dataPath, 'modules', 'pp-dice');
            const distDir = resolve(__dirname, 'dist');
            if (fs.existsSync(distDir)) {
              fs.cpSync(distDir, targetDir, { recursive: true, force: true });
              console.log(`\x1b[32m[pp-dice]\x1b[0m Synced build to ${targetDir}`);
            }
          }
        } catch (err) {
          console.error('[pp-dice] Failed to sync to Foundry Data:', err);
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'PPDice',
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'styles/pp-dice.css';
          return 'assets/[name].[ext]';
        },
      },
    },
  },
  plugins: [
    {
      name: 'copy-module-assets',
      generateBundle: async function () {
        // Copy module.json
        if (fs.existsSync('src/module.json')) {
          this.emitFile({
            type: 'asset',
            fileName: 'module.json',
            source: fs.readFileSync('src/module.json'),
          });
        }
        // Copy lang files
        if (fs.existsSync('lang')) {
          const langFiles = fs.readdirSync('lang');
          for (const file of langFiles) {
            this.emitFile({
              type: 'asset',
              fileName: `lang/${file}`,
              source: fs.readFileSync(`lang/${file}`),
            });
          }
        }
        // Copy templates
        if (fs.existsSync('templates')) {
          const templates = fs.readdirSync('templates');
          for (const file of templates) {
            this.emitFile({
              type: 'asset',
              fileName: `templates/${file}`,
              source: fs.readFileSync(`templates/${file}`),
            });
          }
        }
      },
    },
    foundrySyncPlugin(),
  ],
});
