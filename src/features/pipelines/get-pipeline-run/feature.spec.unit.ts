import { WebApi } from 'azure-devops-node-api';
import {
  RunResult,
  RunState,
} from 'azure-devops-node-api/interfaces/PipelinesInterfaces';
import { fetchRunArtifacts } from '../artifacts';
import { getPipelineRun } from './feature';

jest.mock('../artifacts', () => ({
  fetchRunArtifacts: jest.fn(),
}));
import {
  AzureDevOpsAuthenticationError,
  AzureDevOpsError,
  AzureDevOpsResourceNotFoundError,
} from '../../../shared/errors';
import { Run } from '../types';

describe('getPipelineRun unit', () => {
  let mockConnection: WebApi;
  let mockPipelinesApi: any;
  let mockRestGet: jest.Mock;
  let mockBuildApi: any;

  const baseRun: Run = {
    id: 200,
    name: 'Run 200',
    createdDate: new Date('2024-02-01T10:00:00Z'),
    state: RunState.Completed,
    result: RunResult.Succeeded,
    url: 'https://dev.azure.com/org/project/_apis/pipelines/runs/200',
    _links: {
      web: { href: 'https://dev.azure.com/org/project/pipelines/run/200' },
    },
    pipeline: { id: 42 },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    (fetchRunArtifacts as jest.Mock).mockResolvedValue([]);

    mockRestGet = jest.fn();

    mockPipelinesApi = {
      rest: { get: mockRestGet },
      createRequestOptions: jest
        .fn()
        .mockReturnValue({ acceptHeader: 'application/json' }),
      formatResponse: jest.fn().mockImplementation((result: any) => result),
    };

    mockBuildApi = {
      getBuild: jest.fn().mockRejectedValue(new Error('not found')),
    };

    mockConnection = {
      serverUrl: 'https://dev.azure.com/testorg',
      getPipelinesApi: jest.fn().mockResolvedValue(mockPipelinesApi),
      getBuildApi: jest.fn().mockResolvedValue(mockBuildApi),
    } as unknown as WebApi;
  });

  it('returns run details', async () => {
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: baseRun,
      headers: {},
    });

    const run = await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
    });

    expect(run).toEqual({
      id: 200,
      name: 'Run 200',
      state: 'completed',
      result: 'succeeded',
      createdDate: new Date('2024-02-01T10:00:00Z'),
      pipeline: { id: 42 },
      webUrl: 'https://dev.azure.com/org/project/pipelines/run/200',
    });
    expect(mockRestGet).toHaveBeenCalled();
    const [requestUrl] = mockRestGet.mock.calls[0];
    expect(requestUrl).toContain('/_apis/pipelines/runs/200');
    expect(requestUrl).toContain('api-version=7.1');
  });

  it('omits raw fields from the default projection', async () => {
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: baseRun,
      headers: {},
    });

    const run = await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
    });

    expect(run).not.toHaveProperty('_links');
    expect(run).not.toHaveProperty('url');
    expect(run).not.toHaveProperty('resources');
  });

  it('returns the full raw run when includeDetails is true', async () => {
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: baseRun,
      headers: {},
    });

    const run = await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
      includeDetails: true,
    });

    expect(run).toEqual(baseRun);
  });

  it('projects commit and refName from repository resources', async () => {
    const runWithRepo: Run = {
      ...baseRun,
      resources: {
        repositories: {
          self: { version: 'abc123', refName: 'refs/heads/main' },
        },
      },
    };
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: runWithRepo,
      headers: {},
    });

    const run = await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
    });

    expect(run).toMatchObject({ commit: 'abc123', refName: 'refs/heads/main' });
  });

  it('preserves artifacts in the compact projection', async () => {
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: baseRun,
      headers: {},
    });
    (fetchRunArtifacts as jest.Mock).mockResolvedValue([
      { name: 'out', type: 'Container' },
    ]);

    const run = await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
    });

    expect(run.artifacts).toEqual([{ name: 'out', type: 'Container' }]);
    expect(run).not.toHaveProperty('_links');
  });

  it('uses build API to resolve pipeline id when not provided', async () => {
    mockBuildApi.getBuild.mockResolvedValue({ definition: { id: 123 } });
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: baseRun,
      headers: {},
    });

    await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
    });

    expect(mockBuildApi.getBuild).toHaveBeenCalledWith('test-project', 200);
    const [requestUrl] = mockRestGet.mock.calls[0];
    expect(requestUrl).toContain('/pipelines/123/runs/200');
  });

  it('validates pipeline membership when provided', async () => {
    mockRestGet.mockResolvedValueOnce({
      statusCode: 200,
      result: { ...baseRun, pipeline: { id: '42' } },
      headers: {},
    });

    const run = await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
      pipelineId: 42,
    });

    expect(run.pipeline?.id).toBe('42');
  });

  it('throws resource not found when pipeline guard fails', async () => {
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: { ...baseRun, pipeline: { id: 99 } },
      headers: {},
    });

    await expect(
      getPipelineRun(mockConnection, {
        projectId: 'test-project',
        runId: 200,
        pipelineId: 42,
      }),
    ).rejects.toBeInstanceOf(AzureDevOpsResourceNotFoundError);
  });

  it('throws resource not found when pipeline information is missing but guard provided', async () => {
    mockRestGet.mockResolvedValue({
      statusCode: 200,
      result: { ...baseRun, pipeline: undefined },
      headers: {},
    });

    await expect(
      getPipelineRun(mockConnection, {
        projectId: 'test-project',
        runId: 200,
        pipelineId: 42,
      }),
    ).rejects.toBeInstanceOf(AzureDevOpsResourceNotFoundError);
  });

  it('throws resource not found when API returns 404', async () => {
    mockRestGet.mockResolvedValue({
      statusCode: 404,
      result: null,
      headers: {},
    });

    await expect(
      getPipelineRun(mockConnection, {
        projectId: 'test-project',
        runId: 404,
      }),
    ).rejects.toBeInstanceOf(AzureDevOpsResourceNotFoundError);
  });

  it('falls back to generic run endpoint when pipeline-specific lookup fails', async () => {
    mockRestGet
      .mockResolvedValueOnce({ statusCode: 404, result: null, headers: {} })
      .mockResolvedValueOnce({
        statusCode: 200,
        result: baseRun,
        headers: {},
      });

    const run = await getPipelineRun(mockConnection, {
      projectId: 'test-project',
      runId: 200,
      pipelineId: 42,
    });

    expect(run).toEqual({
      id: 200,
      name: 'Run 200',
      state: 'completed',
      result: 'succeeded',
      createdDate: new Date('2024-02-01T10:00:00Z'),
      pipeline: { id: 42 },
      webUrl: 'https://dev.azure.com/org/project/pipelines/run/200',
    });
    expect(mockRestGet).toHaveBeenCalledTimes(2);
    const [firstUrl] = mockRestGet.mock.calls[0];
    const [secondUrl] = mockRestGet.mock.calls[1];
    expect(firstUrl).toContain('/pipelines/42/runs/200');
    expect(secondUrl).toContain('/pipelines/runs/200');
  });

  it('maps authentication errors', async () => {
    mockRestGet.mockRejectedValue(new Error('Unauthorized 401'));

    await expect(
      getPipelineRun(mockConnection, {
        projectId: 'test-project',
        runId: 200,
      }),
    ).rejects.toBeInstanceOf(AzureDevOpsAuthenticationError);
  });

  it('wraps unexpected errors', async () => {
    mockRestGet.mockRejectedValue(new Error('Something went wrong'));

    await expect(
      getPipelineRun(mockConnection, {
        projectId: 'test-project',
        runId: 200,
      }),
    ).rejects.toBeInstanceOf(AzureDevOpsError);
  });
});
