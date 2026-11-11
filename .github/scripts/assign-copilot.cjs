const BOT_LOGIN = "copilot-swe-agent[bot]";

async function authorize({ github, context, core }) {
  const author = context.payload.issue.user;
  if (author.type !== "User") {
    core.notice("Skipping issue: the author is not a human user.");
    return false;
  }
  const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
    ...context.repo,
    username: author.login,
  });
  const allowed = ["admin", "maintain", "write"].includes(data.role_name) ||
    ["admin", "write"].includes(data.permission) || data.user?.permissions?.push === true;
  if (!allowed) core.notice("Skipping issue: its author does not have repository write access.");
  return allowed;
}

async function assign({ github, context, core }) {
  const issueNumber = context.payload.issue.number;
  const { data: issue } = await github.rest.issues.get({
    ...context.repo,
    issue_number: issueNumber,
  });
  if (issue.state !== "open") {
    core.notice("Skipping issue: it is no longer open.");
    return;
  }
  if (issue.assignees.some((assignee) => assignee.login === BOT_LOGIN)) {
    core.notice("Copilot is already assigned; no new assignment requested.");
    return;
  }
  const { repository } = await github.graphql(
    `query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100) {
          nodes { login }
        }
      }
    }`,
    context.repo,
  );
  if (!repository?.suggestedActors.nodes.some((actor) => actor.login === "copilot-swe-agent")) {
    throw new Error("Copilot cloud agent is unavailable for this repository/token owner. Enable access before retrying. See README.md.");
  }
  const { data: assigned } = await github.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
    {
      ...context.repo,
      issue_number: issueNumber,
      assignees: [BOT_LOGIN],
      agent_assignment: {
        target_repo: `${context.repo.owner}/${context.repo.repo}`,
        base_branch: context.payload.repository.default_branch,
        custom_instructions: "Implement this issue with focused changes. Preserve the plain HTML/CSS/JavaScript app and existing behavior. Run the checks documented in README.md, add appropriate regression coverage, and open a pull request linked to this issue. Do not merge the pull request. If requirements are unclear or implementation is blocked, explain the blocker instead of inventing functionality.",
      },
    },
  );
  if (!assigned.assignees.some((assignee) => assignee.login === BOT_LOGIN)) {
    throw new Error("GitHub did not assign Copilot. Check token permissions and Copilot cloud agent access.");
  }
  core.notice(`Copilot assigned to issue #${issueNumber}. PR creation is asynchronous; review its result before merging.`);
}

module.exports = { authorize, assign };
