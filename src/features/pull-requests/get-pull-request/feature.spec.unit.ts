import { WebApi } from 'azure-devops-node-api';
import { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { getPullRequest } from './feature';
import { AzureDevOpsResourceNotFoundError } from '../../../shared/errors';

describe('getPullRequest', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return pull request by id', async () => {
    const mockPullRequest = { pullRequestId: 42, title: 'PR 42' };

    const mockGitApi = {
      getPullRequestById: jest.fn().mockResolvedValue(mockPullRequest),
    };

    const mockConnection: any = {
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    };

    const result = await getPullRequest(mockConnection as WebApi, {
      projectId: 'test-project',
      pullRequestId: 42,
    });

    expect(result).toEqual(mockPullRequest);
    expect(mockGitApi.getPullRequestById).toHaveBeenCalledWith(
      42,
      'test-project',
    );
  });

  test('should return the compact projection by default', async () => {
    const fullIdentity = {
      displayName: 'Maksim Strygin',
      url: 'http://server/_apis/Identities/2268fe44-47a4-414f-985b-ad5e5539fb45',
      _links: {
        avatar: {
          href: 'http://server/_apis/GraphProfile/MemberAvatars/win.abc',
        },
      },
      id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
      uniqueName: 'RUSSIA\\StryginM',
      imageUrl: 'http://server/_api/_common/identityImage?id=2268fe44',
      descriptor: 'win.abc',
    };

    const mockPullRequest = {
      pullRequestId: 42,
      title: 'PR 42',
      url: 'http://server/_apis/git/repositories/Repo1/pullRequests/42',
      _links: {
        web: {
          href: 'http://server/DefaultCollection/_git/Repo1/pullrequest/42',
        },
      },
      repository: {
        id: 'repo-1',
        name: 'Repo1',
        url: 'http://server/_apis/git/repositories/Repo1',
        defaultBranch: 'refs/heads/main',
        project: { id: 'project-1', name: 'DefaultProject' },
      },
      commits: [{ commitId: 'aaa111' }],
      createdBy: fullIdentity,
      closedBy: fullIdentity,
      reviewers: [
        {
          ...fullIdentity,
          reviewerUrl: 'http://server/_apis/git/.../reviewers/2268fe44',
          vote: 10,
          isRequired: true,
          votedFor: [{ ...fullIdentity, vote: 0, isContainer: true }],
        },
      ],
      lastMergeCommit: {
        commitId: 'bbb222',
        author: { name: 'Maksim Strygin', email: 'maksim@example.com' },
      },
      workItemRefs: [
        { id: '123', url: 'http://server/_apis/wit/workItems/123' },
      ],
    } as GitPullRequest;

    const mockGitApi = {
      getPullRequestById: jest.fn().mockResolvedValue(mockPullRequest),
    };

    const mockConnection: any = {
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    };

    const result = await getPullRequest(mockConnection as WebApi, {
      projectId: 'test-project',
      pullRequestId: 42,
    });

    expect(result).not.toHaveProperty('_links');
    expect(result).not.toHaveProperty('url');
    expect(result).not.toHaveProperty('commits');
    expect(result).toEqual({
      pullRequestId: 42,
      title: 'PR 42',
      repository: {
        id: 'repo-1',
        name: 'Repo1',
        project: { id: 'project-1', name: 'DefaultProject' },
      },
      createdBy: {
        id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
        displayName: 'Maksim Strygin',
        uniqueName: 'RUSSIA\\StryginM',
      },
      closedBy: {
        id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
        displayName: 'Maksim Strygin',
        uniqueName: 'RUSSIA\\StryginM',
      },
      reviewers: [
        {
          id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
          displayName: 'Maksim Strygin',
          uniqueName: 'RUSSIA\\StryginM',
          vote: 10,
          isRequired: true,
          votedFor: [
            {
              id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
              displayName: 'Maksim Strygin',
              uniqueName: 'RUSSIA\\StryginM',
              vote: 0,
              isContainer: true,
            },
          ],
        },
      ],
      lastMergeCommit: { commitId: 'bbb222' },
      workItemRefs: [{ id: '123' }],
      webUrl: 'http://server/DefaultCollection/_git/Repo1/pullrequest/42',
    });
  });

  test('should return the raw pull request when includeDetails is true', async () => {
    const mockPullRequest = {
      pullRequestId: 42,
      title: 'PR 42',
      url: 'http://server/_apis/git/repositories/Repo1/pullRequests/42',
      _links: {
        web: {
          href: 'http://server/DefaultCollection/_git/Repo1/pullrequest/42',
        },
      },
      repository: {
        id: 'repo-1',
        name: 'Repo1',
        url: 'http://server/_apis/git/repositories/Repo1',
        defaultBranch: 'refs/heads/main',
        project: { id: 'project-1', name: 'DefaultProject' },
      },
      commits: [{ commitId: 'aaa111' }],
    } as GitPullRequest;

    const mockGitApi = {
      getPullRequestById: jest.fn().mockResolvedValue(mockPullRequest),
    };

    const mockConnection: any = {
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    };

    const result = (await getPullRequest(mockConnection as WebApi, {
      projectId: 'test-project',
      pullRequestId: 42,
      includeDetails: true,
    })) as GitPullRequest;

    expect(result).toBe(mockPullRequest);
    expect(result.url).toBe(
      'http://server/_apis/git/repositories/Repo1/pullRequests/42',
    );
    expect(result.repository).toHaveProperty('url');
    expect(result.repository).toHaveProperty('defaultBranch');
    expect(result.commits).toEqual([{ commitId: 'aaa111' }]);
  });

  test('should throw resource not found error when pull request is not found', async () => {
    const mockGitApi = {
      getPullRequestById: jest.fn().mockResolvedValue(undefined),
    };

    const mockConnection: any = {
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    };

    await expect(
      getPullRequest(mockConnection as WebApi, {
        projectId: 'test-project',
        pullRequestId: 42,
      }),
    ).rejects.toBeInstanceOf(AzureDevOpsResourceNotFoundError);
  });
});
