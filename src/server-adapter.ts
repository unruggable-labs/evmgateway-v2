import { createServerAdapter } from '@whatwg-node/server';
import { buildFetch, createGateway, paramsFromRollup } from './fetch.js';
import { UserConfig } from './types.js';
import { chainName } from './chains.js';

export const configureAdapter = async (userConfig: UserConfig) => {
  const port = userConfig.PORT || 8000;
  const prefetch = userConfig.SHOULD_PREFETCH;
  const gateway = await createGateway(userConfig);

  if (prefetch) {
    setInterval(() => gateway.getLatestCommit(), gateway.latestCache.cacheMs);
  }

  const config = {
    gateway: gateway.constructor.name,
    rollup: gateway.rollup.constructor.name,
    chain1: chainName(gateway.rollup.provider1._network.chainId),
    chain2: chainName(gateway.rollup.provider2._network.chainId),
    since: new Date(),
    ...paramsFromRollup(gateway.rollup), // experimental
  };

  console.log(new Date(), `Running ${config.rollup} on port ${port}`);

  const fetch = await buildFetch(gateway, config);

  return createServerAdapter(fetch);
};
