# Azure DevOps MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for Azure DevOps, so AI assistants can work with projects, work items, repositories, pull requests, pipelines and wikis through a standardized protocol.

This is a personal fork of [Tiberriver256/mcp-server-azure-devops](https://github.com/Tiberriver256/mcp-server-azure-devops) (via [jhirschicultura/mcp-server-azure-devops](https://github.com/jhirschicultura/mcp-server-azure-devops)). It is not published on npm — run it from a local checkout.

## What this fork changes

Most of the work here is about keeping tool responses small enough to be useful in a real chat context:

- **Compact responses by default.** `get_pull_request`, `list_pull_requests`, `get_pipeline_run` and `list_pipeline_runs` return a projection instead of the raw Azure DevOps payload. Identity objects (`createdBy`, `reviewers`, comment authors, …) are reduced to `{ id, displayName, uniqueName }`. Pass `includeDetails: true` to get the full API object.
- **Context limits.** `get_file_content` supports `startLine`/`endLine` and caps output at 1000 lines / 20 000 characters / 1000 characters per line. `get_pull_request_changes` and `list_commits` return no diffs unless `includeDiffs: true`, and patches are truncated. Repository tree tools cap items, repositories and total output size. `search_code` returns snippets only with `includeContent: true`.
- **Tool selection.** `tools.config.json` (or `AZURE_DEVOPS_TOOLS_CONFIG`) enables features and disables individual tools, so a client only sees what it needs.
- **Safer file handling.** Attachment paths are confined to a sandbox directory (`AZURE_DEVOPS_ATTACHMENTS_DIR`, default: the current working directory); absolute paths and `..` traversal are rejected.
- **Azure DevOps Server friendly.** PAT authentication, configurable REST api-version, on-prem error envelopes and `get_me` via `connectionData`.

## Requirements

- Node.js 18 or newer
- An Azure DevOps organization or an Azure DevOps Server collection
- A Personal Access Token, Azure Identity credentials, or an Azure CLI login

## Getting started

Clone and build:

```bash
git clone https://github.com/MaxaiZer/mcp-server-azure-devops.git
cd mcp-server-azure-devops
npm ci
npm run build
```

Optional: copy `.env.example` to `.env` and fill in your values (the server loads it automatically).

Run it directly to check that it starts:

```bash
node dist/index.js
```

For development with auto-reload:

```bash
npm run dev
```

## Using it from an MCP client

Point the client at the built entry point with an absolute path:

```json
{
  "mcpServers": {
    "azureDevOps": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-azure-devops/dist/index.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-organization",
        "AZURE_DEVOPS_AUTH_METHOD": "pat",
        "AZURE_DEVOPS_PAT": "<YOUR_PAT>",
        "AZURE_DEVOPS_DEFAULT_PROJECT": "your-project-name"
      }
    }
  }
}
```

With Azure Identity (run `az login` first) use `"AZURE_DEVOPS_AUTH_METHOD": "azure-identity"` and drop the PAT. With `"azure-cli"` the server uses your Azure CLI login.

For Azure DevOps Server, the organization URL is the collection URL and PAT is the only supported method:

```json
{
  "mcpServers": {
    "azureDevOps": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-azure-devops/dist/index.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://server:8080/tfs/DefaultCollection",
        "AZURE_DEVOPS_AUTH_METHOD": "pat",
        "AZURE_DEVOPS_PAT": "<YOUR_PAT>",
        "AZURE_DEVOPS_API_VERSION": "7.1"
      }
    }
  }
}
```

Detailed setup, examples and troubleshooting: [docs/authentication.md](docs/authentication.md) and [docs/examples](docs/examples).

## Configuration

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `AZURE_DEVOPS_ORG_URL` | Organization URL or Server collection URL | Yes | – |
| `AZURE_DEVOPS_AUTH_METHOD` | `pat`, `azure-identity` or `azure-cli` (case-insensitive) | No | `azure-identity` |
| `AZURE_DEVOPS_PAT` | Personal Access Token | With `pat` | – |
| `AZURE_DEVOPS_DEFAULT_PROJECT` | Project used when a tool call omits one | No | – |
| `AZURE_DEVOPS_API_VERSION` | REST api-version for tools that call the REST API directly | No | `7.1` |
| `AZURE_TENANT_ID` | Azure AD tenant (service principals) | With service principals | – |
| `AZURE_CLIENT_ID` | Azure AD application ID | With service principals | – |
| `AZURE_CLIENT_SECRET` | Azure AD client secret | With service principals | – |
| `AZURE_DEVOPS_TOOLS_CONFIG` | Path to a tools configuration file | No | `./tools.config.json` |
| `AZURE_DEVOPS_ATTACHMENTS_DIR` | Directory that attachment file paths are confined to | No | current working directory |
| `LOG_LEVEL` | `debug`, `info`, `warn` or `error` (`DEBUG=true` also enables debug) | No | – |

### Tool selection

`tools.config.json` is read at startup. If the file does not exist, every feature and tool is enabled.

```json
{
  "features": {
    "users": true,
    "organizations": true,
    "projects": true,
    "repositories": true,
    "work-items": true,
    "search": true,
    "pull-requests": true,
    "pipelines": true,
    "wikis": true
  },
  "tools": {
    "disabled": ["trigger_pipeline", "create_commit"]
  }
}
```

See [tools.config.example.json](tools.config.example.json) and [tools.config.schema.json](tools.config.schema.json).

## Tools

For per-tool parameters and examples see the [tool documentation](docs/tools/README.md).

### User

- `get_me` — authenticated user (Azure DevOps Services and Server)

### Organizations

- `list_organizations` — organizations accessible to the current identity (Azure DevOps Services only)

### Projects

- `list_projects` — projects in the organization
- `get_project` — project details
- `get_project_details` — process, work item types and teams for a project

### Repositories

- `list_repositories` — repositories in a project
- `get_repository` — repository details
- `get_repository_details` — statistics and refs
- `get_file_content` — file or directory content, with an optional line range
- `get_repository_tree` — file tree from a path and depth
- `get_all_repositories_tree` — file tree across repositories
- `create_branch` — branch from an existing ref
- `create_commit` — commit multiple changes using unified diffs or search/replace instructions
- `list_commits` — commits on a branch, with optional diffs

### Work items

- `list_work_items` — query work items, with optional extra fields
- `get_work_item` — work item details
- `create_work_item` — create a work item
- `update_work_item` — update fields, tags and links
- `manage_work_item_link` — add, remove or update links between work items
- `get_work_item_comments` — discussion history
- `create_work_item_attachment` — attach a file from a local path or base64 content
- `get_work_item_attachment` — download an attachment or view it inline
- `list_work_item_attachments` — attachments on a work item
- `delete_work_item_attachment` — delete an attachment

### Pull requests

- `create_pull_request` — create a PR with reviewers, work items and tags
- `get_pull_request` — PR details (compact by default)
- `list_pull_requests` — PRs in a repository, filterable by status, creator, source and target branch
- `update_pull_request` — update fields, reviewers, work items and tags
- `get_pull_request_changes` — changed files and policy evaluations
- `get_pull_request_checks` — status checks, policies and related pipelines
- `get_pull_request_comments` — comment threads
- `add_pull_request_comment` — reply in a thread, or start a file thread on a line or line range
- `update_pull_request_comment` — edit a comment
- `update_pull_request_thread_status` — resolve, reactivate or close a thread

### Pipelines

- `list_pipelines` — pipelines in a project
- `get_pipeline` — pipeline details
- `list_pipeline_runs` — runs with filters (compact by default)
- `get_pipeline_run` — run details and artifacts (compact by default)
- `pipeline_timeline` — stages and jobs of a run
- `get_pipeline_log` — raw or JSON-formatted log content
- `download_pipeline_artifact` — a single artifact file as text
- `trigger_pipeline` — queue a run with parameters

### Search

- `search_code` — code search across repositories
- `search_wiki` — wiki search
- `search_work_items` — work item search

### Wikis

- `get_wikis` — wikis in a project
- `get_wiki_page` — page content as plain text
- `list_wiki_pages` — pages in a wiki
- `create_wiki` — create a wiki
- `create_wiki_page` — create a page
- `update_wiki_page` — update page content

## Resources

Repositories, work items and pull requests can also be read through `azuredevops://` resource URIs. See [docs/tools/resources.md](docs/tools/resources.md).

## Development

```bash
npm run lint          # eslint
npm run format        # prettier
npm test              # unit + integration + e2e
npm run inspector     # MCP inspector against the built server
```

## License

MIT. Based on [Tiberriver256/mcp-server-azure-devops](https://github.com/Tiberriver256/mcp-server-azure-devops) by Micah Rairdon, via [jhirschicultura/mcp-server-azure-devops](https://github.com/jhirschicultura/mcp-server-azure-devops). See [LICENSE](LICENSE).
