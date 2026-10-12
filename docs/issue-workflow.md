# Issue to review

How any worker, person or agent, takes a Linear issue from its ID to a reviewable change, and leaves a record another worker can resume from. It fills in steps 2, 5 and 6 of the [remote development contract](remote-development.md).

## How far along a change is

A status is a claim; the evidence makes it true. Use these words, in issues and pull requests, and only with the evidence beside them.

| Level | Means | Evidence | Linear state |
| --- | --- | --- | --- |
| Implemented | The change exists on the issue's branch | Branch and head commit | In Progress |
| Validated | `npm run validate` passed on that commit | Its summary table, and the commit | In Progress |
| In review | A pull request is open with the record below | The PR link | In Review |
| Merged | On `main`, and so deployed to dev (and today to prod) | Merge commit; `/api/health` showing it where relevant | In Review, until acceptance is checked |
| Complete | Every acceptance criterion holds | One line of evidence per criterion | Done |

**Merging is not completing.** Linear moves an issue to Done when a pull request naming it merges, whether or not the issue's acceptance criteria are met. After every merge, check each criterion; if any remain, set the issue back to In Progress and comment what is done and what remains (as CAR-100 and CAR-121 needed). A pull request that does only part of an issue says so in its description: `Part of CAR-123`.

## Steps

1. **Read the issue.** The description, every comment, its relations (blocked by, blocks, duplicates) and the pull requests attached to it. Don't trust its state: compare it with the latest evidence in the comments. List the acceptance criteria and anything undecided. An unclear criterion is a question for the issue's owner, not something to guess.
2. **Check for existing work.** Open branches and pull requests for the issue, and recent commits on `main` that mention it. Continue them rather than starting over; if another worker may still be active on them, ask before taking over.
3. **Claim it.** Assign yourself, set In Progress, and comment a start record (below). Work on the branch Linear names for the issue, in your own checkout (`npm run workspace` shows its own stack and ports).
4. **Build and validate.** Keep the change to the issue's scope. Run `npm run validate`; a check that fails or is `unavailable` means the change isn't ready.
5. **Open the pull request.** Use the template: what changed, why, the validation table, browser or preview evidence when the user interface changed, decisions, and remaining risks. Then comment the review record on the issue and set In Review.
6. **After merge,** check acceptance as above, and record the outcome on the issue.

If you stop before finishing, at any step, leave a handoff record. Never leave an issue In Progress with nothing on it saying where things stand.

## Records

Comment these on the issue. Keep secrets, tokens and real users' data out of them.

```markdown
**Started** · <worker> · source <commit>
Plan: <one or two lines>
Acceptance criteria: <the list, each marked open>
Open questions: <none, or the question and who decides>
```

```markdown
**<In review | Handoff | Merged>** · <worker> · head <commit> · <PR link>
Level: <implemented | validated | in review | merged | complete>
Validation: <npm run validate result, or which checks failed or were unavailable>
Acceptance: <each criterion: met (evidence) | open (why)>
Decisions: <made, with reasons; or needed, and from whom>
Next action: <the exact next step, and who takes it>
Blockers: <none, or what and who unblocks it>
```
