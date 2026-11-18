import { WebApi } from 'azure-devops-node-api';
import {
  CommentExpandOptions,
  CommentList,
  CommentSortOrder,
} from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import {
  AzureDevOpsResourceNotFoundError,
  AzureDevOpsError,
} from '../../../shared/errors';
import { GetWorkItemCommentsOptions, WorkItemCommentsResult } from '../types';
import { toCompactIdentity } from '../../../shared/utils/compact-identity';

/**
 * Maps string-based expansion options to the CommentExpandOptions enum
 */
const expandMap: Record<string, CommentExpandOptions> = {
  none: CommentExpandOptions.None,
  reactions: CommentExpandOptions.Reactions,
  renderedtext: CommentExpandOptions.RenderedText,
  all: CommentExpandOptions.All,
};

/**
 * Maps string-based sort order options to the CommentSortOrder enum
 */
const orderMap: Record<string, CommentSortOrder> = {
  asc: CommentSortOrder.Asc,
  desc: CommentSortOrder.Desc,
};

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorObj = error as {
    statusCode?: number;
    response?: { status?: number };
  };

  return errorObj.statusCode === 404 || errorObj.response?.status === 404;
}

/**
 * Get comments for a work item
 *
 * Work items are addressed collection-wide, while the comments endpoint also
 * requires the project that owns the work item. A project id that does not own
 * the work item makes that endpoint return 404 (surfaced as a null result by
 * the Azure DevOps client), which is indistinguishable from "no comments" and
 * hides the real cause. To keep that information, a failing request with an
 * explicit project id is retried once against the project the work item
 * actually belongs to, and the fallback is reported back as a warning.
 *
 * @param connection The Azure DevOps WebApi connection
 * @param options Options for getting work item comments
 * @returns The list of work item comments
 */
export async function getWorkItemComments(
  connection: WebApi,
  options: GetWorkItemCommentsOptions,
): Promise<WorkItemCommentsResult> {
  try {
    const witApi = await connection.getWorkItemTrackingApi();
    const {
      workItemId,
      projectId,
      top,
      continuationToken,
      includeDeleted,
      expand = 'all',
      order = 'asc',
    } = options;

    const expandVal =
      expandMap[expand.toLowerCase()] ?? CommentExpandOptions.All;
    const orderVal = orderMap[order.toLowerCase()] ?? CommentSortOrder.Asc;

    const fetchComments = async (
      project: string,
    ): Promise<CommentList | null> =>
      (await witApi.getComments(
        project,
        workItemId,
        top,
        continuationToken,
        includeDeleted,
        expandVal,
        orderVal,
      )) as CommentList | null;

    const resolveOwnerProject = async (): Promise<string> => {
      try {
        const workItem = await witApi.getWorkItem(workItemId, [
          'System.TeamProject',
        ]);
        const project = workItem?.fields?.['System.TeamProject'];
        if (!project) {
          throw new AzureDevOpsResourceNotFoundError(
            `Work item '${workItemId}' not found`,
          );
        }
        return String(project);
      } catch (error) {
        if (error instanceof AzureDevOpsError) {
          throw error;
        }
        if (isNotFoundError(error)) {
          throw new AzureDevOpsResourceNotFoundError(
            `Work item '${workItemId}' not found`,
            { cause: error },
          );
        }
        throw error;
      }
    };

    const warnings: string[] = [];
    let commentList: CommentList | null;
    let usedProjectId: string;

    if (!projectId) {
      usedProjectId = await resolveOwnerProject();
      commentList = await fetchComments(usedProjectId);
      if (!commentList) {
        throw new AzureDevOpsResourceNotFoundError(
          `Comments for work item '${workItemId}' in project '${usedProjectId}' not found`,
        );
      }
    } else {
      usedProjectId = projectId;
      commentList = await fetchComments(usedProjectId);

      if (!commentList) {
        const ownerProjectId = await resolveOwnerProject();

        if (ownerProjectId.toLowerCase() === usedProjectId.toLowerCase()) {
          throw new AzureDevOpsResourceNotFoundError(
            `Comments for work item '${workItemId}' in project '${usedProjectId}' not found`,
          );
        }

        commentList = await fetchComments(ownerProjectId);
        if (!commentList) {
          throw new AzureDevOpsResourceNotFoundError(
            `Comments for work item '${workItemId}' not found in project '${usedProjectId}' nor in project '${ownerProjectId}' (owner of the work item)`,
          );
        }

        warnings.push(
          `projectId '${usedProjectId}' does not contain work item '${workItemId}'; comments were read from project '${ownerProjectId}'`,
        );
      }
    }

    return {
      ...commentList,
      comments: commentList.comments?.map((comment) => {
        const createdBy = toCompactIdentity(comment.createdBy);
        const modifiedBy = toCompactIdentity(comment.modifiedBy);
        const createdOnBehalfOf = toCompactIdentity(comment.createdOnBehalfOf);

        return {
          ...comment,
          ...(createdBy ? { createdBy } : {}),
          ...(modifiedBy ? { modifiedBy } : {}),
          ...(createdOnBehalfOf ? { createdOnBehalfOf } : {}),
        };
      }),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      throw error;
    }
    throw new AzureDevOpsError(
      `Failed to get work item comments: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
