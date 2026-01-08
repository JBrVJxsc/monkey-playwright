# CLAUDE.md

Instructions for Claude Code and other AI assistants working on this project.

## Project Overview

This is a fork of Playwright with additional packages for browser recorder functionality. The main addition is the `playwright-browser-recorder` package which provides types and a browser bundle for direct browser injection.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Build**: esbuild (for browser bundles)
- **Testing**: Playwright Test

## Project Structure

```
packages/
├── playwright-browser-recorder/   # Browser recorder bundle and types
│   ├── src/
│   │   ├── index.ts              # Type exports
│   │   └── types.ts              # Recorder types
│   ├── scripts/
│   │   └── build.cjs             # Build script
│   └── dist/                     # Built outputs
├── playwright-core/              # Core Playwright library
├── playwright/                   # Main Playwright package
└── injected/                     # Injected scripts for browser
utils/
└── generate_injected.js          # Builds injected scripts
```

## Development

```bash
# Install dependencies
npm install

# Build injected scripts (including browser recorder)
node utils/generate_injected.js

# Build playwright-browser-recorder package
cd packages/playwright-browser-recorder && npm run build

# Run tests
npx playwright test
```

## Commit Messages

- Keep commit messages concise (one line, under 72 characters)
- Use conventional commit format: `type: description`
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`
- Do NOT include AI-generated footers, signatures, or co-author tags
- Do NOT include emojis unless explicitly requested

Example:
```
feat: add playwright-browser-recorder package
```

Not:
```
feat: add playwright-browser-recorder package

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Engineering Guidelines

### Code Quality

- Write clean, readable code—never hacky solutions
- Keep code modular and follow best practices
- Follow existing patterns in the Playwright codebase
- Prefer composition over inheritance

### Problem Solving

- When fixing issues that require multiple rounds of fixes, do NOT simply add patches on top of patches
- Step back and reevaluate the approach when a fix becomes complicated
- Consider if there's a better architectural solution rather than accumulating workarounds
- Refactor when necessary to maintain code health
