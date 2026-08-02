import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { YandexWebmasterClient } from '../client/index.js';
import {
  optionalHostIdSchema,
  queryIndicatorSchema,
  deviceTypeSchema,
  orderBySchema,
} from '../utils/schemas.js';
import { errorResult, jsonResult } from '../utils/tool-response.js';

export function registerAnalyticsTools(
  server: McpServer,
  client: YandexWebmasterClient,
): void {
  // --- Search Queries ---

  server.tool(
    'ywm_get_search_queries',
    'Get search query analytics history',
    {
      host_id: optionalHostIdSchema,
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      query_indicator: queryIndicatorSchema,
      device_type_indicator: deviceTypeSchema,
      offset: z.number().int().min(0).optional().describe('Offset'),
      limit: z.number().int().min(1).max(500).optional().describe('Max results'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getSearchQueries(hostId, {
          date_from: params.date_from,
          date_to: params.date_to,
          query_indicator: params.query_indicator,
          device_type_indicator: params.device_type_indicator,
          offset: params.offset,
          limit: params.limit,
        });
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'ywm_get_popular_queries',
    'Get popular search queries',
    {
      host_id: optionalHostIdSchema,
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      query_indicator: queryIndicatorSchema,
      device_type_indicator: deviceTypeSchema,
      order_by: orderBySchema,
      offset: z.number().int().min(0).optional().describe('Offset'),
      limit: z.number().int().min(1).max(500).optional().describe('Max results'),
    },
    async (params) => {
      try {
        const hostId = client.resolveHostId(params.host_id);
        const result = await client.getPopularQueries(hostId, {
          date_from: params.date_from,
          date_to: params.date_to,
          query_indicator: params.query_indicator,
          device_type_indicator: params.device_type_indicator,
          order_by: params.order_by,
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
