import { createPlugin } from './src/plugin';

export default {
  id: 'opencode-multi-model-fallback',
  server: async (ctx: any) => createPlugin(ctx),
  setup: async () => async () => {},
};
