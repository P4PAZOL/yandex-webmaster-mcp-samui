import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { YandexWebmasterClient } from '../client/index.js';
import { optionalHostIdSchema } from '../utils/schemas.js';
import { errorResult, jsonResult } from '../utils/tool-response.js';

export function registerCoreTools(server: McpServer, client: YandexWebmasterClient): void {
  server.tool(
    'ywm_get_user',
    'Get current user info (user ID)',
    {},
    async () => {
      try {
        const result = await client.getUser();
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_list_hosts',
    'List all registered hosts (sites)',
    {},
    async () => {
      try {
        const result = await client.listHosts();
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_host',
    'Get host details by ID',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getHost(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_host_summary',
    'Get host summary (SQI, pages, problems)',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getHostSummary(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_verification',
    'Get host verification status',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getVerificationStatus(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_diagnostics',
    'Get site diagnostics and problems',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getDiagnostics(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_list_owners',
    'List host owners',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.listOwners(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
