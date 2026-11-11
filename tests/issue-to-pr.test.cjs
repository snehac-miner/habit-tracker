const assert = require("node:assert/strict");
const { test } = require("node:test");
const { authorize, assign } = require("../.github/scripts/assign-copilot.cjs");

function fixture() {
  const calls = [];
  return {
    calls,
    context: {
      repo: { owner: "example", repo: "habits" },
      payload: {
        issue: { number: 42, user: { login: "author", type: "User" } },
        repository: { default_branch: "main" },
      },
    },
    core: { notice(message) { calls.push(["notice", message]); } },
    github: {
      rest: {
        repos: { async getCollaboratorPermissionLevel() { return { data: { permission: "write" } }; } },
        issues: { async get() { return { data: { state: "open", assignees: [] } }; } },
      },
      async graphql() {
        return { repository: { suggestedActors: { nodes: [{ login: "copilot-swe-agent" }] } } };
      },
      async request(route, payload) {
        calls.push(["request", route, payload]);
        return { data: { assignees: [{ login: "copilot-swe-agent[bot]" }] } };
      },
    },
  };
}

test("only human issue authors with write access are eligible", async () => {
  for (const permission of ["read", "triage", "none", "write", "admin"]) {
    const input = fixture();
    input.github.rest.repos.getCollaboratorPermissionLevel = async () => ({ data: { permission } });
    assert.equal(await authorize(input), ["write", "admin"].includes(permission));
  }
  const bot = fixture();
  bot.context.payload.issue.user.type = "Bot";
  assert.equal(await authorize(bot), false);
  const denied = fixture();
  denied.github.rest.repos.getCollaboratorPermissionLevel = async () => { throw new Error("API denied"); };
  await assert.rejects(authorize(denied), /API denied/);
});

test("assignment requests a linked PR without replacing existing assignees", async () => {
  const input = fixture();
  await assign(input);
  const request = input.calls.find(([kind]) => kind === "request");
  assert.equal(request[2].issue_number, 42);
  assert.deepEqual(request[2].assignees, ["copilot-swe-agent[bot]"]);
  assert.equal(request[2].agent_assignment.target_repo, "example/habits");
  assert.equal(request[2].agent_assignment.base_branch, "main");
  assert.match(request[2].agent_assignment.custom_instructions, /open a pull request linked to this issue/);
});

test("closed and already-assigned issues do not request another assignment", async () => {
  for (const issue of [
    { state: "closed", assignees: [] },
    { state: "open", assignees: [{ login: "copilot-swe-agent[bot]" }] },
  ]) {
    const input = fixture();
    input.github.rest.issues.get = async () => ({ data: issue });
    await assign(input);
    assert.equal(input.calls.some(([kind]) => kind === "request"), false);
  }
});

test("missing Copilot access, failed API requests, and unconfirmed assignments fail explicitly", async () => {
  const unavailable = fixture();
  unavailable.github.graphql = async () => ({ repository: { suggestedActors: { nodes: [] } } });
  await assert.rejects(assign(unavailable), /unavailable/);
  const denied = fixture();
  denied.github.request = async () => { throw new Error("Forbidden"); };
  await assert.rejects(assign(denied), /Forbidden/);
  const ignored = fixture();
  ignored.github.request = async () => ({ data: { assignees: [] } });
  await assert.rejects(assign(ignored), /did not assign/);
});
