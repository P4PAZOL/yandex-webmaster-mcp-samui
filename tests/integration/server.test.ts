import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server.js';

// Mock fetch so resolveDefaultHost (triggered by env) doesn't make real requests
const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ user_id: 1, hosts: [] }),
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('Server integration', () => {
  let mcpClient: Client;
  let clientTransport: InstanceType<typeof InMemoryTransport>;
  let serverTransport: InstanceType<typeof InMemoryTransport>;

  beforeAll(async () => {
    const server = await createServer('test-token');
    mcpClient = new Client({ name: 'integration-test', version: '1.0.0' });

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      mcpClient.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await clientTransport.close();
    await serverTransport.close();
  });

  it('creates a server successfully with a token', async () => {
    const server = await createServer('another-token');
    expect(server).toBeDefined();
  });

  // Набор инструментов зафиксирован точным списком, а не только проверками
  // «содержит». Так тест ловит и пропажу нужного инструмента, и появление
  // лишнего — например, если очередной merge из upstream вернёт вырезанное.
  const EXPECTED_TOOLS = [
    'ywm_add_sitemap',
    'ywm_get_diagnostics',
    'ywm_get_host_summary',
    'ywm_get_indexing_history',
    'ywm_get_indexing_samples',
    'ywm_get_popular_queries',
    'ywm_get_recrawl_quota',
    'ywm_get_recrawl_task',
    'ywm_get_search_queries',
    'ywm_get_sitemap',
    'ywm_list_hosts',
    'ywm_list_sitemaps',
    'ywm_list_user_sitemaps',
    'ywm_submit_recrawl',
  ];

  it('registers exactly the 14 expected tools', async () => {
    const { tools } = await mcpClient.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual(EXPECTED_TOOLS);
  });

  // Гейт форка: шесть деструктивных инструментов оригинала вырезаны физически.
  // Если любой из них вернётся в регистрацию — этот тест упадёт.
  describe('destructive tools are not registered', () => {
    const removedTools = [
      'ywm_add_host',
      'ywm_delete_host',
      'ywm_verify_host',
      'ywm_delete_sitemap',
      'ywm_batch_remove_feeds',
      'ywm_delete_original_text',
    ];

    it.each(removedTools)('does not register %s', async (toolName) => {
      const { tools } = await mcpClient.listTools();
      const names = tools.map((t) => t.name);
      expect(names).not.toContain(toolName);
    });
  });

  it.each(EXPECTED_TOOLS)('registers %s', async (toolName) => {
    const { tools } = await mcpClient.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain(toolName);
  });

  it('each tool has a description', async () => {
    const { tools } = await mcpClient.listTools();
    for (const tool of tools) {
      expect(tool.description, `${tool.name} should have a description`).toBeTruthy();
    }
  });
});
