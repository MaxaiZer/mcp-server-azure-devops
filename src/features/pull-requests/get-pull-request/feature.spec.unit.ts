import { WebApi } from 'azure-devops-node-api';
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

  test('should compact identity fields in createdBy, closedBy and reviewers', async () => {
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
    };

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

    expect(result.createdBy).toEqual({
      id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
      displayName: 'Maksim Strygin',
      uniqueName: 'RUSSIA\\StryginM',
    });
    expect(result.closedBy).toEqual(result.createdBy);
    expect(result.reviewers).toEqual([
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
    ]);
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
