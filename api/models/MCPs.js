const { logger, getMCPManager } = require('~/config');
const { getCustomConfig } = require('~/server/services/Config');

module.exports = {
  /**
   * Retrieves the mcps asynchronously.
   * @returns {Promise<TGetMCPResponse>} An array of category objects.
   * @throws {Error} If there is an error retrieving the mcps.
   */
  getMCPs: async () => {
    try {
      const customConfig = await getCustomConfig();

      if (!customConfig?.mcpServers) {
        return [];
      }

      const mcpManager = getMCPManager();
      const mcpServers = await mcpManager.getServerNames();

      const defaultMCPServers =
        customConfig.mcpServerConfig?.defaultMCPServers || [];

      const defaultMCPSet = new Set(defaultMCPServers);

      const options = mcpServers.map((server) => ({
        name: server,
        isDefault: defaultMCPSet.has(server),
      }));

      console.log('MCPs:', options);
      return options;
    } catch (error) {
      logger.error('Error getting MCPs:', error);
      return [];
    }
  },
};
