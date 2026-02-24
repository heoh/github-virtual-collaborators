import * as core from "@actions/core";
import { getContext } from "./context.js";
import { handleCheckRun } from "./handlers/check-run.js";
import { handleIssues } from "./handlers/issues.js";
import { handleIssueComment } from "./handlers/issue-comment.js";
import { handlePullRequest } from "./handlers/pull-request.js";

async function run(): Promise<void> {
  const ctx = getContext();
  switch (ctx.eventName) {
    case "check_run":
      await handleCheckRun();
      break;

    case "issues":
      await handleIssues();
      break;

    case "issue_comment":
      await handleIssueComment();
      break;

    case "pull_request":
      await handlePullRequest();
      break;

    default:
      core.warning(`Unsupported event: ${ctx.eventName}`);
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
