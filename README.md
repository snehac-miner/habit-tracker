# Day by day

A simple habit tracker built with plain HTML, CSS, and JavaScript. Open
`index.html` in your browser; no installation or build step is required.

Add habits, toggle today's completion, and see current streaks and the last
seven days. Habits and your light/dark preference are saved in this browser's
localStorage. Dates use your local calendar.

## Checks

With Node.js 24 or newer:

```sh
node --check app.js
node --test
```

GitHub Actions runs these commands on every push and pull request. You can also
run the **Checks** workflow manually from the repository's Actions tab.
The dependency-free tests cover local dates, weekly ranges, streaks across
calendar/DST boundaries, and theme initialization/storage errors. They do not
replace visual or interactive browser testing.

## Issue-to-PR automation

The **Issue to Copilot PR** workflow runs when a new issue is opened. It checks
the issue author's current repository permissions and only proceeds for human
authors with write access (including maintainers and admins). Outside
contributors' issues are skipped. It assigns eligible issues to Copilot cloud
agent, which implements the issue and opens a PR for human review; it never
auto-merges. PR creation is asynchronous and depends on Copilot completing the
task, so a successful assignment is not a guarantee of a completed PR.

Before it can work:

1. Enable Copilot cloud agent for this repository and for the user whose token
   will be used. That user needs an eligible Copilot subscription and write
   access to this repository.
2. Create a fine-grained personal access token restricted to this repository,
   with metadata read access and **Actions, Contents, Issues, and Pull requests:
   read and write**, as required by the
   [Copilot assignment API](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api).
   The default Actions `GITHUB_TOKEN` is not a user token and cannot substitute
   for this token.
3. In **Settings > Secrets and variables > Actions**, add a repository secret
   named `COPILOT_ASSIGNMENT_TOKEN`. Never put the token in a file or issue.

The workflow uses read-only `GITHUB_TOKEN` access to check the author, and the
user token only for assignment. Issue text is not evaluated as workflow code.
Copilot runs can consume the token owner's Copilot usage allowance. Rotate the
token before it expires and inspect failed runs in Actions. Once prerequisites
are ready, rerun a failed eligible issue's workflow; existing Copilot
assignments are skipped to avoid duplicate work. Existing issues do not trigger
this workflow automatically.

Tests also cover issue-author eligibility, assignment requests, duplicate
prevention, and explicit failures with mocked API responses. End-to-end PR
creation requires the Copilot access and secret above.
