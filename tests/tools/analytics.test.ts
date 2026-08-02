import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAnalyticsTools } from '../../src/tools/analytics.js';
import { YandexWebmasterClient } from '../../src/client/yandex-webmaster-client.js';

// Create a mock client with stubs for all analytics methods
function createMockClient() {
  return {
    resolveHostId: vi.fn((hostId?: string) => hostId ?? 'default-host'),
    getSearchQueries: vi.fn().mockResolvedValue({ count: 1, queries: [{ query_text: 'test', indicators: {} }] }),
    getPopularQueries: vi.fn().mockResolvedValue({ count: 2, queries: [{ query_text: 'popular', indicators: {} }] }),
  } as unknown as YandexWebmasterClient;
}

describe('Analytics MCP Tools', () => {
  let client: Client;
  let mockWmClient: ReturnType<typeof createMockClient>;

  beforeAll(async () => {
    const mcpServer = new McpServer({ name: 'test', version: '1.0.0' });
    mockWmClient = createMockClient();
    registerAnalyticsTools(mcpServer, mockWmClient);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-client', version: '1.0.0' });

    await Promise.all([
      client.connect(clientTransport),
      mcpServer.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
  });

  // --- ywm_get_search_queries ---

  describe('ywm_get_search_queries', () => {
    it('returns search query analytics', async () => {
      const result = await client.callTool({
        name: 'ywm_get_search_queries',
        arguments: {
          host_id: 'h1',
          date_from: '2024-01-01',
          date_to: '2024-02-01',
          query_indicator: 'TOTAL_CLICKS',
        },
      });

      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.count).toBe(1);
      expect(parsed.queries[0].query_text).toBe('test');
    });

    it('passes all params to the client', async () => {
      await client.callTool({
        name: 'ywm_get_search_queries',
        arguments: {
          host_id: 'h1',
          date_from: '2024-01-01',
          date_to: '2024-02-01',
          query_indicator: 'TOTAL_SHOWS',
          device_type_indicator: 'DESKTOP',
          offset: 10,
          limit: 50,
        },
      });

      const mock = mockWmClient.getSearchQueries as ReturnType<typeof vi.fn>;
      expect(mock).toHaveBeenCalledWith('h1', {
        date_from: '2024-01-01',
        date_to: '2024-02-01',
        query_indicator: 'TOTAL_SHOWS',
        device_type_indicator: 'DESKTOP',
        offset: 10,
        limit: 50,
      });
    });

    it('returns error on failure', async () => {
      const mock = mockWmClient.getSearchQueries as ReturnType<typeof vi.fn>;
      mock.mockRejectedValueOnce(new Error('API failure'));

      const result = await client.callTool({
        name: 'ywm_get_search_queries',
        arguments: {
          host_id: 'h1',
          date_from: '2024-01-01',
          date_to: '2024-02-01',
          query_indicator: 'TOTAL_CLICKS',
        },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('API failure');
    });
  });

  // --- ywm_get_popular_queries ---

  describe('ywm_get_popular_queries', () => {
    it('returns popular queries', async () => {
      const result = await client.callTool({
        name: 'ywm_get_popular_queries',
        arguments: {
          host_id: 'h1',
          date_from: '2024-01-01',
          date_to: '2024-02-01',
          query_indicator: 'TOTAL_CLICKS',
        },
      });

      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.count).toBe(2);
      expect(parsed.queries[0].query_text).toBe('popular');
    });

    it('passes params to client', async () => {
      await client.callTool({
        name: 'ywm_get_popular_queries',
        arguments: {
          host_id: 'h2',
          date_from: '2024-03-01',
          date_to: '2024-04-01',
          query_indicator: 'AVG_SHOW_POSITION',
          device_type_indicator: 'MOBILE',
        },
      });

      const mock = mockWmClient.getPopularQueries as ReturnType<typeof vi.fn>;
      expect(mock).toHaveBeenCalledWith('h2', {
        date_from: '2024-03-01',
        date_to: '2024-04-01',
        query_indicator: 'AVG_SHOW_POSITION',
        device_type_indicator: 'MOBILE',
        // Вызов не передавал order_by — подставилось значение по умолчанию из
        // схемы. Без параметра Яндекс отвечает 400, поэтому дефолт обязателен.
        order_by: 'TOTAL_SHOWS',
        offset: undefined,
        limit: undefined,
      });
    });
  });

});
