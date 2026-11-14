import {
  GitPullRequest,
  PullRequestStatus,
  PullRequestAsyncStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { projectPullRequest } from './compact-pull-request';

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

const compactIdentity = {
  id: '2268fe44-47a4-414f-985b-ad5e5539fb45',
  displayName: 'Maksim Strygin',
  uniqueName: 'RUSSIA\\StryginM',
};

function makeFullPullRequest() {
  return {
    pullRequestId: 42,
    codeReviewId: 42,
    status: PullRequestStatus.Active,
    isDraft: false,
    title: 'Fix login',
    description: 'Fix the login flow',
    sourceRefName: 'refs/heads/fix-login',
    targetRefName: 'refs/heads/main',
    mergeStatus: PullRequestAsyncStatus.Succeeded,
    creationDate: '2026-07-10T09:00:00.000Z',
    createdBy: fullIdentity,
    closedBy: fullIdentity,
    autoCompleteSetBy: fullIdentity,
    url: 'http://server/_apis/git/repositories/Repo1/pullRequests/42',
    remoteUrl:
      'https://server/tfs/DefaultCollection/_apis/git/Repo1/pullRequests/42',
    _links: {
      web: {
        href: 'http://server/DefaultCollection/_git/Repo1/pullrequest/42',
      },
      self: {
        href: 'http://server/_apis/git/repositories/Repo1/pullRequests/42',
      },
    },
    repository: {
      id: 'repo-1',
      name: 'Repo1',
      url: 'http://server/_apis/git/repositories/Repo1',
      remoteUrl:
        'https://server/tfs/DefaultCollection/DefaultProject/_git/Repo1',
      sshUrl: 'git@server:DefaultCollection/DefaultProject/Repo1',
      defaultBranch: 'refs/heads/main',
      size: 1024,
      project: { id: 'project-1', name: 'DefaultProject' },
      _links: { self: { href: 'http://server/_apis/git/repositories/Repo1' } },
    },
    commits: [
      { commitId: 'aaa111', author: { name: 'A', email: 'a@example.com' } },
    ],
    reviewers: [
      {
        ...fullIdentity,
        reviewerUrl: 'http://server/_apis/git/.../reviewers/2268fe44',
        vote: 10,
        isRequired: true,
        votedFor: [{ ...fullIdentity, vote: 0, isContainer: true }],
      },
    ],
    lastMergeSourceCommit: {
      commitId: 'bbb222',
      author: { name: 'A', email: 'a@example.com' },
      url: 'http://server/_apis/git/repositories/Repo1/commits/bbb222',
    },
    lastMergeTargetCommit: {
      commitId: 'ccc333',
      url: 'http://server/_apis/git/repositories/Repo1/commits/ccc333',
    },
    lastMergeCommit: {
      commitId: 'ddd444',
      url: 'http://server/_apis/git/repositories/Repo1/commits/ddd444',
    },
    workItemRefs: [
      { id: '123', url: 'http://server/_apis/wit/workItems/123' },
      { id: '456', url: 'http://server/_apis/wit/workItems/456' },
    ],
    labels: [
      {
        id: 'label-1',
        name: 'bug',
        active: true,
        url: 'http://server/_apis/tags/label-1',
      },
    ],
    supportsIterations: true,
    artifactId: 'vstfs:///Git/PullRequestId/project-1/repo-1/42',
    mergeId: 'job-1',
    completionQueueTime: '2026-07-10T09:05:00.000Z',
    hasMultipleMergeBases: false,
    completionOptions: {
      deleteSourceBranch: false,
      mergeStrategy: 1,
      transitionWorkItems: true,
      mergeCommitMessage: 'Fix the login flow',
    },
    mergeOptions: { disableRenames: true },
  } as never;
}

describe('projectPullRequest', () => {
  test('returns the compact projection by default', () => {
    const pr = makeFullPullRequest();
    const result = projectPullRequest(pr);

    expect(result).not.toHaveProperty('_links');
    expect(result).not.toHaveProperty('url');
    expect(result).not.toHaveProperty('remoteUrl');
    expect(result).not.toHaveProperty('commits');
    expect(result).not.toHaveProperty('mergeId');
    expect(result).not.toHaveProperty('completionQueueTime');
    expect(result).not.toHaveProperty('hasMultipleMergeBases');

    expect(result).toEqual({
      pullRequestId: 42,
      codeReviewId: 42,
      status: PullRequestStatus.Active,
      isDraft: false,
      title: 'Fix login',
      description: 'Fix the login flow',
      sourceRefName: 'refs/heads/fix-login',
      targetRefName: 'refs/heads/main',
      mergeStatus: PullRequestAsyncStatus.Succeeded,
      creationDate: '2026-07-10T09:00:00.000Z',
      createdBy: compactIdentity,
      closedBy: compactIdentity,
      autoCompleteSetBy: compactIdentity,
      repository: {
        id: 'repo-1',
        name: 'Repo1',
        project: { id: 'project-1', name: 'DefaultProject' },
      },
      reviewers: [
        {
          ...compactIdentity,
          vote: 10,
          isRequired: true,
          votedFor: [{ ...compactIdentity, vote: 0, isContainer: true }],
        },
      ],
      lastMergeSourceCommit: { commitId: 'bbb222' },
      lastMergeTargetCommit: { commitId: 'ccc333' },
      lastMergeCommit: { commitId: 'ddd444' },
      workItemRefs: [{ id: '123' }, { id: '456' }],
      labels: [{ id: 'label-1', name: 'bug', active: true }],
      supportsIterations: true,
      artifactId: 'vstfs:///Git/PullRequestId/project-1/repo-1/42',
      completionOptions: {
        deleteSourceBranch: false,
        mergeStrategy: 1,
        transitionWorkItems: true,
      },
      mergeOptions: { disableRenames: true },
      webUrl: 'http://server/DefaultCollection/_git/Repo1/pullrequest/42',
    });
  });

  test('returns the same raw object when includeDetails is true', () => {
    const pr = makeFullPullRequest();
    const result = projectPullRequest(pr, true) as GitPullRequest;

    expect(result).toBe(pr);
    expect(result).toHaveProperty('_links');
    expect(result).toHaveProperty('url');
    expect(result.repository).toHaveProperty('url');
    expect(result.repository).toHaveProperty('project');
    expect(result.repository?.project).toHaveProperty('id');
    expect(result).toHaveProperty('commits');
  });

  test('keeps falsy values like isDraft: false, status: 0 and vote: 0', () => {
    const pr = {
      pullRequestId: 1,
      status: PullRequestStatus.NotSet,
      isDraft: false,
      reviewers: [{ ...fullIdentity, vote: 0 }],
    } as never;

    const result = projectPullRequest(pr);

    expect(result.isDraft).toBe(false);
    expect(result.status).toBe(PullRequestStatus.NotSet);
    expect(result.status).toBe(0);
    expect(result.reviewers).toEqual([{ ...compactIdentity, vote: 0 }]);
  });

  test('does not add keys for missing or empty fields', () => {
    const result = projectPullRequest({
      pullRequestId: 42,
      title: 'PR 42',
    } as never);
    expect(result).toEqual({ pullRequestId: 42, title: 'PR 42' });
  });

  test('does not add keys when nested collections are absent or empty', () => {
    const pr = {
      pullRequestId: 43,
      reviewers: undefined,
      repository: undefined,
      workItemRefs: [{ url: 'http://server/_apis/wit/workItems/789' }],
      labels: [],
      completionOptions: {},
      mergeOptions: {},
    } as never;

    const result = projectPullRequest(pr);

    expect(result).not.toHaveProperty('reviewers');
    expect(result).not.toHaveProperty('repository');
    expect(result).not.toHaveProperty('workItemRefs');
    expect(result).not.toHaveProperty('labels');
    expect(result).not.toHaveProperty('completionOptions');
    expect(result).not.toHaveProperty('mergeOptions');
  });

  test('omits completionOptions.mergeCommitMessage when it duplicates the description', () => {
    const pr = {
      pullRequestId: 1,
      description: 'Fix the login flow',
      completionOptions: {
        mergeCommitMessage: 'Fix the login flow',
        deleteSourceBranch: false,
        mergeStrategy: 1,
        transitionWorkItems: true,
      },
    } as never;

    const result = projectPullRequest(pr);

    expect(result.completionOptions).toEqual({
      deleteSourceBranch: false,
      mergeStrategy: 1,
      transitionWorkItems: true,
    });
  });

  test('keeps completionOptions.mergeCommitMessage when it differs from the description', () => {
    const pr = {
      pullRequestId: 1,
      description: 'Fix the login flow',
      completionOptions: {
        mergeCommitMessage: 'Merge fix (#42)',
      },
    } as never;

    const result = projectPullRequest(pr);

    expect(result.completionOptions).toEqual({
      mergeCommitMessage: 'Merge fix (#42)',
    });
  });

  test('compacts forkSource and its nested repository', () => {
    const pr = {
      pullRequestId: 1,
      forkSource: {
        name: 'refs/heads/fix-login',
        objectId: 'obj-1',
        creator: fullIdentity,
        url: 'http://server/_apis/git/repositories/Repo1/forks',
        repository: {
          id: 'repo-fork',
          name: 'Repo1-fork',
          url: 'http://server/_apis/git/repositories/Repo1-fork',
          project: { id: 'project-1', name: 'DefaultProject' },
        },
      },
    } as never;

    const result = projectPullRequest(pr);

    expect(result.forkSource).toEqual({
      name: 'refs/heads/fix-login',
      objectId: 'obj-1',
      repository: {
        id: 'repo-fork',
        name: 'Repo1-fork',
        project: { id: 'project-1', name: 'DefaultProject' },
      },
    });
  });

  test('omits null scalar fields and empty collections', () => {
    const pr = {
      pullRequestId: 1,
      title: null,
      description: null,
      status: null,
      closedDate: null,
      mergeFailureMessage: null,
      mergeFailureType: null,
      artifactId: null,
      reviewers: [],
      workItemRefs: [],
      labels: [{ url: 'http://server/_apis/tags/label-1' }],
      forkSource: { url: 'http://server/_apis/git/repositories/Repo1/forks' },
      completionOptions: {
        autoCompleteIgnoreConfigIds: [],
        mergeStrategy: null,
      },
      mergeOptions: {},
    } as never;

    const result = projectPullRequest(pr);

    expect(result).toEqual({ pullRequestId: 1 });
  });

  test('omits empty votedFor arrays from reviewers', () => {
    const pr = {
      pullRequestId: 1,
      reviewers: [
        {
          id: 'reviewer-1',
          displayName: 'Reviewer',
          uniqueName: 'reviewer@example.com',
          vote: 10,
          votedFor: [],
        },
      ],
    } as never;

    const result = projectPullRequest(pr);

    expect(result.reviewers).toEqual([
      {
        id: 'reviewer-1',
        displayName: 'Reviewer',
        uniqueName: 'reviewer@example.com',
        vote: 10,
      },
    ]);
  });

  test('keeps repository when only project data is present', () => {
    const pr = {
      pullRequestId: 1,
      repository: { project: { id: 'project-1', name: 'DefaultProject' } },
    } as never;

    const result = projectPullRequest(pr);

    expect(result.repository).toEqual({
      project: { id: 'project-1', name: 'DefaultProject' },
    });
  });
});
