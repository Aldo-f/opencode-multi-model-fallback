# GitHub Actions Workflows

This directory contains CI/CD workflows for the opencode-multi-model-fallback project.

## Available Workflows

### publish.yml
Manages package publishing to multiple registries:

- **npmjs.com** (`npm publish --access=public` → `https://registry.npmjs.org`, scoped `@usful`)
- **Bun Registry** (`bun publish`)
- **JSR** (`npx jsr publish`)

Triggers on version tags (e.g., `v0.4.2`, `v0.3.5`).

Steps run automatically on every matching tag push:

1. `bun install`
2. `bun run typecheck`
3. `bun test`
4. `npm run build` (emits `dist/`)
5. `npm publish --access=public` (requires `NPM_TOKEN` secret for `@usful` scope)
6. `gh release create <tag>` (creates GitHub Release automatically via `GITHUB_TOKEN`)
7. `bun publish` (requires `BUN_TOKEN`)
8. `npx jsr publish` (requires `JSR_TOKEN`)

## Release Tags

A release tag (`v*.*.*`) **must** exist when publishing a new version. The workflow:

- Runs on pushes to tags matching `v*.*.*`
- Builds and publishes to all registries
- Automatically creates a GitHub Release for that tag (`gh release create`)

## Usage

Each workflow is triggered automatically on pushes to tags matching the pattern.

For local testing, refer to the scripts in `package.json`:

- `npm run build` - Build to `dist/`
- `npm run typecheck` - TypeScript type check
- `npm test` - Run tests
- `npm run publish:npm` - Publish to npmjs.com only
- `npm run publish:bun` - Publish to Bun Registry only
- `npm run publish:jsr` - Publish to JSR only
- `npm run publish:all` - Publish to all registries (note: may require multiple auth tokens)

## Security Notes

- Auth tokens are stored as GitHub Actions secrets
- Publishing to public registries is safe
- Consider restricting workflow permissions based on your security requirements
- `NPM_TOKEN` must grant access to the `@usful` npm org for npmjs.com publishing
