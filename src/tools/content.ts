import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { YandexWebmasterClient } from '../client/index.js';
import { optionalHostIdSchema } from '../utils/schemas.js';
import { errorResult, jsonResult } from '../utils/tool-response.js';

export function registerContentTools(server: McpServer, client: YandexWebmasterClient): void {
  // --- Sitemaps ---

  server.tool(
    'ywm_list_sitemaps',
    'List all sitemaps',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.listSitemaps(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_sitemap',
    'Get sitemap details',
    {
      host_id: optionalHostIdSchema,
      sitemap_id: z.string().describe('Sitemap ID'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getSitemap(hostId, params.sitemap_id);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_list_user_sitemaps',
    'List user-added sitemaps',
    { host_id: optionalHostIdSchema },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.listUserSitemaps(hostId);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_add_sitemap',
    'Add a new sitemap',
    {
      host_id: optionalHostIdSchema,
      url: z.string().describe('Sitemap URL'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.addSitemap(hostId, params.url);
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // --- Indexing ---

  server.tool(
    'ywm_get_indexing_history',
    'Get indexing history over time',
    {
      host_id: optionalHostIdSchema,
      date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getIndexingHistory(hostId, {
          date_from: params.date_from,
          date_to: params.date_to,
        });
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_indexing_samples',
    'Get indexing samples with HTTP codes',
    {
      host_id: optionalHostIdSchema,
      offset: z.number().optional().describe('Offset'),
      limit: z.number().optional().describe('Max results'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getIndexingSamples(hostId, {
          offset: params.offset,
          limit: params.limit,
        });
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
