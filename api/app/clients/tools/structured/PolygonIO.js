const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { getEnvironmentVariable } = require('@langchain/core/utils/env');
const fetch = require('node-fetch');

/**
 * Polygon.io Tool for authorized endpoints.
 * 
 * Available Actions (based on current API key permissions):
 *   - help:                   Show available endpoints and usage.
 *   - prev_aggregate:         Fetch the previous trading day's aggregate for a given ticker.
 *   - list_tickers:           Fetch a paginated list of active stock tickers.
 *   - ticker_types:           Fetch all supported stock asset types.
 *   - related_companies:      Fetch companies related to a given ticker.
 *   - exchanges:              Fetch all U.S. stock exchanges.
 *   - marketstatus_upcoming:  Fetch upcoming trading sessions (holidays, early closes).
 *   - marketstatus_now:       Fetch current market status (open/closed).
 *   - conditions:             Fetch a list of stock trade/quote condition codes.
 *   - short_interest:         Fetch short interest data for stocks (limited to 10).
 * 
 * Note: Any attempt to call an endpoint not authorized by the API key (e.g., /v2/last/trade)
 * will return a 403-like payload with status "NOT_AUTHORIZED". In that case, the tool
 * will forward a user-friendly error message indicating the plan upgrade link.
 * 
 * Required environment variable: POLYGON_API_KEY
 */

class PolygonIO extends Tool {
  name = 'polygon_io';
  description =
    'Provides Polygon.io data for authorized endpoints. ' +
    'Actions: help, prev_aggregate, list_tickers, ticker_types, related_companies, exchanges, ' +
    'marketstatus_upcoming, marketstatus_now, conditions, short_interest. ' +
    'Parameters: "symbol" (string, required for prev_aggregate & related_companies), ' +
    '"limit", "sort", etc. for other actions as needed.';

  schema = z.object({
    action: z.enum([
      'help',
      'prev_aggregate',
      'list_tickers',
      'ticker_types',
      'related_companies',
      'exchanges',
      'marketstatus_upcoming',
      'marketstatus_now',
      'conditions',
      'short_interest',
    ]),
    symbol: z.string().optional(),     // e.g., "AAPL"
    limit: z.number().optional(),      // e.g., 10
    sort: z.string().optional(),       // e.g., "ticker.asc"
    // Additional parameters can be added here if needed.
  });

  constructor(fields = {}) {
    super();
    this.envVar = 'POLYGON_API_KEY';
    this.override = fields.override ?? false;
    this.apiKey = fields[this.envVar] ?? this.getApiKey();
    this.baseUrl = 'https://api.polygon.io';
  }

  getApiKey() {
    const key = getEnvironmentVariable(this.envVar);
    if (!key && !this.override) {
      throw new Error(`Missing ${this.envVar} environment variable.`);
    }
    return key;
  }

  async _call(rawArgs) {
    try {
      const { action, symbol, limit, sort } = rawArgs;

      if (action === 'help') {
        return JSON.stringify(
          {
            title: 'Polygon.io Tool Help',
            description:
              'Available actions:\n' +
              '- help: Show this help message.\n' +
              '- prev_aggregate: Get the previous trading day’s aggregate for a given ticker.\n' +
              '- list_tickers: Get a paginated list of active stock tickers (market=stocks, active=true).\n' +
              '- ticker_types: Get all supported asset types for stocks.\n' +
              '- related_companies: Get companies related to a given ticker.\n' +
              '- exchanges: Get all U.S. stock exchanges.\n' +
              '- marketstatus_upcoming: Get upcoming trading sessions (holidays, early closes).\n' +
              '- marketstatus_now: Get current market status (open/closed).\n' +
              '- conditions: Get a list of stock trade/quote condition codes.\n' +
              '- short_interest: Get short interest data for stocks (limit up to 10, sort=ticker.asc).\n',
            endpoints: {
              prev_aggregate: {
                endpoint: '/v2/aggs/ticker/{symbol}/prev?adjusted=true',
                required_params: ['symbol'],
                example: { action: 'prev_aggregate', symbol: 'AAPL' },
                notes: 'Returns the previous day’s OHLC, volume, and VWAP.',
              },
              list_tickers: {
                endpoint: '/v3/reference/tickers?market=stocks&active=true&order=asc&limit={limit}&sort=ticker',
                required_params: ['limit', 'sort'],
                example: { action: 'list_tickers', limit: 100, sort: 'ticker' },
                notes: 'Returns up to {limit} active stock tickers, sorted ascending by ticker symbol.',
              },
              ticker_types: {
                endpoint: '/v3/reference/tickers/types?asset_class=stocks&locale=us',
                required_params: [],
                example: { action: 'ticker_types' },
                notes: 'Returns all supported asset types for U.S. stocks.',
              },
              related_companies: {
                endpoint: '/v1/related-companies/{symbol}',
                required_params: ['symbol'],
                example: { action: 'related_companies', symbol: 'AAPL' },
                notes: 'Returns companies related to the given ticker.',
              },
              exchanges: {
                endpoint: '/v3/reference/exchanges?asset_class=stocks&locale=us',
                required_params: [],
                example: { action: 'exchanges' },
                notes: 'Returns U.S. stock exchange identifiers and metadata.',
              },
              marketstatus_upcoming: {
                endpoint: '/v1/marketstatus/upcoming',
                required_params: [],
                example: { action: 'marketstatus_upcoming' },
                notes: 'Returns the schedule of upcoming trading sessions (holidays, early closes).',
              },
              marketstatus_now: {
                endpoint: '/v1/marketstatus/now',
                required_params: [],
                example: { action: 'marketstatus_now' },
                notes: 'Returns the current market status (open or closed) and session details.',
              },
              conditions: {
                endpoint: '/v3/reference/conditions?asset_class=stocks&order=asc&limit={limit}&sort=asset_class',
                required_params: ['limit', 'sort'],
                example: { action: 'conditions', limit: 10, sort: 'asset_class' },
                notes: 'Returns up to {limit} stock trade/quote condition codes, sorted by asset class.',
              },
              short_interest: {
                endpoint: '/stocks/v1/short-interest?limit={limit}&sort={sort}',
                required_params: ['limit', 'sort'],
                example: { action: 'short_interest', limit: 10, sort: 'ticker.asc' },
                notes: 'Returns short interest data for up to {limit} symbols, sorted by the given field.',
              },
            },
            errors: [
              '400: Bad Request (missing/invalid params)',
              '401: Unauthorized (invalid API key)',
              '403: NOT_AUTHORIZED (plan does not include this endpoint)',
              '404: Not Found (invalid symbol or resource)',
              '429: Too Many Requests (rate limited)',
              '5xx: Internal Server Error',
            ],
          },
          null,
          2
        );
      }

      // Validate required parameters per action
      let endpoint = '';
      switch (action) {
        case 'prev_aggregate':
          if (!symbol || typeof symbol !== 'string') {
            return 'Error: "symbol" (string) is required for prev_aggregate.';
          }
          endpoint = `/v2/aggs/ticker/${symbol.trim().toUpperCase()}/prev`;
          // Always request adjusted=true
          endpoint += '?adjusted=true';
          break;

        case 'list_tickers':
          if (typeof limit !== 'number' || !sort || typeof sort !== 'string') {
            return 'Error: "limit" (number) and "sort" (string) are required for list_tickers.';
          }
          endpoint = `/v3/reference/tickers?market=stocks&active=true&order=asc&limit=${limit}&sort=${sort}`;
          break;

        case 'ticker_types':
          endpoint = '/v3/reference/tickers/types?asset_class=stocks&locale=us';
          break;

        case 'related_companies':
          if (!symbol || typeof symbol !== 'string') {
            return 'Error: "symbol" (string) is required for related_companies.';
          }
          endpoint = `/v1/related-companies/${symbol.trim().toUpperCase()}`;
          break;

        case 'exchanges':
          endpoint = '/v3/reference/exchanges?asset_class=stocks&locale=us';
          break;

        case 'marketstatus_upcoming':
          endpoint = '/v1/marketstatus/upcoming';
          break;

        case 'marketstatus_now':
          endpoint = '/v1/marketstatus/now';
          break;

        case 'conditions':
          if (typeof limit !== 'number' || !sort || typeof sort !== 'string') {
            return 'Error: "limit" (number) and "sort" (string) are required for conditions.';
          }
          endpoint = `/v3/reference/conditions?asset_class=stocks&order=asc&limit=${limit}&sort=${sort}`;
          break;

        case 'short_interest':
          if (typeof limit !== 'number' || !sort || typeof sort !== 'string') {
            return 'Error: "limit" (number) and "sort" (string) are required for short_interest.';
          }
          // Note: this endpoint uses a different base path (/stocks/v1)
          endpoint = `/stocks/v1/short-interest?limit=${limit}&sort=${sort}`;
          break;

        default:
          return `Error: Unknown action: ${action}`;
      }

      // Build full URL
      let url = `${this.baseUrl}${endpoint}`;
      // Ensure apiKey is added as query param (avoid double '?')
      url += endpoint.includes('?') ? `&apiKey=${this.apiKey}` : `?apiKey=${this.apiKey}`;

      const response = await fetch(url);
      const json = await response.json();
      if (!response.ok) {
        // Handle NOT_AUTHORIZED case explicitly
        if (json.status === 'NOT_AUTHORIZED') {
          return `Error: You are not authorized to access this endpoint. Please upgrade your plan at https://polygon.io/pricing`;
        }
        // Otherwise, forward the status and message
        const message = json.error || json.detail || JSON.stringify(json);
        return `Error: Polygon.io request failed with status ${response.status}: ${message}`;
      }

      return JSON.stringify(json, null, 2);
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }
}

module.exports = PolygonIO;