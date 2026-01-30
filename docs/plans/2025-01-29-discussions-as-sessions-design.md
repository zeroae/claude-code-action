# GitHub Discussions as Persistent Claude Sessions

**Date:** 2025-01-29
**Status:** Draft
**Author:** @sodre + Claude

## Overview

This design extends `claude-code-action` to treat GitHub Discussions as persistent, shareable, branching conversation sessions with Claude. Unlike Issues/PRs which are task-oriented, Discussions become exploratory thinking spaces that can optionally "graduate" to actionable work items.

## Motivation

Currently, Claude Code sessions are ephemeral and local. Valuable conversations about architecture, debugging approaches, or feature exploration are lost or require manual effort to preserve. GitHub Discussions provide a natural home for these conversations:

- **Persistent**: Conversations survive indefinitely
- **Shareable**: Team members can observe, learn, or join
- **Branching**: Natural threading supports parallel exploration
- **Graduated**: Good ideas can become Issues/PRs when ready

## Core Concepts

### Discussions as Session Trees

Each Discussion becomes a conversation tree where:
- Each Claude response is a potential branch point
- Users can reply to any Claude comment to fork the conversation
- Users can "rewind" by replying to older comments
- Multiple threads can evolve in parallel

```
Discussion #42
├── User: "How should I implement auth?"
│   └── Claude: "Here are 3 approaches..."
│       ├── User: "Tell me more about JWT"        ← Branch A
│       │   └── Claude: "JWT works by..."
│       │       └── User: "What about refresh tokens?"
│       │           └── Claude: "For refresh tokens..."
│       │
│       └── User: "What about session-based?"     ← Branch B (parallel)
│           └── Claude: "Session auth stores..."
│
└── User (replies to root Claude comment): "Actually, let's reconsider OAuth"
    └── Claude: "OAuth is interesting because..."  ← Rewind/new branch
```

### Claude Zones

Specific Discussion categories are designated as "Claude zones" where:
- New discussions get immediate Claude responses
- Any reply triggers Claude (no `@claude` mention needed)
- Each category can have different capability levels

### Exploratory by Default

Discussions are for thinking, not executing:
- Read/explore code: Always enabled
- Web search: Enabled with credential protection
- Edit files locally: Enabled for prototyping
- Commit & push: Disabled by default, gated by label or category config
- Create Issue/PR: Via graduation skills

## Detailed Design

### 1. Triggers & Activation

#### Category-Based Triggers

Configuration in `.github/claude-discussions.yml`:

```yaml
session_branch: claude-sessions  # orphan branch for session storage

categories:
  - name: "Claude Q&A"
    capabilities:
      web_search: true
      edit_files: false
      can_commit: false

  - name: "AI Prototyping"
    capabilities:
      web_search: true
      edit_files: true
      can_commit: false

  - name: "Claude Dev"
    capabilities:
      web_search: true
      edit_files: true
      can_commit: true  # Full access for trusted space
```

#### Event Handling

| Event | Trigger Condition | Action |
|-------|-------------------|--------|
| `discussion.created` | Category in config | Claude responds to opening post |
| `discussion_comment.created` | Category in config OR `@claude` mention | Claude responds in thread |

#### Fallback Behavior

- Discussions NOT in configured categories: `@claude` mention required
- Configured categories: All replies trigger Claude

### 2. Response Model

#### Threaded Replies

Claude posts new comments as threaded replies to the triggering comment:
- Preserves conversation structure
- Enables natural branching
- Each response is a potential fork point

#### Smart Quoting

Claude quotes the triggering message only when:
- Thread is long (>5 messages in chain)
- Context might be ambiguous
- Otherwise, threading provides sufficient context

#### Title Suggestions

For new discussions, Claude may suggest a better title:
- Analyzes the content
- Proposes descriptive title
- Can auto-update if permitted

### 3. Session Persistence

#### Storage Location

Sessions stored on `claude-sessions` orphan protected branch:

```
claude-sessions/
└── discussions/
    └── {discussion-number}/
        ├── DC_abc123.yaml    # Session for Claude comment abc123
        ├── DC_def456.yaml    # Session for Claude comment def456
        └── _summary.yaml     # Overall discussion summary (fallback)
```

#### Session File Format

Per-comment session file (minimal, since Claude session has full history):

```yaml
# DC_abc123.yaml
comment_id: DC_abc123
parent_comment_id: null  # null for root, or parent DC_* for threading
session_id: sess_abc123xyz
created_at: 2025-01-29T10:30:00Z
updated_at: 2025-01-29T10:35:00Z
summary: "Explored JWT vs session auth. User leaning toward JWT with RS256."
```

Discussion summary file (fallback if all sessions expire):

```yaml
# _summary.yaml
discussion_id: 42
title: "Authentication approach for API"
last_updated: 2025-01-29T15:00:00Z
key_decisions:
  - "Use JWT with RS256"
  - "15min access tokens"
  - "Refresh token rotation enabled"
branches:
  - root: DC_abc123
    latest: DC_ghi789
    topic: "JWT implementation details"
  - root: DC_abc123
    latest: DC_jkl012
    topic: "Session-based alternative"
```

#### Session Resume Logic

When Claude receives a trigger:

1. Walk the reply chain to find the most recent Claude comment
2. Look up session file for that comment ID
3. If session exists and `session_id` valid: resume with `--resume`
4. If session expired: use `summary` field as context
5. If no session found: use `_summary.yaml` or start fresh

### 4. Capabilities

#### Default Capabilities

| Capability | Discussions | Issues/PRs |
|------------|-------------|------------|
| Answer questions | ✅ | ✅ |
| Read/explore code | ✅ | ✅ |
| Web search | ✅ (sanitized) | ❌ |
| Edit files (local) | ✅ | ✅ |
| Commit & push | Gated | ✅ |
| Create Issue/PR | Via skill | N/A |

#### Web Search Protection

To prevent credential leakage:
- Sanitize queries: Strip patterns matching secrets/tokens before searching
- Sanitize stored context: Don't persist search results to session files
- Allowlist approach: Consider limiting to known-safe domains

#### Commit Gating

Commits disabled by default in discussions. Can be enabled via:
- Category config: `can_commit: true`
- Label trigger: Add `claude-can-commit` label to discussion

### 5. Graduate to Issue/PR

#### Skills

Two new skills for graduating discussions to actionable items:
- `/create-issue` - Create a GitHub Issue from discussion
- `/create-pr` - Create a Pull Request from discussion

#### Draft-in-Place Workflow

1. User invokes skill: "Let's turn this into an issue"
2. Claude posts draft as structured comment:

```markdown
📝 **Draft Issue**

**Title:** Implement JWT authentication with RS256

**Labels:** `enhancement`, `auth`

**Assignees:** (none)

**Body:**
Based on our discussion, we've decided to implement JWT authentication:

- Use RS256 signing algorithm
- 15-minute access token expiry
- Refresh tokens with rotation
- Store refresh tokens in httpOnly cookies

Resolves discussion #42.

---
💬 Reply to refine this draft, or say "create it" to publish.
```

3. User can iterate: "Add a note about rate limiting"
4. Claude edits the same comment with updates
5. User says "create it"
6. Claude creates Issue/PR, links back to discussion

### 6. Error Handling

#### Retry Strategy

- Transient failures: Silent retry (up to 3 attempts)
- Persistent failures: Post inline explanation

#### Error Communication

```markdown
⚠️ I ran into an issue and couldn't complete your request.

**Error:** Rate limit exceeded
**Suggestion:** Try again in 5 minutes

[View job run](link)
```

### 7. Workflow Configuration

#### Required Events

```yaml
on:
  discussion:
    types: [created]
  discussion_comment:
    types: [created]
```

#### Permissions

```yaml
permissions:
  contents: write      # For session storage branch
  discussions: write   # For posting replies
  issues: write        # For /create-issue skill
  pull-requests: write # For /create-pr skill
```

## Implementation Phases

### Phase 1: Basic Discussion Support

- [ ] Category-based triggers via `.github/claude-discussions.yml`
- [ ] Threaded reply responses
- [ ] Session storage on orphan branch (single session per discussion)
- [ ] `discussion.created` and `discussion_comment.created` event handling

### Phase 2: Branching & Session Management

- [ ] Per-comment session storage
- [ ] Reply chain walking for session lookup
- [ ] Fork/rewind support
- [ ] Session resume with fallback to summary

### Phase 3: Graduation Skills

- [ ] `/create-issue` skill with draft-in-place
- [ ] `/create-pr` skill with draft-in-place
- [ ] Draft editing workflow
- [ ] Bidirectional linking (discussion ↔ issue/PR)

### Phase 4: Polish

- [ ] Smart quoting logic
- [ ] Title suggestion/update
- [ ] Per-category capability configuration
- [ ] Web search with credential protection
- [ ] Commit gating by label

## Migration Path

### From Local Action

The `zeroae/discussions` repo currently uses a local action at `.github/actions/claude-ae/`. Migration:

1. Update workflow to use `zeroae/claude-code-action@main`
2. Add `.github/claude-discussions.yml` configuration
3. Create `claude-sessions` orphan branch
4. Test with a single Claude zone category

### Upstream Contribution

After proving the design in the fork:

1. Clean up implementation
2. Add comprehensive tests
3. Document the feature
4. Open PR to `anthropics/claude-code-action`

## Open Questions

1. **Session expiry**: How long do Claude Code sessions last? Need fallback strategy.
2. **Large discussions**: Performance with 100+ comment threads?
3. **Concurrent replies**: What if two users reply simultaneously?
4. **Category renaming**: Handle category name changes in config?

## References

- [GitHub Discussions API](https://docs.github.com/en/graphql/reference/objects#discussion)
- [Claude Code Action](https://github.com/anthropics/claude-code-action)
- Current fork: https://github.com/zeroae/claude-code-action
