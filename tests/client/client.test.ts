import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YandexWebmasterClient } from '../../src/client/yandex-webmaster-client.js';
import {
  AuthError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
  YandexWebmasterError,
} from '../../src/client/errors.js';

// Helper to create a mock Response
function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('YandexWebmasterClient', () => {
  let client: YandexWebmasterClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new YandexWebmasterClient('test-token', 'https://api.test.com/v4');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- getUserId ---

  describe('getUserId', () => {
    it('fetches user_id from /user/ endpoint', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { user_id: 12345 }));

      const id = await client.getUserId();

      expect(id).toBe(12345);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.test.com/v4/user/',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'OAuth test-token',
          }),
        }),
      );
    });

    it('caches user_id after first call', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { user_id: 12345 }));

      const id1 = await client.getUserId();
      const id2 = await client.getUserId();

      expect(id1).toBe(12345);
      expect(id2).toBe(12345);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // --- resolveDefaultHost ---

  describe('resolveDefaultHost', () => {
    it('finds host by ascii_host_url', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(200, { user_id: 1 }))
        .mockResolvedValueOnce(mockResponse(200, {
          hosts: [
            {
              host_id: 'https:example.com:443',
              ascii_host_url: 'https://example.com/',
              unicode_host_url: 'https://example.com/',
              verified: true,
            },
          ],
        }));

      const hostId = await client.resolveDefaultHost('https://example.com/');

      expect(hostId).toBe('https:example.com:443');
    });

    it('matches URLs with trailing slash difference', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(200, { user_id: 1 }))
        .mockResolvedValueOnce(mockResponse(200, {
          hosts: [
            {
              host_id: 'https:example.com:443',
              ascii_host_url: 'https://example.com/',
              unicode_host_url: 'https://example.com/',
              verified: true,
            },
          ],
        }));

      const hostId = await client.resolveDefaultHost('https://example.com');

      expect(hostId).toBe('https:example.com:443');
    });

    it('throws when host is not found', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(200, { user_id: 1 }))
        .mockResolvedValueOnce(mockResponse(200, { hosts: [] }));

      await expect(
        client.resolveDefaultHost('https://notfound.com'),
      ).rejects.toThrow(YandexWebmasterError);
    });
  });

  // --- resolveHostId ---

  describe('resolveHostId', () => {
    it('returns provided hostId', () => {
      expect(client.resolveHostId('my-host')).toBe('my-host');
    });

    it('returns defaultHostId when no hostId is provided', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(200, { user_id: 1 }))
        .mockResolvedValueOnce(mockResponse(200, {
          hosts: [{
            host_id: 'default-host',
            ascii_host_url: 'https://default.com/',
            unicode_host_url: 'https://default.com/',
            verified: true,
          }],
        }));

      await client.resolveDefaultHost('https://default.com/');

      expect(client.resolveHostId()).toBe('default-host');
    });

    it('throws when no hostId and no default', () => {
      expect(() => client.resolveHostId()).toThrow(YandexWebmasterError);
    });
  });

  // --- HTTP method construction ---

  describe('request headers and URL construction', () => {
    beforeEach(() => {
      // Pre-cache userId to avoid extra fetch call
      fetchMock.mockResolvedValueOnce(mockResponse(200, { user_id: 42 }));
    });

    it('constructs GET requests with correct URL and auth header', async () => {
      await client.getUserId(); // caches userId=42

      fetchMock.mockResolvedValueOnce(mockResponse(200, { hosts: [] }));

      await client.listHosts();

      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.test.com/v4/user/42/hosts',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'OAuth test-token',
            'Accept': 'application/json',
          }),
        }),
      );
    });

    it('constructs POST requests with JSON body', async () => {
      await client.getUserId();

      fetchMock.mockResolvedValueOnce(mockResponse(200, {
        sitemap_id: 's1',
        url: 'https://example.com/sitemap.xml',
      }));

      await client.addSitemap('h1', 'https://example.com/sitemap.xml');

      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.test.com/v4/user/42/hosts/h1/user-added-sitemaps',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'https://example.com/sitemap.xml' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    // Гейт форка: деструктивные операции вырезаны, и DELETE-хелперов в клиенте
    // нет вовсе. Тест держит это свойство — если метод вернут, тест упадёт.
    it('exposes no destructive API methods', () => {
      const removed = [
        'addHost',
        'deleteHost',
        'verifyHost',
        'deleteSitemap',
        'deleteOriginalText',
        'batchRemoveFeeds',
      ];

      for (const method of removed) {
        expect(client[method as keyof typeof client]).toBeUndefined();
      }
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('throws AuthError on 401 response', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(401, { error_code: 'AUTH', error_message: 'Unauthorized' }),
      );

      await expect(client.getUserId()).rejects.toThrow(AuthError);
    });

    it('throws NotFoundError on 404 response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { user_id: 1 }));

      fetchMock.mockResolvedValueOnce(
        mockResponse(404, { error_code: 'NOT_FOUND', error_message: 'Sitemap not found' }),
      );

      await expect(client.getSitemap('h1', 'bad-id')).rejects.toThrow(NotFoundError);
    });

    it('throws RateLimitError on 429 response', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(429, { error_message: 'Rate limit exceeded' }),
      );

      await expect(client.getUserId()).rejects.toThrow(RateLimitError);
    });

    it('throws ServerError on 500 response', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(500, { error_message: 'Internal server error' }),
      );

      await expect(client.getUserId()).rejects.toThrow(ServerError);
    });

    it('throws ValidationError on 400 response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { user_id: 1 }));

      fetchMock.mockResolvedValueOnce(
        mockResponse(400, { error_code: 'INVALID', error_message: 'Bad request' }),
      );

      await expect(
        client.addSitemap('h1', ''),
      ).rejects.toThrow(ValidationError);
    });
  });

  // --- API methods ---

  describe('API methods', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { user_id: 10 }));
      await client.getUserId();
    });

    it('listSitemaps constructs correct path', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { sitemaps: [] }));

      await client.listSitemaps('h1');

      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.test.com/v4/user/10/hosts/h1/sitemaps',
        expect.any(Object),
      );
    });

    it('addSitemap sends POST with url body', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, {
        sitemap_id: 's1',
        sitemap_url: 'https://ex.com/sitemap.xml',
        added_date: '2024-01-01',
      }));

      const result = await client.addSitemap('h1', 'https://ex.com/sitemap.xml');

      expect(result.sitemap_id).toBe('s1');
      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.test.com/v4/user/10/hosts/h1/user-added-sitemaps',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'https://ex.com/sitemap.xml' }),
        }),
      );
    });

    it('getIndexingHistory appends date range query params', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { history: [] }));

      await client.getIndexingHistory('h1', {
        date_from: '2024-01-01',
        date_to: '2024-02-01',
      });

      const calledUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(calledUrl).toContain('date_from=2024-01-01');
      expect(calledUrl).toContain('date_to=2024-02-01');
    });

    it('getIndexingSamples appends pagination params', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { samples: [] }));

      await client.getIndexingSamples('h1', { offset: 10, limit: 50 });

      const calledUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(calledUrl).toContain('offset=10');
      expect(calledUrl).toContain('limit=50');
    });

    // Регрессия: /search-queries/popular отвечает 400 «order_by: This field is
    // required», если параметр не отправлен. В апстриме он не прокидывался вовсе,
    // из-за чего инструмент популярных запросов не работал в принципе.
    it('getPopularQueries sends order_by', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { queries: [] }));

      await client.getPopularQueries('h1', {
        date_from: '2026-07-25',
        date_to: '2026-08-01',
        query_indicator: 'TOTAL_SHOWS',
        order_by: 'TOTAL_CLICKS',
      });

      const calledUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(calledUrl).toContain('/search-queries/popular');
      expect(calledUrl).toContain('order_by=TOTAL_CLICKS');
    });

    it('getSearchQueries appends all query params', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { queries: [] }));

      await client.getSearchQueries('h1', {
        date_from: '2024-01-01',
        date_to: '2024-02-01',
        query_indicator: 'TOTAL_CLICKS',
        device_type_indicator: 'DESKTOP',
      });

      const calledUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(calledUrl).toContain('query_indicator=TOTAL_CLICKS');
      expect(calledUrl).toContain('device_type_indicator=DESKTOP');
    });

    it('addRecrawlTask sends POST with url body', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, {
        task_id: 't1',
        url: 'https://ex.com/page',
        added_date: '2024-01-01',
      }));

      const result = await client.addRecrawlTask('h1', 'https://ex.com/page');

      expect(result.task_id).toBe('t1');
      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.test.com/v4/user/10/hosts/h1/recrawl/queue',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'https://ex.com/page' }),
        }),
      );
    });

    it('getRecrawlTask reads a single task under the queue path', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, {
        task_id: 't1',
        url: 'https://ex.com/page',
        added_date: '2024-01-01',
      }));

      await client.getRecrawlTask('h1', 't1');

      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.test.com/v4/user/10/hosts/h1/recrawl/queue/t1',
        expect.anything(),
      );
    });

    it('getDiagnostics reads the diagnostics path', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { problems: [] }));

      await client.getDiagnostics('h1');

      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.test.com/v4/user/10/hosts/h1/diagnostics',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
