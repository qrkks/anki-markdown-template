# Release workflow

The release publishes two independently installable artifacts:

- `anki-markdown-basic.apkg`: `Markdown Basic`, its `Basic` card template, demo deck,
  and all pinned local renderer resources.
- `anki-english-vocabulary.apkg`: `单词`, its `RECITE`/`SPELLING`/`DICTATION`
  card templates, demo deck, and the same pinned local renderer resources.

## Local verification

1. Ensure the worktree contains only the intended release changes.
2. Set the target version in `package.json`.
3. Run:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm run check
   $env:SOURCE_DATE_EPOCH = (git log -1 --format=%ct)
   pnpm run package:all
   ```

4. Confirm that `release/SHA256SUMS.txt` matches both APKG files.
5. Import both APKGs into an isolated Anki profile. Check the Basic front and answer;
   all three vocabulary cards; dark mode; multiline KaTeX; highlighted code; Mermaid;
   and offline reopening. Never use the default profile for release-import validation.

The package command already imports both artifacts into temporary collections through
Anki's official Python library and verifies stable model, field, and template IDs,
templates and Styling CSS, demo notes, generated cards, and all media SHA-256 values.
`SOURCE_DATE_EPOCH` also fixes the APKG ZIP timestamps, so rebuilding the same commit
produces the same package checksum.

## Publish

Push `main`, create the matching tag, and push the tag:

```powershell
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main
git push origin v0.2.0
```

`.github/workflows/release.yml` rejects a tag that differs from the version in
`package.json`. After checks and isolated APKG verification pass, it creates the GitHub
Release and attaches the APKG and checksum file.

Verify the published artifact independently:

```powershell
gh release view v0.2.0
gh release download v0.2.0 --pattern "*.apkg" --pattern "SHA256SUMS.txt"
Get-FileHash -Algorithm SHA256 .\anki-markdown-basic.apkg
Get-FileHash -Algorithm SHA256 .\anki-english-vocabulary.apkg
```

## Rollback

If validation fails before the tag is pushed, do not tag the commit. If the workflow
fails, no Release is created. If a published artifact is later found to be invalid,
remove the Release, remove the remote tag, fix the issue on `main`, and publish a new
patch version. Deleting a published Release or tag is destructive and must be explicitly
approved before running those commands.
