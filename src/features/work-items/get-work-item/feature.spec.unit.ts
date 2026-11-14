import { getWorkItem } from './feature';
import { AzureDevOpsError } from '../../../shared/errors';

// Unit tests should only focus on isolated logic
// No real connections, HTTP requests, or dependencies
describe('getWorkItem unit', () => {
  // Unit test for error handling logic - the only part that's suitable for a unit test
  test('should propagate custom errors when thrown internally', async () => {
    // Arrange - for unit test, we mock only what's needed
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockImplementation(() => {
        throw new AzureDevOpsError('Custom error');
      }),
    };

    // Act & Assert
    await expect(getWorkItem(mockConnection, 123)).rejects.toThrow(
      AzureDevOpsError,
    );
    await expect(getWorkItem(mockConnection, 123)).rejects.toThrow(
      'Custom error',
    );
  });

  test('should wrap unexpected errors in a friendly error message', async () => {
    // Arrange
    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      }),
    };

    // Act & Assert
    await expect(getWorkItem(mockConnection, 123)).rejects.toThrow(
      'Failed to get work item: Unexpected error',
    );
  });

  test('should compact identity objects in fields and leave other values untouched', async () => {
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

    const mockGetWorkItem = jest.fn().mockResolvedValue({
      id: 123,
      rev: 1,
      fields: {
        'System.TeamProject': 'vNext',
        'System.WorkItemType': 'Task',
        'System.Title': 'Test title',
        'System.State': 'New',
        'System.AssignedTo': fullIdentity,
        'System.CreatedBy': fullIdentity,
        'System.ChangedBy': fullIdentity,
        'Custom.Json': { displayName: 'not an identity', other: 1 },
      },
    });

    const mockConnection: any = {
      getWorkItemTrackingApi: jest.fn().mockResolvedValue({
        getWorkItem: mockGetWorkItem,
        getWorkItemTypeFieldsWithReferences: jest.fn().mockResolvedValue([]),
      }),
    };

    const result = await getWorkItem(mockConnection, 123);

    expect(result.fields?.['System.AssignedTo']).toEqual({
      id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
      displayName: 'Maksim Strygin',
      uniqueName: 'RUSSIA\\StryginM',
    });
    expect(result.fields?.['System.CreatedBy']).toEqual(
      result.fields?.['System.AssignedTo'],
    );
    expect(result.fields?.['System.ChangedBy']).toEqual(
      result.fields?.['System.AssignedTo'],
    );
    expect(result.fields?.['System.Title']).toBe('Test title');
    expect(result.fields?.['System.State']).toBe('New');
    expect(result.fields?.['Custom.Json']).toEqual({
      displayName: 'not an identity',
      other: 1,
    });
  });
});
