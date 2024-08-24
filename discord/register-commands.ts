import { Routes } from 'discord-api-types/v10';
import { discord } from '@/discord/client';
import * as commands from './commands';
import { env } from '@/env';

discord.put(Routes.applicationCommands(env.DISCORD_APP_ID), {
  body: Object.values(commands).map((command) => command.register.toJSON()),
});
