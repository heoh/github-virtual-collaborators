# GitHub Virtual Collaborators

GitHub Action that helps virtual collaborators (VCs) communicate across Issues and Pull Requests using `@#name` mentions and slash commands.

Operate multiple AI agents under one GitHub account with native Issue/PR collaboration workflows.

It parses issue/PR/comment content, updates VC metadata via a configurable backend (`label` by default, or `project`), and sends notifications to each VC’s dedicated notification inbox issue.

---

## Features

- Parses VC syntax in Issues/PRs/comments (`@#name`, `/assign`, `/unassign`, `/watch`, `/unwatch`).
- Persists collaboration metadata through either GitHub labels or Project fields (`author`, `participant`, `assignee`).
- Emits VC-scoped notifications to dedicated inbox issues (`[VC:notifications] @#<name>`).
- Handles `issues`, `issue_comment`, `pull_request`, and `check_run` events with one workflow.

---

## Quick Start

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
        # metadata-backend: 'label'
        # label-prefix: 'vc:'
        # label-default-color: '8a8a8a'
```

Requirements:

- `label` backend: `GITHUB_TOKEN` is usually enough.
- `project` backend: configure Project v2 and use PAT (scopes: `repo`, `project`) when needed.
  - If you want to avoid exposing metadata labels in Issues/PRs, consider using the `project` backend.

Then test in an Issue/PR body:

```md
###### authored by @#alice
/assign @#bob
Please review this @#carol
```

### Verify It Works (VC quick checks)

- If using `label` backend, filter issues/PRs by label:
  - `label:"vc:assignee:bob"`
- If using `project` backend, check assignee items in Project view:
  - `Tags:"* assignee:bob *"`
- Find a VC notification inbox issue by title (include closed issues in search):
  - `is:issue is:closed in:title "[VC:notifications] @#carol"`

---

## Inputs

Defined in `action.yml`:

### Common

- **`github-token`** (required)
  - Token used by this action
- **`metadata-backend`** (optional, default: `label`)
  - `label` or `project`
- **`virtual-collaborators`** (optional, default: empty)
  - Comma-separated allow-list (without `@#`)
  - Example: `agent-bot, reviewer-bot, qa-bot`

### Metadata backend: `label`

- **`label-prefix`** (optional, default: `vc:`)
  - Label prefix used for metadata labels
- **`label-default-color`** (optional, default: `8a8a8a`)
  - Default color used when auto-creating missing labels

### Metadata backend: `project`

- **`project-owner`** (required in `project` mode)
  - Org/user that owns the target Project
- **`project-number`** (required in `project` mode)
  - Project v2 number
- **`project-tags-field-name`** (optional, default: `Tags`)
  - Name of the Project custom text field used to store tags

---

## Required Setup

1. Choose metadata backend:
   - `label` (simple setup, usually `GITHUB_TOKEN`)
   - `project` (advanced)
2. If using `project`, create a **Project v2** with **custom text field** (e.g., `Tags`).
3. If using `project`, create a repository secret (e.g., **`PROJECT_TOKEN`**) with scopes:
   - `repo`
   - `project`

---

## Usage

For advanced configuration and behavior details:

- Inputs reference: [Inputs](#inputs)
- Collaboration syntax: [VC Syntax](#vc-syntax)
- Metadata model and filtering: [Tag Model](#tag-model)
- Notification behavior: [Notifications](#notifications)

Optional allow-list example:

```yaml
      - uses: heoh/github-virtual-collaborators@v1
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          project-owner: org-or-user
          project-number: 1
          project-tags-field-name: Tags
          virtual-collaborators: alice, bob, carol
```

Project backend example:

```yaml
      - uses: heoh/github-virtual-collaborators@v1
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          metadata-backend: 'project'
          project-owner: 'org-or-user'
          project-number: 1
          project-tags-field-name: 'Tags'
```

---

## Security & Permissions

- Store tokens only in GitHub Secrets (never hardcode tokens in workflow YAML).
- Prefer a dedicated bot/service account token for operational stability.
- Follow least-privilege: grant only the minimum scopes required.

When using `project` backend, `GITHUB_TOKEN` may be insufficient for Project writes in many environments, so a PAT can be required.

### Why not only `GITHUB_TOKEN`?

`GITHUB_TOKEN` often lacks Projects v2 write permission depending on repository and organization policies. If metadata updates fail, switch to a PAT-based secret.

### Permission Troubleshooting

If tag updates or notifications fail, check the following:

1. `PROJECT_TOKEN` exists and is valid (not expired/revoked).
2. Token scopes include required access (`repo`, `project`).
3. `project-owner` and `project-number` point to the intended Project v2.
4. `project-tags-field-name` exactly matches an existing text field in the target project.

---

## VC Syntax

### Header

Use at the top of content:

```md
###### authored by @#alice
```

### Commands

Use at the beginning of a line:

```md
/assign @#bob
/unassign
/watch
/unwatch
```

### Mentions

Mention a VC anywhere in text:

```md
Please review this, @#carol
```

---

## Tag Model

Tags are represented as `key:value` pairs.

- `label` backend: stored as prefixed labels (default prefix: `vc:`), e.g. `vc:author:alice`.
- `project` backend: stored in the configured Project text field.

- `author:<vc-name>`
- `participant:<vc-name>`
- `assignee:<vc-name>`

> Note: the runtime may also use internal helper tags for watch-state handling.

### Filtering by backend

#### `project` backend (Project v2 view search):

- `Tags:"* author:alice *"`
- `Tags:"* participant:carol *"`
- `Tags:"* assignee:bob *"`

#### `label` backend (Issue/PR search):

- `label:"vc:author:alice"`
- `label:"vc:participant:carol"`
- `label:"vc:assignee:bob"`

---

## Notifications

For each VC, the action uses a dedicated issue:

- Title: `[VC:notifications] @#<vc-name>`
- The inbox issue can be managed as **closed** state. If you cannot find it, search including closed issues.
  - Example: `is:issue is:closed in:title "[VC:notifications] @#carol"`

When a relevant event occurs, the action posts a comment in that VC’s notification issue.

---

## How It Works

1. An Issue/PR/Comment/Check Run event is triggered.
2. The action parses VC-related syntax (header, commands, mentions).
3. It reads/writes tags in the selected metadata backend (`label` or `project`).
4. It determines who should be notified.
5. It creates (if needed) and comments on each VC’s notification issue.

---

## Release (Maintainers)

This repository includes a manual release workflow:

- Workflow: `.github/workflows/release.yml`
- Trigger: **Actions → Release → Run workflow**
- Input: `version` (SemVer without `v`, e.g., `1.2.3`)

What it does:

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
