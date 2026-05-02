export type { StrategyId, StrategyParams, WithdrawalFn, StrategyFactory } from './types';
export type { RmdParams } from './types';
export type { FixedPctParams } from './types';
export type { GkParams } from './types';
export type { HybridParams } from './types';

export { createRmd } from './rmd';
export { createFixedPct } from './fixed-percentage';
export { createGk } from './guyton-klinger';
export { createHybrid } from './hybrid';

import type { StrategyParams, WithdrawalFn } from './types';
import { createRmd } from './rmd';
import { createFixedPct } from './fixed-percentage';
import { createGk } from './guyton-klinger';
import { createHybrid } from './hybrid';

/**
 * Creates a withdrawalFn from a typed StrategyParams object.
 * This is the single dispatch point for the engine to obtain a strategy callback.
 */
export function createStrategy(params: StrategyParams): WithdrawalFn {
  switch (params.id) {
    case 'rmd':
      return createRmd(params);
    case 'fixedPct':
      return createFixedPct(params);
    case 'gk':
      return createGk(params);
    case 'hybrid':
      return createHybrid(params);
  }
}
