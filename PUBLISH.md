PUBLISH CHECKLIST — @usful/opencode-multi-model-fallback

Prerequisites (verify before pushing):
  [ ] npm test → 17 pass, 0 fail
  [ ] npm run typecheck → 0 errors
  [ ] git status → clean working tree (or committed)
  [ ] .husky/pre-commit (autofixes with prettier + ESLint with @typescript-eslint; blocks commit if tests fail)

Commands to publish to all managers:

  1. Bump version and tag
      npm version patch
      git add .
      git commit -m "Release <version>"
      git push origin main
      git push --tags origin v<version>

  2. npmjs.com (public, scoped @usful) — CI does this automatically on v<version>
      npm publish --access=public --registry=https://registry.npmjs.org
      Verify: npm view @usful/opencode-multi-model-fallback version

  3. Bun registry
      npm run publish:bun  (or: bun publish)

  4. JSR (jsr.io)
      npm run publish:jsr  (or: npx jsr publish)
      Needs: JSR_TOKEN env or .npmrc auth

  5. CI workflow (auto-runs on every `v*.*.*` tag)
      Push the tag — runs `typecheck`, `test`, `build`, publishes to npmjs.com + bun + jsr,
      then **creates a GitHub Release** at that tag automatically.
      Requires repo secrets: `NPM_TOKEN` (access to @usful org), `BUN_TOKEN`, `JSR_TOKEN`.

Post-publish verification:
  [ ] npm view @usful/opencode-multi-model-fallback@<version>
  [ ] gh release list @usful/opencode-multi-model-fallback  (GitHub Release created?)
  [ ] opencode plugin @usful/opencode-multi-model-fallback  (local install test)
  [ ] Check README.md has no emails, uses scoped package name
  [ ] Check .github/workflows/README.md exists