import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerActionTools } from '../../src/tools/actions.js';

// --- Mock client ---

function createMockClient() {
  return {
    resolveHostId: vi.fn((id?: string) => id ?? 'default-host'),
    getRecrawlQuota: vi.fn().mockResolvedValue({ daily_quota: 100, quota_remainder: 42 }),
    addRecrawlTask: vi.fn().mockResolvedValue({
      task_id: 't2', url: 'https://example.com/new', added_date: '2024-01-02',
    }),
    getRecrawlTask: vi.fn().mockResolvedValue({
      task_id: 't1', url: 'https://example.com/page', added_date: '2024-01-01', status: 'IN_PROGRESS',
    }),
  };
}

type MockClient = ReturnType<typeof createMockClient>;

// --- Test helpers ---

async function setupTestEnv() {
  const mockClient = createMockClient();
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  // Cast mock to satisfy the type — only methods used in registerActionTools are mocked
  registerActionTools(server, mockClient as never);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server, mockClient };
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

function getTextContent(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0].text;
}

// --- Tests ---

describe('Action tools', () => {
  let client: Client;
  let server: McpServer;
  let mockClient: MockClient;

  beforeAll(async () => {
    const env = await setupTestEnv();
    client = env.client;
    server = env.server;
    mockClient = env.mockClient;
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  // --- Recrawl tools ---

  describe('ywm_get_recrawl_quota', () => {
    it('returns recrawl quota as JSON', async () => {
      const result = await callTool(client, 'ywm_get_recrawl_quota', { host_id: 'h1' });
      const parsed = JSON.parse(getTextContent(result));

      expect(parsed).toEqual({ daily_quota: 100, quota_remainder: 42 });
      expect(mockClient.resolveHostId).toHaveBeenCalledWith('h1');
      expect(mockClient.getRecrawlQuota).toHaveBeenCalledWith('h1');
    });

    it('uses default host when host_id is omitted', async () => {
      await callTool(client, 'ywm_get_recrawl_quota');

      expect(mockClient.resolveHostId).toHaveBeenCalledWith(undefined);
      expect(mockClient.getRecrawlQuota).toHaveBeenCalledWith('default-host');
    });

    it('returns error when client throws', async () => {
      mockClient.getRecrawlQuota.mockRejectedValueOnce(new Error('Quota fetch failed'));

      const result = await callTool(client, 'ywm_get_recrawl_quota', { host_id: 'h1' });

      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('Quota fetch failed');
    });
  });

  describe('ywm_submit_recrawl', () => {
    it('submits a URL for recrawling and returns task', async () => {
      const result = await callTool(client, 'ywm_submit_recrawl', {
        host_id: 'h1',
        url: 'https://example.com/new',
      });
      const parsed = JSON.parse(getTextContent(result));

      expect(parsed.task_id).toBe('t2');
      expect(mockClient.addRecrawlTask).toHaveBeenCalledWith('h1', 'https://example.com/new');
    });

    it('returns error when client throws', async () => {
      mockClient.addRecrawlTask.mockRejectedValueOnce(new Error('Recrawl failed'));

      const result = await callTool(client, 'ywm_submit_recrawl', {
        host_id: 'h1',
        url: 'https://example.com/fail',
      });

      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('Recrawl failed');
    });
  });

  // --- Recrawl task details ---

  describe('ywm_get_recrawl_task', () => {
    it('returns recrawl task details', async () => {
      const result = await callTool(client, 'ywm_get_recrawl_task', {
        host_id: 'h1',
        task_id: 't1',
      });
      const parsed = JSON.parse(getTextContent(result));

      expect(parsed.task_id).toBe('t1');
      expect(parsed.status).toBe('IN_PROGRESS');
      expect(mockClient.getRecrawlTask).toHaveBeenCalledWith('h1', 't1');
    });

    it('returns error when client throws', async () => {
      mockClient.getRecrawlTask.mockRejectedValueOnce(new Error('Task not found'));

      const result = await callTool(client, 'ywm_get_recrawl_task', {
        host_id: 'h1',
        task_id: 'bad',
      });

      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('Task not found');
    });
  });

});
