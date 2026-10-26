import { createPlugin } from './src/plugin';

// OpenCode calls the default export as the plugin factory.
// Only a single value export is allowed — multiple exports get instantiated as separate plugins.
export default createPlugin;

// Re-export types for consumers
export type { RateLimitFallbackConfig, FallbackModel, FallbackModelObject } from './src/config';
