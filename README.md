# Yandex Webmaster MCP Server — сборка для samuiguide.ru

MCP-сервер для [Yandex Webmaster API v4](https://yandex.ru/dev/webmaster/doc/ru/concepts/about).
Даёт агенту (Claude Code) доступ к индексации, картам сайта, переобходу, поисковой
статистике и диагностике сайта прямо из сессии.

Форк [weselow/Yandex-webmaster-mcp-server](https://github.com/weselow/Yandex-webmaster-mcp-server),
адаптированный под гайд по Самуи. Лицензия оригинала (MIT) сохранена.

## Чем отличается от оригинала

**Из сервера физически вырезаны все деструктивные операции.** Удалены не флагом и не
скрытием — удалены из кода, из регистрации инструментов и из HTTP-клиента:

| Убрано | Что делало в оригинале |
|---|---|
| `ywm_delete_host` | удаляло сайт из Вебмастера |
| `ywm_add_host` | добавляло новый сайт |
| `ywm_verify_host` | запускало проверку прав на сайт |
| `ywm_delete_sitemap` | удаляло карту сайта |
| `ywm_delete_original_text` | удаляло оригинальный текст |
| `ywm_batch_remove_feeds` | массово удаляло фиды |

Вместе с ними из клиента убраны сами HTTP-хелперы для `DELETE`. Сервер **не умеет
отправлять DELETE-запросы вообще** — ошибка или галлюцинация агента не может ничего
снести. Это свойство закреплено тестами: `tests/integration/server.test.ts` проверяет,
что вырезанные инструменты не зарегистрированы, а `tests/client/client.test.ts` — что
соответствующих методов нет у клиента.

Осталось **40 инструментов**. На запись из них работают только пять, и все —
неразрушающие: `ywm_add_sitemap`, `ywm_submit_recrawl`, `ywm_add_original_text`,
`ywm_start_feed_upload`, `ywm_batch_add_feeds`. Остальные 35 — чтение.

## Получение OAuth-токена

Токен выдаёт Яндекс ID, а не Вебмастер. Нужен скоуп **`webmaster:hostinfo`** — он даёт
чтение статистики и информации о сайтах.

1. Откройте [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new) под тем
   аккаунтом, **на котором подтверждены права на samuiguide.ru** в Вебмастере.
2. Тип приложения — «Веб-сервисы». Имя — любое, например `samui-guide-mcp`.
3. В разделе «Доступы» найдите **Яндекс.Вебмастер** и отметьте
   **`webmaster:hostinfo`** (просмотр информации о сайтах и статистики).
   Скоуп `webmaster:verify` **не отмечайте** — он нужен только для подтверждения
   прав, а эта операция из форка вырезана.
4. Redirect URI укажите `https://oauth.yandex.ru/verification_code`.
5. Сохраните приложение и скопируйте его **ClientID**.
6. Откройте в браузере, подставив свой ClientID:

   ```
   https://oauth.yandex.ru/authorize?response_type=token&client_id=ВАШ_CLIENT_ID
   ```

7. Подтвердите доступ — токен появится в адресной строке и на странице.
   Он длинный, вида `y0_AgAAAA...`, и живёт около года.

Токен — это полноценный доступ к данным вашего сайта в Вебмастере.
**В git его не коммитить, в чат не вставлять, в тикеты не копировать.**
Если засветился — отзовите приложение на [oauth.yandex.ru](https://oauth.yandex.ru/)
и выпустите новый.

## Установка

```bash
git clone https://github.com/P4PAZOL/yandex-webmaster-mcp-samui.git
cd yandex-webmaster-mcp-samui
npm install
npm run build
```

Настройка окружения:

```bash
cp .env.example .env
# впишите токен в .env — этот файл в .gitignore и в git не попадёт
```

| Переменная | Назначение |
|---|---|
| `YANDEX_WEBMASTER_OAUTH_TOKEN` | OAuth-токен. Обязательна: без неё сервер не стартует |
| `YANDEX_WEBMASTER_HOST_URL` | Сайт по умолчанию, `https://samuiguide.ru`. Пока задана, `host_id` можно не передавать в каждый вызов |

Токен читается **только** из переменной окружения, никуда не пишется и не логируется.
Все запросы уходят на единственный хост — `https://api.webmaster.yandex.net`.

## Подключение к samui-guide

В корне проекта `samui-guide` создайте `.mcp.json`:

```json
{
  "mcpServers": {
    "yandex-webmaster": {
      "command": "node",
      "args": ["/Users/macair/Projects/opt/yandex-webmaster-mcp-samui/dist/index.js"],
      "env": {
        "YANDEX_WEBMASTER_OAUTH_TOKEN": "y0_AgAAAA...",
        "YANDEX_WEBMASTER_HOST_URL": "https://samuiguide.ru"
      }
    }
  }
}
```

**`.mcp.json` содержит токен — добавьте его в `.gitignore` проекта samui-guide.**

Если держать токен в конфиге не хочется, уберите блок `env` и экспортируйте
переменные в окружение, из которого запускается Claude Code.

После правки конфига перезапустите Claude Code и проверьте подключение
командой `/mcp` — сервер должен отдать 40 инструментов.

## Инструменты

### Сайты и диагностика

| Инструмент | Что делает |
|---|---|
| `ywm_list_hosts` | Список сайтов аккаунта с их `host_id` |
| `ywm_get_host` | Детали сайта по `host_id` |
| `ywm_get_host_summary` | Сводка: ИКС, число страниц в поиске, счётчик проблем |
| `ywm_get_diagnostics` | Диагностика: ошибки и предупреждения по сайту |
| `ywm_get_verification` | Статус подтверждения прав (только чтение) |
| `ywm_list_owners` | Кто подтвердил права на сайт |
| `ywm_get_user` | ID текущего пользователя API |

### Индексация

| Инструмент | Что делает |
|---|---|
| `ywm_get_indexing_history` | История индексации по датам |
| `ywm_get_indexing_samples` | Образцы обойдённых URL с HTTP-кодами |
| `ywm_get_search_urls` | Страницы, находящиеся в поиске |
| `ywm_get_search_urls_history` | Динамика числа страниц в поиске |
| `ywm_get_search_events_samples` | Исключённые страницы с причиной (`LOW_QUALITY`, `DUPLICATE` и т.п.) |
| `ywm_get_search_events_history` | История добавления и исключения страниц |
| `ywm_get_important_urls` | Важные URL с проблемами |
| `ywm_get_important_urls_history` | История по важным URL |

### Карты сайта

| Инструмент | Что делает |
|---|---|
| `ywm_list_sitemaps` | Все карты сайта, известные Яндексу |
| `ywm_get_sitemap` | Статус конкретной карты: когда обойдена, сколько URL, ошибки |
| `ywm_list_user_sitemaps` | Карты, добавленные вручную через API или интерфейс |
| `ywm_get_user_sitemap` | Статус вручную добавленной карты |
| `ywm_add_sitemap` | Добавить карту сайта *(запись)* |

### Переобход

| Инструмент | Что делает |
|---|---|
| `ywm_submit_recrawl` | Отправить URL на переобход *(запись, тратит суточную квоту)* |
| `ywm_get_recrawl_task` | Статус конкретной задачи переобхода |
| `ywm_list_recrawl_tasks` | Очередь переобхода |
| `ywm_get_recrawl_quota` | Остаток суточной квоты на переобход |

### Поисковая статистика

| Инструмент | Что делает |
|---|---|
| `ywm_get_popular_queries` | Популярные запросы: показы, клики, средние позиции |
| `ywm_get_search_queries` | История по всем запросам за период |
| `ywm_get_query_history` | История по одному конкретному запросу |
| `ywm_query_analytics` | Аналитика запросов с фильтрами |
| `ywm_get_sqi_history` | История ИКС |
| `ywm_get_external_links` | Образцы внешних ссылок на сайт |
| `ywm_get_external_links_history` | Динамика внешних ссылок |
| `ywm_get_broken_internal_links` | Битые внутренние ссылки |
| `ywm_get_broken_links_history` | Динамика битых ссылок |

### Оригинальные тексты и фиды

| Инструмент | Что делает |
|---|---|
| `ywm_get_original_texts` | Список оригинальных текстов |
| `ywm_add_original_text` | Добавить оригинальный текст *(запись)* |
| `ywm_get_original_text_quota` | Квота на оригинальные тексты |
| `ywm_list_feeds` | Список товарных фидов |
| `ywm_start_feed_upload` | Запустить загрузку фида *(запись)* |
| `ywm_get_feed_upload_status` | Статус загрузки фида |
| `ywm_batch_add_feeds` | Массово добавить фиды *(запись)* |

## Примеры запросов к агенту

- «Какие проблемы Вебмастер видит на samuiguide.ru?»
- «Сколько страниц в поиске и какая динамика за последний месяц?»
- «Покажи страницы, исключённые как малоценные»
- «Проверь статус карты сайта — когда её последний раз обходили»
- «Отправь на переобход /places/ и покажи остаток квоты»
- «Топ-30 поисковых запросов за последнюю неделю по кликам»

## Разработка

```bash
npm test          # 208 тестов, vitest, сеть замокана
npm run build     # сборка в dist/
npx tsc --noEmit  # проверка типов
```

Тесты не ходят в сеть и не требуют токена.

## Обновление из upstream

```bash
git fetch upstream
git merge upstream/master
```

При обновлении **проверяйте, не вернулись ли деструктивные инструменты** — тесты
`destructive tools are not registered` и `exposes no destructive API methods` упадут,
если это случится. Не «чините» их ослаблением проверки: вырежьте инструмент заново.
