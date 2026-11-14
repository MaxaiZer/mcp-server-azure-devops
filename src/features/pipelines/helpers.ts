import { WebApi } from 'azure-devops-node-api';
import { Build } from 'azure-devops-node-api/interfaces/BuildInterfaces';
import {
  Run,
  RunResult,
  RunState,
} from 'azure-devops-node-api/interfaces/PipelinesInterfaces';
import { ProjectedPipelineRun } from './types';

export function coercePipelineId(id: unknown): number | undefined {
  if (typeof id === 'number') {
    return id;
  }

  if (typeof id === 'string') {
    const parsed = Number.parseInt(id, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

export async function resolvePipelineId(
  connection: WebApi,
  projectId: string,
  runId: number,
  providedPipelineId?: number,
): Promise<number | undefined> {
  if (typeof providedPipelineId === 'number') {
    return providedPipelineId;
  }

  try {
    const buildApi = await connection.getBuildApi();
    const build = (await buildApi.getBuild(projectId, runId)) as
      | Build
      | undefined;
    return coercePipelineId(build?.definition?.id);
  } catch {
    // Swallow errors here; we'll handle not-found later when the main request fails
    return undefined;
  }
}

function enumName(
  value: unknown,
  enumValues: Record<string, number>,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    const name = Object.keys(enumValues).find(
      (key) => enumValues[key] === value,
    );
    return name ? name.charAt(0).toLowerCase() + name.slice(1) : String(value);
  }

  return String(value);
}

export function stateName(value: Run['state']): string | null {
  return enumName(value, RunState as unknown as Record<string, number>);
}

export function resultName(value: Run['result']): string | null {
  return enumName(value, RunResult as unknown as Record<string, number>);
}

/**
 * formatResponse converts state/result to numeric enum values; map them back
 * to the API string names ("completed", "succeeded") for consumers.
 */
export function normalizeRun(run: Run): Run {
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

/**
 * Project a run down to the compact default shape. With includeDetails the
 * run is returned untouched (the tool's previous raw behavior).
 */
export function projectRun(
  run: Run,
  includeDetails: boolean,
): ProjectedPipelineRun | Run {
  if (includeDetails) {
    return run;
  }

  const normalized = normalizeRun(run);
  const self = normalized.resources?.repositories?.self;

  return {
    ...(normalized.id !== undefined ? { id: normalized.id } : {}),
    ...(normalized.name !== undefined ? { name: normalized.name } : {}),
    ...(normalized.state != null
      ? { state: normalized.state as unknown as string }
      : {}),
    ...(normalized.result != null
      ? { result: normalized.result as unknown as string }
      : {}),
    ...(normalized.createdDate != null
      ? { createdDate: normalized.createdDate }
      : {}),
    ...(normalized.finishedDate != null
      ? { finishedDate: normalized.finishedDate }
      : {}),
    ...(normalized.pipeline
      ? {
          pipeline: {
            id: normalized.pipeline.id as number | string | undefined,
            name: normalized.pipeline.name,
          },
        }
      : {}),
    ...(self?.version ? { commit: self.version } : {}),
    ...(self?.refName ? { refName: self.refName } : {}),
    ...(normalized._links?.web?.href
      ? { webUrl: normalized._links.web.href }
      : {}),
  };
}
