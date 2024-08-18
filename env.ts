import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  server: {
    DISCORD_APP_ID: z.string().min(1),
    DISCORD_APP_PUBLIC_KEY: z.string().min(1),
    DISCORD_BOT_TOKEN: z.string().min(1),
    DISCORD_SPAWN_ALERT_CHANNEL_ID: z.string().min(1),
    DISCORD_WINDOW_UPDATES_CHANNEL_ID: z.string().min(1),
    TZ: z.string().min(1).default('Europe/Berlin'),
  },
});
