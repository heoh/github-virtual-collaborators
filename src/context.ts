import * as core from "@actions/core";
import * as github from "@actions/github";

export type MetadataBackend = "project" | "label";

export function getInputs() {
  const githubToken = core.getInput("github-token", { required: true });
  const metadataBackend = (core.getInput("metadata-backend", {
    required: false,
  }) || "label") as MetadataBackend;

  const projectOwnerInput = core.getInput("project-owner", { required: false });
  const projectNumberInput = core.getInput("project-number", {
    required: false,
  });
  const tagsFieldNameInput = core.getInput("project-tags-field-name", {
    required: false,
  });
  const metadataLabelPrefix =
    core.getInput("label-prefix", { required: false }) || "vc:";
  const labelDefaultColor =
    core.getInput("label-default-color", { required: false }) || "b0b0b0";

  const projectOwner = projectOwnerInput || github.context.repo.owner;
  const projectNumber = projectNumberInput
    ? parseInt(projectNumberInput, 10)
    : undefined;
  const tagsFieldName = tagsFieldNameInput || "Tags";

  if (metadataBackend === "project") {
    if (!projectOwnerInput) {
      core.warning(
        "metadata-backend=project without project-owner input. Falling back to repository owner.",
      );
    }
    if (!projectNumberInput || Number.isNaN(projectNumber)) {
      throw new Error(
        "metadata-backend=project requires a valid 'project-number' input.",
      );
    }
    if (!tagsFieldNameInput) {
      core.warning(
        "metadata-backend=project without project-tags-field-name input. Falling back to 'Tags'.",
      );
    }
  }

  if (metadataBackend !== "project" && metadataBackend !== "label") {
    throw new Error(
      `Invalid metadata-backend '${metadataBackend}'. Expected 'project' or 'label'.`,
    );
  }

  if (!metadataLabelPrefix.includes(":")) {
    core.warning(
      "label-prefix should include ':' for readability (e.g., 'vc:').",
    );
  }

  if (!/^[0-9a-fA-F]{6}$/.test(labelDefaultColor)) {
    throw new Error(
      "label-default-color must be a 6-digit hex color without '#', e.g. '8a8a8a'.",
    );
  }

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
    metadataBackend,
    projectOwner,
    projectNumber,
    tagsFieldName,
    metadataLabelPrefix,
    labelDefaultColor: labelDefaultColor.toLowerCase(),
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
