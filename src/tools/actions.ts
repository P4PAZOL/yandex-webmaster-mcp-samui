import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { YandexWebmasterClient } from '../client/index.js';
import { optionalHostIdSchema } from '../utils/schemas.js';
import { errorResult, jsonResult } from '../utils/tool-response.js';

export function registerActionTools(server: McpServer, client: YandexWebmasterClient): void {
  // --- Recrawl ---

  server.tool(
    'ywm_submit_recrawl',
    'Submit URL for recrawling (consumes quota)',
    {
      host_id: optionalHostIdSchema,
      url: z.string().describe('URL to recrawl'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.addRecrawlTask(hostId, params.url);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_recrawl_task',
    'Get recrawl task details',
    {
      host_id: optionalHostIdSchema,
      task_id: z.string().describe('Task ID'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getRecrawlTask(hostId, params.task_id);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_recrawl_quota',
    'Get recrawl quota',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getRecrawlQuota(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
