# Release workflow

`Markdown Basic` is published as `anki-markdown-basic.apkg`. The package contains the
`Markdown Basic` note type, the `Basic` card template, the `Markdown Basic Demo` deck,
and all pinned local renderer resources.

## Local verification

1. Ensure the worktree contains only the intended release changes.
2. Set the target version in `package.json`.
3. Run:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm run check
   $env:SOURCE_DATE_EPOCH = (git log -1 --format=%ct)
   pnpm run package:basic
   ```

4. Confirm that `release/SHA256SUMS.txt` matches
   `release/anki-markdown-basic.apkg`.
5. Import the APKG into an isolated Anki profile and check the front, answer, dark mode,
   multiline KaTeX, highlighted code, Mermaid, and offline reopening. Never use the
   default profile for release-import validation.

The package command already imports the artifact into a temporary collection through
Anki's official Python library and verifies the stable model, field, and template IDs,
the templates and Styling CSS, the demo note, and all media SHA-256 values.
`SOURCE_DATE_EPOCH` also fixes the APKG ZIP timestamps, so rebuilding the same commit
produces the same package checksum.

## Publish

Push `main`, create the matching tag, and push the tag:

```powershell
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

`.github/workflows/release.yml` rejects a tag that differs from the version in
`package.json`. After checks and isolated APKG verification pass, it creates the GitHub
Release and attaches the APKG and checksum file.

Verify the published artifact independently:

```powershell
gh release view v0.1.1
gh release download v0.1.1 --pattern "anki-markdown-basic.apkg" --pattern "SHA256SUMS.txt"
Get-FileHash -Algorithm SHA256 .\anki-markdown-basic.apkg
```

## Rollback

If validation fails before the tag is pushed, do not tag the commit. If the workflow
fails, no Release is created. If a published artifact is later found to be invalid,
remove the Release, remove the remote tag, fix the issue on `main`, and publish a new
patch version. Deleting a published Release or tag is destructive and must be explicitly
approved before running those commands.
