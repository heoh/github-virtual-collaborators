import * as core from "@actions/core";
import * as github from "@actions/github";
import { ProjectMetadataStore } from "./github/project-metadata-store.js";

export function getInputs() {
  const githubToken = core.getInput("github-token", { required: true });
  const projectOwner = core.getInput("project-owner", { required: true });
  const projectNumber = parseInt(
    core.getInput("project-number", { required: true }),
    10,
  );
  const tagsFieldName = core.getInput("tags-field-name", { required: true });
  const vcListRaw = core.getInput("virtual-collaborators", { required: false });

  const normalizedVCs = vcListRaw
    ? Array.from(
        new Set(
          vcListRaw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        ),
      )
    : [];

  const virtualCollaborators =
    normalizedVCs.length > 0 ? new Set(normalizedVCs) : undefined;

  return {
    githubToken,
    projectOwner,
    projectNumber,
    tagsFieldName,
    virtualCollaborators,
  };
}

export function getContext() {
  return github.context;
}

export function getOctokit() {
  const inputs = getInputs();
  return github.getOctokit(inputs.githubToken);
}
