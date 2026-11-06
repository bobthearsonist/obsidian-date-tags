# Releasing Date Tags Automation

## Prepare a release

1. Update the version in `package.json`, `manifest.json`, and `versions.json`. Keep all three in sync.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Commit the generated `main.js` if the build changed it, then merge the release changes to `main`.
4. Create a GitHub release whose tag exactly matches the manifest version, without a `v` prefix. Attach only `main.js` and `manifest.json`.

## Verify release assets and attestations

Publishing a GitHub release starts the **Release attestations** workflow. It checks out the release tag, runs the tests and build, verifies that the uploaded assets match the source build, and creates GitHub Artifact Attestations for both files.

Wait for the workflow to succeed, then verify each downloaded asset from the repository root:

```sh
gh attestation verify main.js --repo bobthearsonist/obsidian-date-tags
gh attestation verify manifest.json --repo bobthearsonist/obsidian-date-tags
```

## Update the Obsidian directory

1. Open the plugin entry under **Account > Plugins** on [community.obsidian.md](https://community.obsidian.md/account/plugins).
2. Select **Check for new releases** and wait for the automated review to complete.
3. Confirm build verification passes and the release has no blocking errors, then select **Publish**.
4. Open the public [Date Tags Automation listing](https://community.obsidian.md/plugins/date-tags) and confirm it shows the new version.
