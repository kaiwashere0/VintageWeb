import TelemetryService from '../telemetry/index.js';

class TruckersMPClient {
  constructor() {
    this.baseUrl = process.env.TRUCKERSMP_API_BASE_URL || 'https://api.truckersmp.com/v2';
    this.cache = new Map();
    this.defaultCacheTTL = 60 * 1000; // 1 minute default
  }

  /**
   * Internal cached request wrapper with telemetry tracking
   */
  async request(endpoint, ttlMs = this.defaultCacheTTL) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const cacheKey = url;

    // Check in-memory cache
    if (ttlMs > 0 && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ttlMs) {
        return { fromCache: true, ...cached.data };
      }
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VintageClubWebPlatform/2.0 (+https://vintageclub.com)'
        }
      });
      clearTimeout(timeoutId);

      const durationMs = Date.now() - start;
      const json = await res.json();

      TelemetryService.recordRequest({
        id: 'tmp_' + Math.random().toString(36).substring(2, 9),
        method: 'GET',
        path: `[TMP Upstream] ${endpoint}`,
        status: res.status,
        durationMs,
        ip: '127.0.0.1',
        timestamp: new Date().toISOString(),
        time: start
      });

      if (!res.ok && json.error) {
        TelemetryService.logError('TruckersMP Web API', `HTTP ${res.status}: ${json.descriptor || json.response || 'Upstream Error'}`, '', 'WARN', { endpoint, status: res.status });
      }

      // Save to cache
      if (ttlMs > 0 && res.ok) {
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          data: json
        });
      }

      return { fromCache: false, ...json };
    } catch (err) {
      const durationMs = Date.now() - start;
      TelemetryService.logError('TruckersMP Web API', `Request failed on ${endpoint}: ${err.message}`, err.stack, 'ERROR', { endpoint });
      return {
        error: true,
        message: err.message,
        descriptor: 'Failed to communicate with TruckersMP Web API v2'
      };
    }
  }

  /**
   * 1. Player Info & Profile Lookup
   */
  async getPlayer(id) {
    if (!id) return { error: true, descriptor: 'Player ID or SteamID64 is required.' };
    return this.request(`/player/${encodeURIComponent(id)}`, 5 * 60 * 1000); // 5 min cache
  }

  /**
   * 2. Player Bans History
   */
  async getBans(id) {
    if (!id) return { error: true, descriptor: 'Player ID or SteamID64 is required.' };
    return this.request(`/bans/${encodeURIComponent(id)}`, 2 * 60 * 1000); // 2 min cache
  }

  /**
   * 3. Live Server Status
   */
  async getServers() {
    return this.request('/servers', 30 * 1000); // 30 sec cache
  }

  /**
   * 4. In-game Simulation Time
   */
  async getGameTime() {
    return this.request('/game_time', 15 * 1000); // 15 sec cache
  }

  /**
   * 5. Current, Upcoming & Featured Events
   */
  async getEvents() {
    return this.request('/events', 5 * 60 * 1000); // 5 min cache
  }

  /**
   * 6. Specific Event Details
   */
  async getEvent(id) {
    return this.request(`/events/${encodeURIComponent(id)}`, 5 * 60 * 1000);
  }

  /**
   * 7. Event Slots
   */
  async getEventSlots(id) {
    return this.request(`/events/${encodeURIComponent(id)}/slots`, 5 * 60 * 1000);
  }

  /**
   * 8. User Events
   */
  async getUserEvents(userId) {
    return this.request(`/events/user/${encodeURIComponent(userId)}`, 5 * 60 * 1000);
  }

  /**
   * 9. VTC Index (Featured & Recent VTCs)
   */
  async getVTCIndex() {
    return this.request('/vtc', 10 * 60 * 1000);
  }

  /**
   * 10. Specific VTC Details
   */
  async getVTC(vtcId) {
    return this.request(`/vtc/${encodeURIComponent(vtcId)}`, 10 * 60 * 1000);
  }

  /**
   * 11. VTC Members List
   */
  async getVTCMembers(vtcId) {
    return this.request(`/vtc/${encodeURIComponent(vtcId)}/members`, 5 * 60 * 1000);
  }

  /**
   * 12. Specific VTC Member Details
   */
  async getVTCMember(vtcId, memberId) {
    return this.request(`/vtc/${encodeURIComponent(vtcId)}/member/${encodeURIComponent(memberId)}`, 5 * 60 * 1000);
  }

  /**
   * 13. VTC Roles
   */
  async getVTCRoles(vtcId) {
    return this.request(`/vtc/${encodeURIComponent(vtcId)}/roles`, 10 * 60 * 1000);
  }

  /**
   * 14. VTC News
   */
  async getVTCNews(vtcId) {
    return this.request(`/vtc/${encodeURIComponent(vtcId)}/news`, 10 * 60 * 1000);
  }

  /**
   * 15. VTC Events
   */
  async getVTCEvents(vtcId) {
    return this.request(`/vtc/${encodeURIComponent(vtcId)}/events`, 5 * 60 * 1000);
  }

  /**
   * 16. Current TruckersMP Game Version
   */
  async getVersion() {
    return this.request('/version', 15 * 60 * 1000);
  }

  /**
   * 17. In-game Rules
   */
  async getRules() {
    return this.request('/rules', 60 * 60 * 1000); // 1 hour cache
  }

  /**
   * Flush in-memory cache
   */
  flushCache() {
    const size = this.cache.size;
    this.cache.clear();
    return { success: true, clearedEntries: size };
  }
}

const TruckersMPService = new TruckersMPClient();
export default TruckersMPService;
export { TruckersMPService };
