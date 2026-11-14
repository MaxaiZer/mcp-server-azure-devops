import {
  toCompactIdentity,
  isIdentityLike,
  toCompactReviewer,
  projectPullRequest,
  compactWorkItemFields,
} from './compact-identity';

const fullIdentity = {
  displayName: 'Maksim Strygin',
  url: 'http://server/_apis/Identities/2268fe44-47a4-414f-985b-ad5e5539fb45',
  _links: {
    avatar: { href: 'http://server/_apis/GraphProfile/MemberAvatars/win.abc' },
  },
  id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
  uniqueName: 'RUSSIA\\StryginM',
  imageUrl:
    'http://server/_api/_common/identityImage?id=2268fe44-47a4-414f-985b-ad5e5539fb45',
  descriptor:
    'win.Uy0xLTUtMjEtMTAxMDk4NDEyOC0xMzMxODA0ODI2LTM4OTI1OTQ0ODQtNjU0MzE',
};

describe('toCompactIdentity', () => {
  test('keeps only id, displayName and uniqueName', () => {
    expect(toCompactIdentity(fullIdentity)).toEqual({
      id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
      displayName: 'Maksim Strygin',
      uniqueName: 'RUSSIA\\StryginM',
    });
  });

  test('keeps whichever of the three fields are present', () => {
    expect(toCompactIdentity({ displayName: 'User' })).toEqual({
      displayName: 'User',
    });
    expect(toCompactIdentity({ id: 'abc' })).toEqual({ id: 'abc' });
  });

  test('returns undefined for non-identity values', () => {
    expect(toCompactIdentity(undefined)).toBeUndefined();
    expect(toCompactIdentity(null)).toBeUndefined();
    expect(toCompactIdentity('RUSSIA\\StryginM')).toBeUndefined();
    expect(toCompactIdentity(['id'])).toBeUndefined();
    expect(
      toCompactIdentity({ url: 'http://server/_apis/Identities/x' }),
    ).toBeUndefined();
  });
});

describe('isIdentityLike', () => {
  test('requires displayName plus an id or uniqueName', () => {
    expect(isIdentityLike(fullIdentity)).toBe(true);
    expect(isIdentityLike({ displayName: 'User', id: 'abc' })).toBe(true);
    expect(
      isIdentityLike({ displayName: 'User', uniqueName: 'RUSSIA\\U' }),
    ).toBe(true);
  });

  test('rejects strings, arrays, null and custom JSON objects', () => {
    expect(isIdentityLike('RUSSIA\\StryginM')).toBe(false);
    expect(isIdentityLike(['a'])).toBe(false);
    expect(isIdentityLike(null)).toBe(false);
    expect(isIdentityLike({ displayName: 'User' })).toBe(false);
    expect(isIdentityLike({ displayName: 'User', id: 'abc', nested: {} })).toBe(
      true,
    );
    expect(isIdentityLike({ someName: 'x' })).toBe(false);
  });
});

describe('toCompactReviewer', () => {
  test('whitelists fields and drops url/_links/imageUrl/descriptor/reviewerUrl', () => {
    const reviewer = {
      ...fullIdentity,
      reviewerUrl: 'http://server/_apis/git/.../pullRequests/1/reviewers/abc',
      vote: 10,
      hasDeclined: false,
      isRequired: true,
      isFlagged: false,
      isReapprove: true,
      isContainer: false,
      votedFor: [
        {
          ...fullIdentity,
          reviewerUrl:
            'http://server/_apis/git/.../pullRequests/1/reviewers/def',
          vote: 0,
          isContainer: true,
        },
      ],
    };

    expect(toCompactReviewer(reviewer)).toEqual({
      id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
      displayName: 'Maksim Strygin',
      uniqueName: 'RUSSIA\\StryginM',
      vote: 10,
      hasDeclined: false,
      isRequired: true,
      isFlagged: false,
      isReapprove: true,
      isContainer: false,
      votedFor: [
        {
          id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
          displayName: 'Maksim Strygin',
          uniqueName: 'RUSSIA\\StryginM',
          vote: 0,
          isContainer: true,
        },
      ],
    });
  });

  test('keeps votedFor as an array of reviewers with vote on each entry', () => {
    const reviewer = {
      id: 'abc',
      displayName: 'Reviewer',
      vote: 10,
      votedFor: [
        { id: 'group-1', displayName: 'Group 1', vote: 5 },
        { id: 'group-2', displayName: 'Group 2', vote: 0 },
      ],
    };

    expect(toCompactReviewer(reviewer).votedFor).toEqual([
      { id: 'group-1', displayName: 'Group 1', vote: 5 },
      { id: 'group-2', displayName: 'Group 2', vote: 0 },
    ]);
  });

  test('omits undefined flags and identity', () => {
    expect(toCompactReviewer({ id: 'abc', vote: 10 })).toEqual({
      id: 'abc',
      vote: 10,
    });
  });
});

describe('projectPullRequest', () => {
  test('compacts createdBy, closedBy and reviewers, keeps the rest', () => {
    const pr = {
      pullRequestId: 1,
      title: 'PR 1',
      createdBy: fullIdentity,
      closedBy: fullIdentity,
      reviewers: [
        {
          ...fullIdentity,
          vote: 10,
          isRequired: true,
          reviewerUrl: 'http://x',
        },
      ],
      lastMergeCommit: {
        author: { name: 'Maksim Strygin', email: 'maksim@example.com' },
      },
    };

    expect(projectPullRequest(pr)).toEqual({
      pullRequestId: 1,
      title: 'PR 1',
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
        },
      ],
      lastMergeCommit: {
        author: { name: 'Maksim Strygin', email: 'maksim@example.com' },
      },
    });
  });

  test('does not add reviewers key when the PR has none', () => {
    const result = projectPullRequest({ pullRequestId: 2 } as never);
    expect(result).not.toHaveProperty('reviewers');
  });
});

describe('compactWorkItemFields', () => {
  test('compacts identity field values and leaves others untouched', () => {
    const workItem = {
      id: 123,
      fields: {
        'System.AssignedTo': fullIdentity,
        'System.CreatedBy': fullIdentity,
        'System.ChangedBy': { displayName: 'User', uniqueName: 'RUSSIA\\U' },
        'System.Title': 'Title',
        'System.State': 'New',
        'System.IterationId': 4179,
        'System.Tags': null,
        'Custom.Json': { displayName: 'Not an identity', other: 1 },
        'Custom.List': [{ displayName: 'X', id: 'y' }],
      },
    };

    expect(compactWorkItemFields(workItem)).toEqual({
      id: 123,
      fields: {
        'System.AssignedTo': {
          id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
          displayName: 'Maksim Strygin',
          uniqueName: 'RUSSIA\\StryginM',
        },
        'System.CreatedBy': {
          id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
          displayName: 'Maksim Strygin',
          uniqueName: 'RUSSIA\\StryginM',
        },
        'System.ChangedBy': {
          displayName: 'User',
          uniqueName: 'RUSSIA\\U',
        },
        'System.Title': 'Title',
        'System.State': 'New',
        'System.IterationId': 4179,
        'System.Tags': null,
        'Custom.Json': { displayName: 'Not an identity', other: 1 },
        'Custom.List': [{ displayName: 'X', id: 'y' }],
      },
    });
  });

  test('returns the work item as-is when it has no fields', () => {
    const workItem: { id: number; fields?: Record<string, any> } = { id: 123 };
    expect(compactWorkItemFields(workItem)).toBe(workItem);
  });
});
