import { WebApi } from 'azure-devops-node-api';
import {
  RunResult,
  RunState,
  TypeInfo,
} from 'azure-devops-node-api/interfaces/PipelinesInterfaces';
import {
  AzureDevOpsAuthenticationError,
  AzureDevOpsError,
  AzureDevOpsResourceNotFoundError,
} from '../../../shared/errors';
import { apiVersion, defaultProject } from '../../../utils/environment';
import { ListPipelineRunsOptions, ListPipelineRunsResult, Run } from '../types';

const API_VERSION = apiVersion;

function normalizeBranch(branch?: string): string | undefined {
  if (!branch) {
    return undefined;
  }

  const trimmed = branch.trim();
  if (trimmed.startsWith('refs/')) {
    return trimmed;
  }

  return `refs/heads/${trimmed}`;
}

function enumName(value: unknown, enumValues: Record<string, number>): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    const name = Object.keys(enumValues).find((key) => enumValues[key] === value);
    return name ? name.charAt(0).toLowerCase() + name.slice(1) : String(value);
  }

  return String(value);
}

function stateName(value: Run['state']): string | null {
  return enumName(value, RunState as unknown as Record<string, number>);
}

function resultName(value: Run['result']): string | null {
  return enumName(value, RunResult as unknown as Record<string, number>);
}

/**
 * formatResponse converts state/result to numeric enum values; map them back
 * to the API string names ("completed", "succeeded") for consumers.
 */
function normalizeRun(run: Run): Run {
  const state = stateName(run.state);
  const result = resultName(run.result);

  if (state === null && result === null) {
    return run;
  }

  return {
    ...run,
    // The SDK types declare numeric enums, but API payloads and this tool's
    // contract use string names.
    ...(state !== null ? { state: state as unknown as Run['state'] } : {}),
    ...(result !== null ? { result: result as unknown as Run['result'] } : {}),
  };
}

function runCreatedEpoch(run: Run): number | null {
  const value = run.createdDate;
  if (!value) {
    return null;
  }

  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function branchMatches(run: Run, branch: string): boolean | null {
  const repos = run.resources?.repositories;
  if (!repos) {
    return null;
  }

  const entries = Object.values(repos);
  if (entries.length === 0) {
    return null;
  }

  return entries.some((repo) => repo.refName === branch);
}

/**
 * The runs endpoint ignores undocumented query filters on many server
 * versions, so state/result/branch/date/orderBy/top are also enforced
 * client-side. The returned slice always respects the requested contract.
 */
function enforceRunContract(
  runs: Run[],
  options: ListPipelineRunsOptions,
  top: number,
): { runs: Run[]; warnings: string[] } {
  const warnings: string[] = [];
  const branch = normalizeBranch(options.branch);
  const createdFrom = options.createdFrom ? Date.parse(options.createdFrom) : null;
  const createdTo = options.createdTo ? Date.parse(options.createdTo) : null;

  let filtered = runs.filter((run) => {
    // formatResponse converts state/result to numeric enum values, but raw
    // payloads carry string names ("completed"/"succeeded"); compare
    // case-insensitively against both representations.
    if (options.state && stateName(run.state)?.toLowerCase() !== options.state.toLowerCase()) {
      return false;
    }

    if (options.result && resultName(run.result)?.toLowerCase() !== options.result.toLowerCase()) {
      return false;
    }

    const created = runCreatedEpoch(run);
    if (createdFrom !== null && (created === null || created < createdFrom)) {
      return false;
    }

    if (createdTo !== null && (created === null || created > createdTo)) {
      return false;
    }

    if (branch) {
      const match = branchMatches(run, branch);
      if (match === false) {
        return false;
      }
    }

    return true;
  });

  if (branch) {
    const hasBranchData = runs.some(
      (run) => Object.keys(run.resources?.repositories ?? {}).length > 0,
    );
    if (!hasBranchData && runs.length > top) {
      warnings.push(
        `The server ignored the "branch" filter and run objects contain no branch data; the returned runs are not filtered by branch (${branch}).`,
      );
    }
  }

  const direction = options.orderBy === 'createdDate asc' ? 1 : -1;
  filtered = filtered.map(normalizeRun);
  filtered.sort((a, b) => {
    const aCreated = runCreatedEpoch(a) ?? 0;
    const bCreated = runCreatedEpoch(b) ?? 0;
    if (aCreated !== bCreated) {
      return (aCreated - bCreated) * direction;
    }

    return ((a.id ?? 0) - (b.id ?? 0)) * direction;
  });

  return { runs: filtered.slice(0, top), warnings };
}

function extractContinuationToken(
  headers: Record<string, unknown>,
  result: unknown,
): string | undefined {
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === 'x-ms-continuationtoken') {
      if (Array.isArray(value)) {
        return value[0];
      }
      if (typeof value === 'string') {
        return value;
      }
    }
  }

  if (result && typeof result === 'object') {
    const continuationToken = (result as { continuationToken?: unknown })
      .continuationToken;
    if (typeof continuationToken === 'string' && continuationToken.length > 0) {
      return continuationToken;
    }
  }

  return undefined;
}

export async function listPipelineRuns(
  connection: WebApi,
  options: ListPipelineRunsOptions,
): Promise<ListPipelineRunsResult> {
  try {
    const pipelinesApi = await connection.getPipelinesApi();
    const projectId = options.projectId ?? defaultProject;
    const pipelineId = options.pipelineId;

    const baseUrl = connection.serverUrl.replace(/\/+$/, '');
    const route = `${encodeURIComponent(projectId)}/_apis/pipelines/${pipelineId}/runs`;
    const url = new URL(`${route}`, `${baseUrl}/`);

    url.searchParams.set('api-version', API_VERSION);

    // The runs endpoint does not document these query parameters, so they
    // are sent best-effort and also enforced client-side in
    // enforceRunContract (many server versions ignore them).
    const top = Math.min(Math.max(options.top ?? 50, 1), 100);
    url.searchParams.set('$top', top.toString());

    if (options.continuationToken) {
      url.searchParams.set('continuationToken', options.continuationToken);
    }

    const branch = normalizeBranch(options.branch);
    if (branch) {
      url.searchParams.set('branch', branch);
    }

    if (options.state) {
      url.searchParams.set('state', options.state);
    }

    if (options.result) {
      url.searchParams.set('result', options.result);
    }

    if (options.createdFrom) {
      url.searchParams.set('createdDate/min', options.createdFrom);
    }

    if (options.createdTo) {
      url.searchParams.set('createdDate/max', options.createdTo);
    }

    url.searchParams.set('orderBy', options.orderBy ?? 'createdDate desc');

    const requestOptions = pipelinesApi.createRequestOptions(
      'application/json',
      API_VERSION,
    );

    const response = await pipelinesApi.rest.get<{
      value?: Run[];
      continuationToken?: string;
    }>(url.toString(), requestOptions);

    if (response.statusCode === 404 || !response.result) {
      throw new AzureDevOpsResourceNotFoundError(
        `Pipeline ${pipelineId} or project ${projectId} not found`,
      );
    }

    const fetched =
      (pipelinesApi.formatResponse(
        response.result,
        TypeInfo.Run,
        true,
      ) as Run[]) ?? [];

    const { runs, warnings } = enforceRunContract(fetched, options, top);

    const continuationToken = extractContinuationToken(
      response.headers as Record<string, unknown>,
      response.result,
    );

    const extra = warnings.length > 0 ? { warnings } : {};

    return continuationToken
      ? { runs, continuationToken, ...extra }
      : { runs, ...extra };
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('authentication') ||
        message.includes('unauthorized') ||
        message.includes('401')
      ) {
        throw new AzureDevOpsAuthenticationError(
          `Failed to authenticate: ${error.message}`,
        );
      }

      if (
        message.includes('not found') ||
        message.includes('does not exist') ||
        message.includes('404')
      ) {
        throw new AzureDevOpsResourceNotFoundError(
          `Pipeline or project not found: ${error.message}`,
        );
      }
    }

    throw new AzureDevOpsError(
      `Failed to list pipeline runs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
