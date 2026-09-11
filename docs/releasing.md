# Release workflow

The release publishes two independently installable artifacts:

- `anki-markdown-basic.apkg`: `Markdown Basic`, its `Basic` card template, demo deck,
  and all pinned local renderer resources.
- `anki-english-vocabulary.apkg`: `单词`, its `RECITE`/`SPELLING`/`DICTATION`
  card templates, demo deck, and the same pinned local renderer resources.

## Local verification

1. Ensure the worktree contains only the intended release changes.
2. Set the target version in `package.json`.
3. Add the version to both `CHANGELOG.md` and `CHANGELOG.zh-CN.md`, then create the
   bilingual GitHub Release body at `docs/releases/vX.Y.Z.md`. Keep the version and
   date headings aligned across both changelogs.
4. Run:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm run check
   $env:SOURCE_DATE_EPOCH = (git log -1 --format=%ct)
   pnpm run package:all
   ```

5. Confirm that `release/SHA256SUMS.txt` matches both APKG files.
6. Import both APKGs into an isolated Anki profile. Check the Basic front and answer;
   all three vocabulary cards; dark mode; multiline KaTeX; highlighted code; Mermaid;
   and offline reopening. Never use the default profile for release-import validation.

The package command already imports both artifacts into temporary collections through
Anki's official Python library and verifies stable model, field, and template IDs,
templates and Styling CSS, demo notes, generated cards, and all media SHA-256 values.
`SOURCE_DATE_EPOCH` also fixes the APKG ZIP timestamps, so rebuilding the same commit
produces the same package checksum.

## Publish

The preferred maintainer path is an explicit release commit on `main`. First push the
prepared release changes and confirm CI is green. Then create an empty commit whose
first line exactly matches the version in `package.json`:

```powershell
$version = "0.4.0"
git push origin main
git commit --allow-empty -m "chore: release v$version"
git push origin main
```

When `.github/workflows/release.yml` sees `chore: release vX.Y.Z` on `main`, it:

1. Confirms that `package.json` resolves to the same `vX.Y.Z` tag name.
2. Requires `docs/releases/vX.Y.Z.md` and runs the full `pnpm run check` suite.
3. Creates and pushes the tag when it does not already exist.
4. Checks out that tag, builds and verifies both APKG files reproducibly, and generates
   `SHA256SUMS.txt`.
5. Creates the GitHub Release from the bilingual release-notes file and attaches both
   APKG files plus the checksum manifest.

If the tag already exists, the same explicit release commit is treated as a release
retry: the workflow keeps the existing tag, rebuilds from that tag, and creates the
GitHub Release only when it does not already exist.

### Manual tag compatibility path

A manually pushed matching tag remains supported. Use this only after the prepared
release commit is on `main` and its checks are green:

```powershell
$version = "0.4.0"
git tag -a "v$version" -m "Release v$version"
git push origin main
git push origin "v$version"
```

The tag-triggered release job rejects a tag that differs from the version in
`package.json` or has no matching `docs/releases/vX.Y.Z.md`. After the full checks and
isolated APKG verification pass, it creates the GitHub Release from that notes file and
attaches both APKG files and `SHA256SUMS.txt`.

## Verify the published release

Replace the example version with the version just published:

```powershell
$version = "0.4.0"
gh release view "v$version"
gh release download "v$version" --pattern "*.apkg" --pattern "SHA256SUMS.txt"
Get-FileHash -Algorithm SHA256 .\anki-markdown-basic.apkg
Get-FileHash -Algorithm SHA256 .\anki-english-vocabulary.apkg
```

Confirm that the GitHub Release is neither a draft nor a prerelease and that it contains
all three expected assets:

- `anki-markdown-basic.apkg`
- `anki-english-vocabulary.apkg`
- `SHA256SUMS.txt`

## Rollback and retry

If validation fails before a tag is created, fix the issue on `main` and do not publish.
If an explicit release run creates the tag but fails before creating the GitHub Release,
fix the workflow or release preparation without moving the existing tag, then push a new
empty `chore: release vX.Y.Z` commit to retry the release from that tag.

If a published artifact is later found to be invalid, prefer fixing the problem and
publishing a new patch version. Deleting an existing GitHub Release or remote tag is a
destructive operation and must be explicitly approved before running those commands.
