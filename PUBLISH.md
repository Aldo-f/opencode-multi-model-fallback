PUBLISH CHECKLIST — @usful/opencode-multi-model-fallback

Prerequisites (verify before pushing):
  [ ] npm test → 17 pass, 0 fail
  [ ] npm run typecheck → 0 errors
  [ ] git status → clean working tree (or committed)
  [ ] .husky/pre-commit runs prettier --write + eslint --fix + tests

Commands to publish to all managers:

  1. Bump version and commit
     npm version 0.4.1
     git add .
     git commit -m "Release 0.4.1"
     git push origin main
     git push --tags origin v0.4.1

  2. npmjs.com (public, scoped @usful)
     npm publish --access=public --registry=https://registry.npmjs.org
     Verify: npm view @usful/opencode-multi-model-fallback version

  3. Bun registry
     npm run publish:bun  (or: bun publish)

  4. JSR (jsr.io)
     npm run publish:jsr  (or: npx jsr publish)
     Needs: JSR_TOKEN env or .npmrc auth

  5. GitHub Packages (optional — for org-internal)
     npm run publish:github  (needs GITHUB_TOKEN in .npmrc)

Post-publish verification:
  [ ] npm view @usful/opencode-multi-model-fallback@0.4.1
  [ ] opencode plugin @usful/opencode-multi-model-fallback  (local install test)
  [ ] Check README.md has no emails, uses scoped package name
  [ ] Check .github/workflows/README.md exists
