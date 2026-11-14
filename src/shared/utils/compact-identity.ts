import {
  GitPullRequest,
  IdentityRefWithVote,
} from 'azure-devops-node-api/interfaces/GitInterfaces';

/**
 * Reduced identity shape: only the fields consumers need
 * (UUID for filters, human-readable name, account name).
 * Azure DevOps identity objects carry url, _links, imageUrl, descriptor
 * and other fields that bloat tool responses.
 */
export type CompactIdentity = {
  id?: string;
  displayName?: string;
  uniqueName?: string;
};

export type CompactReviewer = {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  vote?: number;
  isRequired?: boolean;
  hasDeclined?: boolean;
  isFlagged?: boolean;
  isReapprove?: boolean;
  isContainer?: boolean;
  votedFor?: CompactReviewer[];
};

export type ProjectedPullRequest = Omit<
  GitPullRequest,
  'createdBy' | 'closedBy' | 'reviewers'
> & {
  createdBy?: CompactIdentity;
  closedBy?: CompactIdentity;
  reviewers?: CompactReviewer[];
};

function pickString(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reduce an identity object to its compact shape.
 * Returns undefined for non-identity values so callers can drop
 * the field entirely instead of writing an empty object.
 */
export function toCompactIdentity(value: unknown): CompactIdentity | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const id = pickString(source, 'id');
  const displayName = pickString(source, 'displayName');
  const uniqueName = pickString(source, 'uniqueName');

  if (!id && !displayName && !uniqueName) {
    return undefined;
  }

  return {
    ...(id ? { id } : {}),
    ...(displayName ? { displayName } : {}),
    ...(uniqueName ? { uniqueName } : {}),
  };
}

/**
 * Stricter identity test used for work item field values: an object must
 * have a displayName plus an id or uniqueName, otherwise it may be a
 * custom JSON field and must be left untouched.
 */
export function isIdentityLike(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    typeof source.displayName === 'string' &&
    (typeof source.id === 'string' || typeof source.uniqueName === 'string')
  );
}

/**
 * Reduce a PR reviewer to a whitelist of fields.
 * vote stays on the reviewer itself; votedFor keeps its array of
 * rollup votes (each with its own vote), only the identity fields
 * inside are compacted.
 */
export function toCompactReviewer(
  reviewer: IdentityRefWithVote,
): CompactReviewer {
  const identity = toCompactIdentity(reviewer) ?? {};

  return {
    ...identity,
    ...(typeof reviewer.vote === 'number' ? { vote: reviewer.vote } : {}),
    ...(typeof reviewer.isRequired === 'boolean'
      ? { isRequired: reviewer.isRequired }
      : {}),
    ...(typeof reviewer.hasDeclined === 'boolean'
      ? { hasDeclined: reviewer.hasDeclined }
      : {}),
    ...(typeof reviewer.isFlagged === 'boolean'
      ? { isFlagged: reviewer.isFlagged }
      : {}),
    ...(typeof reviewer.isReapprove === 'boolean'
      ? { isReapprove: reviewer.isReapprove }
      : {}),
    ...(typeof reviewer.isContainer === 'boolean'
      ? { isContainer: reviewer.isContainer }
      : {}),
    ...(reviewer.votedFor
      ? { votedFor: reviewer.votedFor.map(toCompactReviewer) }
      : {}),
  };
}

/**
 * Project a pull request to the compact shape: createdBy, closedBy and
 * reviewers lose url/_links/imageUrl/descriptor/reviewerUrl, everything
 * else is preserved as-is.
 */
export function projectPullRequest(pr: GitPullRequest): ProjectedPullRequest {
  const createdBy = toCompactIdentity(pr.createdBy);
  const closedBy = toCompactIdentity(pr.closedBy);

  return {
    ...pr,
    ...(createdBy ? { createdBy } : {}),
    ...(closedBy ? { closedBy } : {}),
    ...(pr.reviewers ? { reviewers: pr.reviewers.map(toCompactReviewer) } : {}),
  };
}

/**
 * Replace identity objects inside a work item's fields map with their
 * compact shape. String values (cloud-style identity fields), arrays
 * and non-identity objects are left untouched.
 */
export function compactWorkItemFields<
  T extends { fields?: Record<string, unknown> },
>(workItem: T): T {
  if (!workItem || !workItem.fields) {
    return workItem;
  }

  const fields: Record<string, unknown> = { ...workItem.fields };
  for (const key of Object.keys(fields)) {
    if (isIdentityLike(fields[key])) {
      fields[key] = toCompactIdentity(fields[key]);
    }
  }

  return { ...workItem, fields };
}
