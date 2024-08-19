import { ExecuteCommand } from "@/types/discord";
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { SlashCommandSubcommandBuilder } from "@discordjs/builders";
import { ParseOptions } from "@/discord/helpers";
import { REST } from '@discordjs/rest';
import { env } from "@/env";
import { execute as clearCommand } from './clear';
import { Resource } from 'sst';

import {
  APIApplicationCommandOptionChoice,
  APIInteractionResponse,
  InteractionResponseType,
  InteractionType,
  RESTPatchAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageResult,
  Routes,
  RouteBases,
} from "discord-api-types/v10";

const creatures = [
  { name: 'Aeonaxx', value: 'Aeonaxx' },
  { name: 'Blood Seeker', value: 'Blood Seeker' },
] as const satisfies APIApplicationCommandOptionChoice<string>[];

const locations = [
  { name: 'NE1', value: 'NE1' },
  { name: 'NW1', value: 'NW1' },
  { name: 'NW2', value: 'NW2' },
  { name: 'SE1', value: 'SE1' },
  { name: 'SW1', value: 'SW1' },
  { name: 'SW2', value: 'SW2' },
  { name: 'Unknown', value: 'Unknown' },
] as const satisfies APIApplicationCommandOptionChoice<string>[];

const InvalidTimeInputResponse: APIInteractionResponse = {
  type: InteractionResponseType.ChannelMessageWithSource,
  data: { content: 'Invalid time, please enter a valid string between 00:00-23:59' },
}

const discord = new REST();
discord.setToken(env.DISCORD_BOT_TOKEN);

const sfnClient = new SFNClient();

export const register = new SlashCommandSubcommandBuilder()
  .setName('register')
  .setDescription('Register a new Aeonaxx / Blood Seeker spawn')
  .addStringOption(option => option.setName('creature').setDescription('Select which creature spawned').addChoices(...creatures).setRequired(true))
  .addStringOption(option => option.setName('location').setDescription('Enter the spawn location').addChoices(...locations).setRequired(true))
  .addStringOption(option => option.setName('time').setDescription('Enter time of spawn (CEST timezone) in 00:00 format').setRequired(true));

export const execute: ExecuteCommand = async (interaction) => {
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    throw new Error('Something went wrong. This command does not expect autocomplete requests.')
  }

  const { creature, time, location } = ParseOptions(interaction) as {
    creature: typeof creatures[number]['value']
    time: string
    location: typeof locations[number]['value']
  };

  if (/^([0-1]\d|2[0-3]):([0-5]\d)$/.test(time) === false) {
    return InvalidTimeInputResponse;
  }

  const [ hours, minutes ] = time.split(':').map(Number);

  const spawnDate = new Date(new Date().setHours(hours, minutes, 0, 0));
  if (spawnDate > new Date()) spawnDate.setDate(spawnDate.getDate() - 1);

  const spawnWindowBegin = new Date(new Date(spawnDate.getTime()).setHours(spawnDate.getHours() + 6));
  const spawnWindowEnd = new Date(new Date(spawnWindowBegin.getTime()).setHours(spawnWindowBegin.getHours() + 18));

  await clearCommand(interaction);

  const content = `${creature} ${location} ${time}`;

  if (interaction.channel.id !== env.DISCORD_SPAWN_ALERT_CHANNEL_ID) {
    // todo: this could be part of the step function to reduce invocation time here?
    await discord.post(Routes.channelMessages(env.DISCORD_SPAWN_ALERT_CHANNEL_ID), {
      body: { content } as RESTPostAPIChannelMessageJSONBody,
    });
  }

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // todo: this could be part of the step function to reduce invocation time here?
  const message = await discord.post(Routes.channelMessages(env.DISCORD_WINDOW_UPDATES_CHANNEL_ID), {
    body: {
      content: `:x: Spawn Window: ${formatTime(spawnWindowBegin)} - ${formatTime(spawnWindowEnd)} (${creature})`,
    } as RESTPostAPIChannelMessageJSONBody,
  }) as RESTPostAPIChannelMessageResult;

  const httpEndpoint = `${RouteBases.api}${Routes.channelMessage(env.DISCORD_WINDOW_UPDATES_CHANNEL_ID, message.id)}`;

  await sfnClient.send(new StartExecutionCommand({
    stateMachineArn: Resource.SpawnRegisteredStateMachine.arn,
    input: JSON.stringify({
      spawnWindowActive: {
        ISO8601: spawnWindowBegin.toISOString(),
        httpEndpoint,
        httpBody: JSON.stringify({
          content: `:white_check_mark: Spawn Window: ${formatTime(spawnWindowBegin)} - ${formatTime(spawnWindowEnd)} (${creature})`,
        } as RESTPatchAPIChannelMessageJSONBody),
      },
      spawnWindowClosed: {
        ISO8601: spawnWindowEnd.toISOString(),
        httpEndpoint,
        httpBody: JSON.stringify({
          content: ':grey_question: Spawn window unknown - register a spawn with `/spawn register`',
        } as RESTPatchAPIChannelMessageJSONBody),
      }
    }),
  }))

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content },
  }
}
