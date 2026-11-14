import { WebApi } from 'azure-devops-node-api';
import { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import {
  AzureDevOpsError,
  AzureDevOpsResourceNotFoundError,
} from '../../../shared/errors';
import { GetPullRequestOptions } from '../types';
import {
  CompactPullRequest,
  projectPullRequest,
} from '../../../shared/utils/compact-pull-request';

export async function getPullRequest(
  connection: WebApi,
  options: GetPullRequestOptions,
): Promise<CompactPullRequest | GitPullRequest> {
  try {
    const gitApi = await connection.getGitApi();
    const project = options.projectId;

    const pr = await gitApi.getPullRequestById(options.pullRequestId, project);
    if (!pr) {
      throw new AzureDevOpsResourceNotFoundError(
        `Pull request not found: ${options.pullRequestId}`,
      );
    }

    return projectPullRequest(pr, options.includeDetails === true);
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      throw error;
    }
    throw new Error(
      `Failed to get pull request: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
