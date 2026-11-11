# Publishing checklist

## Before publishing

- Confirm the version in `package.json` and review the generated package contents.
- Run the complete local gate:

  ```sh
  npm run test:pack
  ```

  This packs the project, checks the exact file allowlist, runs `publint` and Are the Types Wrong, installs the tarball into an isolated temporary project, typechecks consumers, and verifies Node SSR plus browser rendering.

The package is intentionally ESM-only. `attw` runs with its `esm-only` profile; its default CommonJS `require()`-to-ESM warning is expected and is outside the supported entry modes. The smoke test separately verifies the supported `NodeNext` ESM and TypeScript bundler resolutions. The ignored CJS diagnostic is not a package error; CommonJS consumers must use dynamic `import()`.

## Try the tarball in an application

From the repository root:

```sh
npm pack
```

Then install the generated tarball by its absolute path in a Vite or Next.js test application:

```sh
npm install /absolute/path/to/garymazzeo-mini-chart-0.1.0.tgz
```

Prefer testing the tarball over `npm link`: packing exercises the actual `files` whitelist and package exports, so it catches omitted files. Linking can also resolve React from the library's development `node_modules`, accidentally loading a second React copy and hiding peer-dependency problems.

## One-time npm account setup

1. Create the npm account and enable two-factor authentication (2FA) for writes.
2. On the release machine, authenticate interactively and verify the account:

   ```sh
   npm login
   npm whoami
   ```

Do not put a long-lived publishing credential in the repository. npm's current docs schedule direct publishing with bypass-2FA granular tokens for removal in January 2027; trusted publishing and staged publishing are the direction for automation. For an initial manual laptop release, interactive login with 2FA is the simple path. See [npm access tokens](https://docs.npmjs.com/about-access-tokens) and [trusted publishers](https://docs.npmjs.com/trusted-publishers).

## Publish

For the initial `0.1.0` release, after the checks and manual app test:

```sh
npm run test:pack
npm publish --access public
```

For a later release, bump the version, then repeat the gate and publish:

```sh
npm version patch # or minor / major
npm run test:pack
npm publish --access public
```

`npm version` updates `package.json` and `package-lock.json`, and normally creates a Git commit and tag. Review those before pushing the release commit/tag.

## If a release is wrong

Unpublishing is restricted. Under npm's current [unpublish policy](https://docs.npmjs.com/policies/unpublish/):

- A newly created package can be unpublished within 72 hours only if no other packages depend on it.
- After 72 hours, unpublishing is allowed only when all apply: no dependents, fewer than 300 downloads in the last week, and a single owner/maintainer.
- A published `package@version` can never be reused, even after unpublishing it.
- If all versions are unpublished, npm blocks republishing the package name for 24 hours.

If the unpublish criteria are not met, deprecate the affected package or version with `npm deprecate` and publish a corrected new version. Check npm's policy page before acting because registry rules can change.
