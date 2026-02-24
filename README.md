# GitHub Virtual Collaborators

GitHub Action that helps virtual collaborators (VCs) communicate across Issues and Pull Requests using `@#name` mentions and slash commands.

Operate multiple AI agents under single GitHub account with native Issue/PR collaboration workflows.

---

## Features

- Parses VC syntax in Issues/PRs/comments (`@#name`, `/assign`, `/watch`).
- Persists collaboration metadata through either GitHub labels or Project fields (`author`, `participant`, `assignee`).
- Emits VC-scoped notifications to dedicated inbox issues.

---

## Quick Start

If you are new to this action, start with the **default `label` backend**.

Create `.github/workflows/virtual-collaborators.yml`:

```yaml
name: Virtual Collaborators

on:
  issues:
    types: [opened, edited, closed, reopened]
  issue_comment:
    types: [created, edited]
  pull_request:
    types: [opened, edited, closed, reopened, synchronize]
  check_run:
    types: [completed]

permissions:
  issues: write
  contents: read

jobs:
  virtual-collaborators:
    runs-on: ubuntu-latest
    steps:
      - uses: heoh/github-virtual-collaborators@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Test body example:

```md
###### authored by @#alice
/assign @#bob
Please review this @#carol
```

### Verify It Works (Checklist)

- [ ] Add VC syntax to an Issue/PR body or comment.
- [ ] Confirm metadata labels appear (example: `vc:assignee:bob`).
- [ ] Confirm notification inbox issue exists:
  - `is:issue is:closed in:title "[VC:notifications] @#bob"`
- [ ] Confirm a new comment is posted in the inbox when relevant events happen.

Useful searches:

- Label backend:
  - `label:"vc:assignee:bob"`

---

## Choose Your Backend

| Backend | Best for | Token | Pros | Trade-offs |
| --- | --- | --- | --- | --- |
| `label` (default) | First setup, simplest operation | Usually `GITHUB_TOKEN` | Fast setup, easy search via labels | Metadata labels are visible on Issue/PR |
| `project` | Teams that want metadata outside labels | PAT (`repo`, `project`) | Keeps metadata in Project field | More setup (Project v2 + field + token) |

> Recommended path: start with `label`, then move to `project` only if needed.

---

## Project Backend Setup (Advanced)

Use this only if you prefer storing metadata in Project v2 field instead of labels.

1. Create or choose a **Project v2**.
2. Add a **Text custom field** (default field name: `Tags`).
3. Create a secret (for example `PROJECT_TOKEN`) with scopes:
   - `repo`
   - `project`
4. Use the workflow below:

```yaml
      - uses: heoh/github-virtual-collaborators@v1
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          metadata-backend: 'project'
          project-owner: 'org-or-user'
          project-number: 1
          project-tags-field-name: 'Tags'
```

Project view search example:

- `Tags:"* assignee:bob *"`

---

## Inputs

Defined in `action.yml`.

| Input | Required | Default | Applies to | Description |
| --- | --- | --- | --- | --- |
| `github-token` | yes | - | all | Token used by this action |
| `metadata-backend` | no | `label` | all | Metadata backend: `label` or `project` |
| `virtual-collaborators` | no | `''` | all | Comma-separated allow-list (without `@#`) |
| `label-prefix` | no | `vc:` | label | Label prefix for metadata labels |
| `label-default-color` | no | `b0b0b0` | label | Default color for auto-created labels |
| `project-owner` | conditionally required | - | project | Org/user that owns the target Project |
| `project-number` | conditionally required | - | project | Project v2 number |
| `project-tags-field-name` | no | `Tags` | project | Text field name used for tags |

---

## VC Syntax

### Header

```md
###### authored by @#alice
```

### Commands (at line-start)

```md
/assign @#bob
/unassign
/watch
/unwatch
```

### Mentions

```md
Please review this, @#carol
```

---

## Tag Model

Tags are represented as `key:value` pairs:

- `author:<vc-name>`
- `participant:<vc-name>`
- `assignee:<vc-name>`

Storage:

- `label` backend: stored as labels (default prefix `vc:`), e.g. `vc:author:alice`
- `project` backend: stored in configured Project text field

---

## Notifications

Each VC has a dedicated inbox issue:

- Title: `[VC:notifications] @#<vc-name>`
- Inbox issues may be managed as **closed** state

If you cannot find one, search including closed issues:

- `is:issue is:closed in:title "[VC:notifications] @#carol"`

---

## Security & Permissions

- Store tokens in GitHub Secrets only.
- Follow least privilege.
- For `project` backend, `GITHUB_TOKEN` may not have enough Project write permission in some org/repo settings.

Permission troubleshooting:

1. Check token exists and is valid.
2. Check required scopes (`repo`, `project`).
3. Check `project-owner` and `project-number` target the correct Project.
4. Check `project-tags-field-name` matches existing Text field name exactly.

---

## How It Works

1. Issue/PR/Comment/Check Run event triggers.
2. Action parses VC syntax.
3. Action updates metadata in selected backend.
4. Action determines notification targets.
5. Action creates/comments on VC notification inbox issues.

---

## Release (Maintainers)

This section is for maintainers.

- Workflow: `.github/workflows/release.yml`
- Trigger: **Actions → Release → Run workflow**
- Input: `version` (SemVer without `v`, e.g. `1.2.3`)

Workflow behavior:

1. Validates input and ensures the run is on `main`.
2. Updates `package.json`/`package-lock.json` version.
3. Runs lint, test, and build.
4. Commits release artifacts (`dist`, `package.json`, `package-lock.json`) to `main`.
5. Creates `vX.Y.Z` tag and force-updates matching major tag (`vX`) to the same release commit.

After the workflow finishes:

6. Create a GitHub Release manually using the generated `vX.Y.Z` tag (you can use auto-generated notes in the GitHub UI).

---

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

---

## License

This project is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
