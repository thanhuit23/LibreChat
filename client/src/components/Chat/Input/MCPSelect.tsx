import React, { memo, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { Constants, EModelEndpoint, LocalStorageKeys } from 'librechat-data-provider';
import { useAvailableToolsQuery, useGetMCP } from '~/data-provider';
import useLocalStorage from '~/hooks/useLocalStorageAlt';
import MultiSelect from '~/components/ui/MultiSelect';
import { ephemeralAgentByConvoId } from '~/store';
import MCPIcon from '~/components/ui/MCPIcon';
import { useLocalize } from '~/hooks';

const loadingMCPServers: { name: string; isDefault: boolean }[] = [
  {
    name: 'time',
    isDefault: true,
  },
];

const storageCondition = (value: unknown, rawCurrentValue?: string | null) => {
  if (rawCurrentValue) {
    try {
      const currentValue = rawCurrentValue?.trim() ?? '';
      if (currentValue.length > 2) {
        return true;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return Array.isArray(value) && value.length > 0;
};

function MCPSelect({ conversationId }: { conversationId?: string | null }) {
  const localize = useLocalize();
  const key = conversationId ?? Constants.NEW_CONVO;
  const hasSetFetched = useRef<string | null>(null);

  const { data: mcpServerSet, isFetched } = useAvailableToolsQuery(EModelEndpoint.agents, {
    select: (data) => {
      const serverNames = new Set<string>();
      data.forEach((tool) => {
        const isMCP = tool.pluginKey.includes(Constants.mcp_delimiter);
        if (isMCP && tool.chatMenu !== false) {
          const parts = tool.pluginKey.split(Constants.mcp_delimiter);
          serverNames.add(parts[parts.length - 1]);
        }
      });
      return serverNames;
    },
  });

  const [ephemeralAgent, setEphemeralAgent] = useRecoilState(ephemeralAgentByConvoId(key));
  const mcpState = useMemo(() => {
    return ephemeralAgent?.mcp ?? [];
  }, [ephemeralAgent?.mcp]);

  const setSelectedValues = useCallback(
    (values: string[] | null | undefined) => {
      if (!values) {
        return;
      }
      if (!Array.isArray(values)) {
        return;
      }
      setEphemeralAgent((prev) => ({
        ...prev,
        mcp: values,
      }));
    },
    [setEphemeralAgent],
  );
  const [mcpValues, setMCPValues] = useLocalStorage<string[]>(
    `${LocalStorageKeys.LAST_MCP_}${key}`,
    mcpState,
    setSelectedValues,
    storageCondition,
  );

  const { data: mcpServersData = loadingMCPServers } = useGetMCP({
    select: (data) =>
      data.map((mcpServer) => ({
        name: mcpServer.name,
        isDefault: Boolean(mcpServer.isDefault), // Ensure boolean type
      })),
  });

  // Extract default server names from mcpServers where isDefault = true
  const defaultMCPServers = mcpServersData
    .filter(server => server.isDefault)
    .map(server => server.name);

  // Ensure defaultMCPServers is always an array of strings
  useEffect(() => {
    if (!mcpValues) {
      setMCPValues(defaultMCPServers);
      return;
    }
    const missingDefaults = defaultMCPServers.filter(server => !mcpValues.includes(server));
    if (missingDefaults.length > 0) {
      setMCPValues([...mcpValues, ...missingDefaults]);
    }
  }, [mcpValues, defaultMCPServers, setMCPValues]);

  // Effect to update mcpValues based on mcpServerSet
  useEffect(() => {
    if (hasSetFetched.current === key) {
      return;
    }
    if (!isFetched) {
      return;
    }
    hasSetFetched.current = key;
    if ((mcpServerSet?.size ?? 0) > 0) {
      setMCPValues(mcpValues.filter((mcp) => mcpServerSet?.has(mcp)));
      return;
    }
    setMCPValues([]);
  }, [isFetched, setMCPValues, mcpServerSet, key, mcpValues]);

  const renderSelectedValues = useCallback(
    (values: string[], placeholder?: string) => {
      // Check if "time" is in the values and remove it
      const filteredValues = values.filter(
        value => !defaultMCPServers.includes(value)
      );
      if (filteredValues.length === 0) {
        return placeholder || localize('com_ui_select') + '...';
      }
      if (filteredValues.length === 1) {
        return filteredValues[0];
      }
      return localize('com_ui_x_selected', { 0: filteredValues.length });
    },
    [localize],
  );

  const mcpServers = useMemo(() => {
    // Step 1: Create base list from set
    const servers = Array.from(mcpServerSet ?? []) as string[];

    // Step 2: If the set is empty or undefined, return null
    if (!mcpServerSet || mcpServerSet.size === 0) {
      return null;
    }

    // Step 3: If "time" exists in the real server list, remove it
    return servers.filter(server => !defaultMCPServers.includes(server));
  }, [mcpServerSet]);

  if (!mcpServerSet || mcpServerSet.size === 0) {
    return null;
  }

  return (
    <MultiSelect
      items={mcpServers ?? []}
      selectedValues={mcpValues ?? []}
      setSelectedValues={setMCPValues}
      defaultSelectedValues={mcpValues ?? []}
      renderSelectedValues={renderSelectedValues}
      placeholder={localize('com_ui_mcp_servers')}
      popoverClassName="min-w-fit"
      className="badge-icon min-w-fit"
      selectIcon={<MCPIcon className="icon-md text-text-primary" />}
      selectItemsClassName="border border-blue-600/50 bg-blue-500/10 hover:bg-blue-700/10"
      selectClassName="group relative inline-flex items-center justify-center md:justify-start gap-1.5 rounded-full border border-border-medium text-sm font-medium transition-all md:w-full size-9 p-2 md:p-3 bg-transparent shadow-sm hover:bg-surface-hover hover:shadow-md active:shadow-inner"
    />
  );
}

export default memo(MCPSelect);
