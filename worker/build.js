/**
 * Build script for MLB Alert Worker.
 * Uses esbuild to bundle the entire worker into a single file.
 * 
 * Usage: node build.js
 * Output: dist/worker.js
 */

import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('Building MLB Alert Worker...');

  try {
    await esbuild.build({
      entryPoints: [path.resolve(__dirname, 'src', 'index.js')],
      outfile: path.resolve(__dirname, 'dist', 'worker.js'),
      bundle: true,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      minify: true,
      sourcemap: false,
      // External modules that are available in the Workers runtime
      external: [],
      // Define any global constants
      define: {},
    });

    console.log('Build complete: dist/worker.js');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();