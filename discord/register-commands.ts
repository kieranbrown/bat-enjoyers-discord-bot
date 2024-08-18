import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import * as commands from './commands';
import { env } from '@/env';

(async () => {
  const rest = new REST({ version: '10' }).setToken(
    env.DISCORD_BOT_TOKEN,
  );

  await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), {
    body: Object.values(commands).map((command) => command.register.toJSON()),
  });
})()
