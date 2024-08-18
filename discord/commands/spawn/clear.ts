import { ExecuteCommand } from "@/types/discord";
import { SlashCommandSubcommandBuilder } from "@discordjs/builders";
import { REST } from '@discordjs/rest';
import { env } from "@/env";

import {
  InteractionResponseType,
  RESTGetAPIChannelMessagesQuery,
  RESTGetAPIChannelMessagesResult,
  RESTPostAPIChannelMessagesBulkDeleteJSONBody,
  Routes,
} from "discord-api-types/v10";

const discord = new REST();
discord.setToken(env.DISCORD_BOT_TOKEN);

export const register = new SlashCommandSubcommandBuilder()
  .setName('clear')
  .setDescription('Clear the last registered spawn');

export const execute: ExecuteCommand = async () => {
  // todo: cancel all in-progress step function invocations

  let messages = await discord.get(Routes.channelMessages(env.DISCORD_WINDOW_UPDATES_CHANNEL_ID), {
    query: new URLSearchParams({
      // @ts-expect-error https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1568
      limit: '100',
    } satisfies RESTGetAPIChannelMessagesQuery),
  }) as RESTGetAPIChannelMessagesResult;

  // Filter the messages to ones posted by the BOT
  messages = messages.filter((message) => message.author.id === env.DISCORD_APP_ID);

  if (messages.length === 1) {
    // For a single message result just call the delete endpoint. The discord bulk delete API
    // does not handle deleting a single message, so this has to be handled separately.
    await discord.delete(Routes.channelMessage(env.DISCORD_WINDOW_UPDATES_CHANNEL_ID, messages[0].id));
  }

  if (messages.length >= 2) {
    // If for whatever reason the bot has multiple messages in the channel, bulk delete them all
    await discord.post(Routes.channelBulkDelete(env.DISCORD_WINDOW_UPDATES_CHANNEL_ID), {
      body: {
        messages: messages.map((message) => message.id),
      } as RESTPostAPIChannelMessagesBulkDeleteJSONBody
    });
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: 'Spawn window reset. Use the `/spawn register` command to register the last known spawn.',
    },
  };
}
