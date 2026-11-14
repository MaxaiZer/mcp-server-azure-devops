import { getWorkItemComments } from './feature';
import {
  AzureDevOpsError,
  AzureDevOpsResourceNotFoundError,
} from '../../../shared/errors';
import {
  CommentExpandOptions,
  CommentSortOrder,
} from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';

describe('getWorkItemComments unit', () => {
  test('should propagate custom errors when thrown internally', async () => {
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockImplementation(() => {
        throw new AzureDevOpsError('Custom error');
      }),
    };

    await expect(
      getWorkItemComments(mockConnection, { workItemId: 123 }),
    ).rejects.toThrow(AzureDevOpsError);
    await expect(
      getWorkItemComments(mockConnection, { workItemId: 123 }),
    ).rejects.toThrow('Custom error');
  });

  test('should wrap unexpected errors in a friendly error message', async () => {
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      }),
    };

    await expect(
      getWorkItemComments(mockConnection, { workItemId: 123 }),
    ).rejects.toThrow('Failed to get work item comments: Unexpected error');
  });

  test('should call getComments with correct parameters when projectId is provided', async () => {
    const mockGetComments = jest.fn().mockResolvedValue({ comments: [] });
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockResolvedValue({
        getComments: mockGetComments,
      }),
    };

    await getWorkItemComments(mockConnection, {
      workItemId: 123,
      projectId: 'myProject',
      top: 5,
      continuationToken: 'token123',
      includeDeleted: true,
      expand: 'reactions',
      order: 'desc',
    });

    expect(mockGetComments).toHaveBeenCalledWith(
      'myProject',
      123,
      5,
      'token123',
      true,
      CommentExpandOptions.Reactions,
      CommentSortOrder.Desc,
    );
  });

  test('should fetch work item to resolve project when projectId is not provided', async () => {
    const mockGetWorkItem = jest.fn().mockResolvedValue({
      fields: {
        'System.TeamProject': 'resolvedProject',
      },
    });
    const mockGetComments = jest.fn().mockResolvedValue({ comments: [] });
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockResolvedValue({
        getWorkItem: mockGetWorkItem,
        getComments: mockGetComments,
      }),
    };

    await getWorkItemComments(mockConnection, {
      workItemId: 123,
    });

    expect(mockGetWorkItem).toHaveBeenCalledWith(123, ['System.TeamProject']);
    expect(mockGetComments).toHaveBeenCalledWith(
      'resolvedProject',
      123,
      undefined,
      undefined,
      undefined,
      CommentExpandOptions.All,
      CommentSortOrder.Asc,
    );
  });

  test('should compact createdBy, modifiedBy and createdOnBehalfOf on comments', async () => {
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

    const mockGetComments = jest.fn().mockResolvedValue({
      totalCount: 1,
      count: 1,
      comments: [
        {
          id: 1,
          text: 'Comment text',
          createdBy: fullIdentity,
          modifiedBy: fullIdentity,
          createdOnBehalfOf: fullIdentity,
        },
      ],
    });

    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockResolvedValue({
        getComments: mockGetComments,
      }),
    };

    const result = await getWorkItemComments(mockConnection, {
      workItemId: 123,
      projectId: 'myProject',
    });

    const compactIdentity = {
      id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
      displayName: 'Maksim Strygin',
      uniqueName: 'RUSSIA\\StryginM',
    };

    expect(result.comments?.[0].createdBy).toEqual(compactIdentity);
    expect(result.comments?.[0].modifiedBy).toEqual(compactIdentity);
    expect(result.comments?.[0].createdOnBehalfOf).toEqual(compactIdentity);
    expect(result.comments?.[0].text).toBe('Comment text');
  });

  test('should map 404 project resolution errors to resource not found', async () => {
    const notFoundError = Object.assign(new Error('Not found'), {
      statusCode: 404,
    });
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockResolvedValue({
        getWorkItem: jest.fn().mockRejectedValue(notFoundError),
        getComments: jest.fn(),
      }),
    };

    await expect(
      getWorkItemComments(mockConnection, { workItemId: 123 }),
    ).rejects.toThrow(AzureDevOpsResourceNotFoundError);
  });

  test('should preserve non-404 project resolution errors', async () => {
    const forbiddenError = Object.assign(new Error('Forbidden'), {
      statusCode: 403,
    });
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockResolvedValue({
        getWorkItem: jest.fn().mockRejectedValue(forbiddenError),
        getComments: jest.fn(),
      }),
    };

    await expect(
      getWorkItemComments(mockConnection, { workItemId: 123 }),
    ).rejects.toThrow('Failed to get work item comments: Forbidden');
  });
});
