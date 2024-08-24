import { REST } from '@discordjs/rest';
import { env } from '@/env';

export const discord = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN,);
