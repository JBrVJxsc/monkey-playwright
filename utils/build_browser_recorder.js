#!/usr/bin/env node
/**
 * Build script for browser-compatible Playwright Recorder
 * Outputs an IIFE bundle that exposes PlaywrightRecorder on window
 */

// @ts-check

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const INJECTED_SRC = path.join(ROOT, 'packages', 'injected', 'src');
const OUT_DIR = path.join(ROOT, 'packages', 'injected', 'dist');

// Path aliases used in Playwright source
const aliases = {
  '@isomorphic': path.join(ROOT, 'packages', 'playwright-core', 'src', 'utils', 'isomorphic'),
  '@protocol': path.join(ROOT, 'packages', 'protocol', 'src'),
  '@recorder': path.join(ROOT, 'packages', 'recorder', 'src'),
};

// Plugin to resolve path aliases
const aliasPlugin = {
  name: 'alias',
  setup(build) {
    const resolveWithExtension = (basePath) => {
      // Try .ts first, then .tsx, then as-is
      for (const ext of ['.ts', '.tsx', '']) {
        const fullPath = basePath + ext;
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
      // Also try index files
      for (const ext of ['.ts', '.tsx', '.js']) {
        const indexPath = path.join(basePath, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
      return basePath + '.ts'; // Default to .ts
    };

    // Handle @isomorphic imports
    build.onResolve({ filter: /^@isomorphic\// }, args => {
      const basePath = args.path.replace('@isomorphic/', aliases['@isomorphic'] + '/');
      return { path: resolveWithExtension(basePath) };
    });
    // Handle @protocol imports
    build.onResolve({ filter: /^@protocol\// }, args => {
      const basePath = args.path.replace('@protocol/', aliases['@protocol'] + '/');
      return { path: resolveWithExtension(basePath) };
    });
    // Handle @recorder imports
    build.onResolve({ filter: /^@recorder\// }, args => {
      const basePath = args.path.replace('@recorder/', aliases['@recorder'] + '/');
      return { path: resolveWithExtension(basePath) };
    });
  },
};

const inlineCSSPlugin = {
  name: 'inlineCSSPlugin',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const f = await fs.promises.readFile(args.path);
      const css = await esbuild.transform(f, { loader: 'css', minify: true });
      return { loader: 'text', contents: css.code };
    });
  },
};

async function build() {
  console.log('Building browser-compatible Playwright Recorder...');

  // Ensure output directory exists
  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  // Build the browser recorder bundle as IIFE
  const result = await esbuild.build({
    entryPoints: [path.join(INJECTED_SRC, 'browserRecorder.ts')],
    bundle: true,
    outfile: path.join(OUT_DIR, 'playwright-recorder.browser.js'),
    format: 'iife',
    globalName: 'PlaywrightRecorder',
    platform: 'browser',
    target: 'ES2019',
    plugins: [aliasPlugin, inlineCSSPlugin],
    minify: false, // Keep readable for debugging
    sourcemap: true,
    // Handle external dependencies
    external: [],
    // Define globals
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  if (result.errors.length > 0) {
    console.error('Build errors:', result.errors);
    process.exit(1);
  }

  console.log(`✓ Built: ${path.join(OUT_DIR, 'playwright-recorder.browser.js')}`);

  // Also build a minified version
  await esbuild.build({
    entryPoints: [path.join(INJECTED_SRC, 'browserRecorder.ts')],
    bundle: true,
    outfile: path.join(OUT_DIR, 'playwright-recorder.browser.min.js'),
    format: 'iife',
    globalName: 'PlaywrightRecorder',
    platform: 'browser',
    target: 'ES2019',
    plugins: [aliasPlugin, inlineCSSPlugin],
    minify: true,
    sourcemap: false,
    external: [],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  console.log(`✓ Built: ${path.join(OUT_DIR, 'playwright-recorder.browser.min.js')}`);

  // Create package.json for the dist
  const distPackageJson = {
    name: 'monkey-playwright-recorder',
    version: '1.0.0',
    description: 'Browser-compatible Playwright Recorder for Monkey',
    main: 'playwright-recorder.browser.js',
    files: ['*.js', '*.map'],
  };

  await fs.promises.writeFile(
    path.join(OUT_DIR, 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
  );

  console.log('✓ Build complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
