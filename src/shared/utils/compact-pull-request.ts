import {
  GitCommitRef,
  GitForkRef,
  GitPullRequest,
  GitPullRequestCompletionOptions,
  GitPullRequestMergeOptions,
  GitPullRequestMergeStrategy,
  GitRepository,
  PullRequestAsyncStatus,
  PullRequestMergeFailureType,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import {
  CompactIdentity,
  CompactReviewer,
  toCompactIdentity,
  toCompactReviewer,
} from './compact-identity';

export type CompactRepository = {
  id?: string;
  name?: string;
  project?: {
    id?: string;
    name?: string;
  };
};

export type CompactCommitRef = {
  commitId?: string;
};

export type CompactWorkItemRef = {
  id?: string;
};

export type CompactLabel = {
  id?: string;
  name?: string;
  active?: boolean;
};

export type CompactCompletionOptions = {
  autoCompleteIgnoreConfigIds?: number[];
  bypassPolicy?: boolean;
  bypassReason?: string;
  deleteSourceBranch?: boolean;
  mergeCommitMessage?: string;
  mergeStrategy?: GitPullRequestMergeStrategy;
  squashMerge?: boolean;
  transitionWorkItems?: boolean;
  triggeredByAutoComplete?: boolean;
};

export type CompactMergeOptions = {
  conflictAuthorshipCommits?: boolean;
  detectRenameFalsePositives?: boolean;
  disableRenames?: boolean;
};

export type CompactForkSource = {
  name?: string;
  objectId?: string;
  repository?: CompactRepository;
};

/**
 * Compact pull request projection: whitelist of fields LLM consumers need.
 * Azure DevOps pull requests carry url, _links, remoteUrl, the full
 * repository object, full identity objects, commits and merge bookkeeping
 * that bloat tool responses without helping the agent act on the PR.
 */
export type CompactPullRequest = {
  pullRequestId?: number;
  codeReviewId?: number;
  status?: PullRequestStatus;
  isDraft?: boolean;
  title?: string;
  description?: string;
  sourceRefName?: string;
  targetRefName?: string;
  mergeStatus?: PullRequestAsyncStatus;
  mergeFailureMessage?: string;
  mergeFailureType?: PullRequestMergeFailureType;
  creationDate?: Date;
  closedDate?: Date;

  createdBy?: CompactIdentity;
  closedBy?: CompactIdentity;
  autoCompleteSetBy?: CompactIdentity;

  repository?: CompactRepository;

  reviewers?: CompactReviewer[];

  lastMergeSourceCommit?: CompactCommitRef;
  lastMergeTargetCommit?: CompactCommitRef;
  lastMergeCommit?: CompactCommitRef;

  workItemRefs?: CompactWorkItemRef[];
  labels?: CompactLabel[];

  supportsIterations?: boolean;
  artifactId?: string;

  forkSource?: CompactForkSource;
  completionOptions?: CompactCompletionOptions;
  mergeOptions?: CompactMergeOptions;

  webUrl?: string;
};

function toCompactRepository(
  repository?: GitRepository,
): CompactRepository | undefined {
  if (!repository) {
    return undefined;
  }

  const project: { id?: string; name?: string } = {
    ...(typeof repository.project?.id === 'string'
      ? { id: repository.project.id }
      : {}),
    ...(typeof repository.project?.name === 'string'
      ? { name: repository.project.name }
      : {}),
  };

  const compact: CompactRepository = {
    ...(typeof repository.id === 'string' ? { id: repository.id } : {}),
    ...(typeof repository.name === 'string' ? { name: repository.name } : {}),
    ...(project.id || project.name ? { project } : {}),
  };

  return compact.id || compact.name || project.id || project.name
    ? compact
    : undefined;
}

function toCompactCommitRef(
  commit?: GitCommitRef,
): CompactCommitRef | undefined {
  if (!commit || typeof commit.commitId !== 'string') {
    return undefined;
  }

  return { commitId: commit.commitId };
}

function toCompactCompletionOptions(
  options?: GitPullRequestCompletionOptions,
  description?: string,
): CompactCompletionOptions | undefined {
  if (!options) {
    return undefined;
  }

  const compact: CompactCompletionOptions = {
    ...(options.autoCompleteIgnoreConfigIds &&
    options.autoCompleteIgnoreConfigIds.length > 0
      ? { autoCompleteIgnoreConfigIds: options.autoCompleteIgnoreConfigIds }
      : {}),
    ...(typeof options.bypassPolicy === 'boolean'
      ? { bypassPolicy: options.bypassPolicy }
      : {}),
    ...(options.bypassReason ? { bypassReason: options.bypassReason } : {}),
    ...(typeof options.deleteSourceBranch === 'boolean'
      ? { deleteSourceBranch: options.deleteSourceBranch }
      : {}),
    // The API defaults mergeCommitMessage to the PR description; skip it
    // when it is a duplicate.
    ...(options.mergeCommitMessage && options.mergeCommitMessage !== description
      ? { mergeCommitMessage: options.mergeCommitMessage }
      : {}),
    ...(options.mergeStrategy != null
      ? { mergeStrategy: options.mergeStrategy }
      : {}),
    ...(typeof options.squashMerge === 'boolean'
      ? { squashMerge: options.squashMerge }
      : {}),
    ...(typeof options.transitionWorkItems === 'boolean'
      ? { transitionWorkItems: options.transitionWorkItems }
      : {}),
    ...(typeof options.triggeredByAutoComplete === 'boolean'
      ? { triggeredByAutoComplete: options.triggeredByAutoComplete }
      : {}),
  };

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function toCompactMergeOptions(
  options?: GitPullRequestMergeOptions,
): CompactMergeOptions | undefined {
  if (!options) {
    return undefined;
  }

  const compact: CompactMergeOptions = {
    ...(typeof options.conflictAuthorshipCommits === 'boolean'
      ? { conflictAuthorshipCommits: options.conflictAuthorshipCommits }
      : {}),
    ...(typeof options.detectRenameFalsePositives === 'boolean'
      ? { detectRenameFalsePositives: options.detectRenameFalsePositives }
      : {}),
    ...(typeof options.disableRenames === 'boolean'
      ? { disableRenames: options.disableRenames }
      : {}),
  };

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function toCompactForkSource(fork?: GitForkRef): CompactForkSource | undefined {
  if (!fork) {
    return undefined;
  }

  const repository = toCompactRepository(fork.repository);

  const compact: CompactForkSource = {
    ...(typeof fork.name === 'string' ? { name: fork.name } : {}),
    ...(typeof fork.objectId === 'string' ? { objectId: fork.objectId } : {}),
    ...(repository ? { repository } : {}),
  };

  return Object.keys(compact).length > 0 ? compact : undefined;
}

/**
 * Project a pull request to the compact shape by default.
 * With includeDetails the original raw object is returned unchanged
 * (no copy, no compaction) as an escape hatch.
 */
export function projectPullRequest(
  pr: GitPullRequest,
  includeDetails = false,
): CompactPullRequest | GitPullRequest {
  if (includeDetails) {
    return pr;
  }

  const createdBy = toCompactIdentity(pr.createdBy);
  const closedBy = toCompactIdentity(pr.closedBy);
  const autoCompleteSetBy = toCompactIdentity(pr.autoCompleteSetBy);
  const repository = toCompactRepository(pr.repository);
  const lastMergeSourceCommit = toCompactCommitRef(pr.lastMergeSourceCommit);
  const lastMergeTargetCommit = toCompactCommitRef(pr.lastMergeTargetCommit);
  const lastMergeCommit = toCompactCommitRef(pr.lastMergeCommit);
  const workItemRefs = pr.workItemRefs
    ?.filter((ref) => typeof ref.id === 'string')
    .map((ref) => ({ id: ref.id }));
  const labels = pr.labels
    ?.map(
      (label): CompactLabel => ({
        ...(typeof label.id === 'string' ? { id: label.id } : {}),
        ...(typeof label.name === 'string' ? { name: label.name } : {}),
        ...(typeof label.active === 'boolean' ? { active: label.active } : {}),
      }),
    )
    .filter((label) => Object.keys(label).length > 0);
  const forkSource = toCompactForkSource(pr.forkSource);
  const completionOptions = toCompactCompletionOptions(
    pr.completionOptions,
    pr.description,
  );
  const mergeOptions = toCompactMergeOptions(pr.mergeOptions);
  const webUrl =
    typeof pr._links?.web?.href === 'string' ? pr._links.web.href : undefined;

  return {
    ...(typeof pr.pullRequestId === 'number'
      ? { pullRequestId: pr.pullRequestId }
      : {}),
    ...(typeof pr.codeReviewId === 'number'
      ? { codeReviewId: pr.codeReviewId }
      : {}),
    ...(pr.status != null ? { status: pr.status } : {}),
    ...(typeof pr.isDraft === 'boolean' ? { isDraft: pr.isDraft } : {}),
    ...(pr.title != null ? { title: pr.title } : {}),
    ...(pr.description != null ? { description: pr.description } : {}),
    ...(pr.sourceRefName != null ? { sourceRefName: pr.sourceRefName } : {}),
    ...(pr.targetRefName != null ? { targetRefName: pr.targetRefName } : {}),
    ...(pr.mergeStatus != null ? { mergeStatus: pr.mergeStatus } : {}),
    ...(pr.mergeFailureMessage != null
      ? { mergeFailureMessage: pr.mergeFailureMessage }
      : {}),
    ...(pr.mergeFailureType != null
      ? { mergeFailureType: pr.mergeFailureType }
      : {}),
    ...(pr.creationDate != null ? { creationDate: pr.creationDate } : {}),
    ...(pr.closedDate != null ? { closedDate: pr.closedDate } : {}),
    ...(createdBy ? { createdBy } : {}),
    ...(closedBy ? { closedBy } : {}),
    ...(autoCompleteSetBy ? { autoCompleteSetBy } : {}),
    ...(repository ? { repository } : {}),
    ...(pr.reviewers && pr.reviewers.length > 0
      ? { reviewers: pr.reviewers.map(toCompactReviewer) }
      : {}),
    ...(lastMergeSourceCommit ? { lastMergeSourceCommit } : {}),
    ...(lastMergeTargetCommit ? { lastMergeTargetCommit } : {}),
    ...(lastMergeCommit ? { lastMergeCommit } : {}),
    ...(workItemRefs && workItemRefs.length > 0 ? { workItemRefs } : {}),
    ...(labels && labels.length > 0 ? { labels } : {}),
    ...(typeof pr.supportsIterations === 'boolean'
      ? { supportsIterations: pr.supportsIterations }
      : {}),
    ...(pr.artifactId != null ? { artifactId: pr.artifactId } : {}),
    ...(forkSource ? { forkSource } : {}),
    ...(completionOptions ? { completionOptions } : {}),
    ...(mergeOptions ? { mergeOptions } : {}),
    ...(webUrl != null ? { webUrl } : {}),
  };
}
