# GitHub Actions Workflows

This directory contains CI/CD workflows for the opencode-multi-model-fallback project.

## Available Workflows

### publish.yml
Manages package publishing to multiple registries:
- **GitHub Packages** (`npm publish --registry=https://npm.pkg.github.com`)
- **Bun Registry** (`bun publish`)
- **JSR** (`npx jsr publish`)

Triggers on version tags (e.g., `v1.0.0`, `1.0.0`).

### Example structure

```yaml
title: Publish Package

on:
  push:
    tags:
      - "v*"
      - "*.0.0"
      - "*.0"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - name: Set auth for GitHub Packages
        run: echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> .npmrc
      - name: Publish to GitHub Packages
        run: npm publish --registry=https://npm.pkg.github.com
      - name: Publish to Bun Registry
        run: bun publish
      - name: Publish to JSR
        run: npx jsr publish
```

## Usage

Each workflow is triggered automatically on pushes to tags matching the pattern. The publish step uses authentication from GitHub Actions secrets.

For local testing, refer to the scripts in `package.json`:

- `npm run publish:github` - Publish to GitHub Packages only
- `npm run publish:bun` - Publish to Bun Registry only
- `npm run publish:jsr` - Publish to JSR only
- `npm run publish:all` - Publish to all registries (note: may require multiple auth tokens)

## Security Notes

- Auth tokens are stored as GitHub Actions secrets
- Publishing to public registries is safe
- Consider restricting workflow permissions based on your security requirements