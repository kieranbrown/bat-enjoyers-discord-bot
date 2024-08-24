import { ExecuteCommand } from "@/types/discord";
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { SlashCommandSubcommandBuilder } from "@discordjs/builders";
import { ParseOptions } from "@/discord/helpers";
import { clearDiscordMessages } from "./clear";
import { Resource } from 'sst';
import { env } from "@/env";

import {
  APIApplicationCommandOptionChoice,
  InteractionResponseType,
  InteractionType,
  RESTPatchAPIChannelMessageJSONBody,
  Routes,
  RouteBases,
} from "discord-api-types/v10";

const creatures = [
  { name: 'Aeonaxx', value: 'Aeonaxx' },
  { name: 'Blood Seeker', value: 'Blood Seeker' },
  { name: 'Server Reset', value: 'Server Reset' },
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

export const register = new SlashCommandSubcommandBuilder()
  .setName('register')
  .setDescription('Register a new Aeonaxx / Blood Seeker spawn')
  .addStringOption(option => option.setName('creature').setDescription('Select which creature spawned').addChoices(...creatures).setRequired(true))
  .addStringOption(option => option.setName('location').setDescription('Enter the spawn location').addChoices(...locations).setRequired(true))
  .addStringOption(option => option.setName('time').setDescription('Enter time of spawn (CEST timezone) in 00:00 format').setRequired(true));

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export const execute: ExecuteCommand = async (interaction) => {
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    throw new Error('Something went wrong. This command does not expect autocomplete requests.')
  }

  if (interaction.channel.id !== env.DISCORD_SPAWN_ALERT_CHANNEL_ID) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: `This command can only be executed in the <#${env.DISCORD_SPAWN_ALERT_CHANNEL_ID}> channel` },
    }
  }

  const { creature, location, time } = ParseOptions(interaction) as {
    creature: typeof creatures[number]['value']
    location: typeof locations[number]['value']
    time: string
  };

  if (/^([0-1]\d|2[0-3]):([0-5]\d)$/.test(time) === false) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: 'Invalid time, please enter a valid string between 00:00-23:59' },
    };
  }

  const [ hours, minutes ] = time.split(':').map(Number);

  const spawnDate = new Date(new Date().setHours(hours, minutes, 0, 0));
  if (spawnDate > new Date()) spawnDate.setDate(spawnDate.getDate() - 1);

  const spawnWindowBegin = new Date(new Date(spawnDate.getTime()).setHours(spawnDate.getHours() + 6));
  const spawnWindowEnd = new Date(new Date(spawnWindowBegin.getTime()).setHours(spawnWindowBegin.getHours() + 18));
  const spawnWindowMessage = `Spawn Window: ${formatTime(spawnWindowBegin)} - ${formatTime(spawnWindowEnd)} (${creature})`;

  // todo: defer this to run outside of this interaction - ideally first task of step function
  await clearDiscordMessages();

  await new SFNClient().send(new StartExecutionCommand({
    stateMachineArn: Resource.SpawnRegistered.arn,
    input: JSON.stringify({
      spawnWindow: {
        initialize: {
          httpEndpoint: `${RouteBases.api}${Routes.channelMessages(env.DISCORD_WINDOW_UPDATES_CHANNEL_ID)}`,
          httpBody: JSON.stringify({ content: `:x: ${spawnWindowMessage}` } as RESTPatchAPIChannelMessageJSONBody),
        },
        active: {
          date: spawnWindowBegin.toISOString(),
          httpBody: JSON.stringify({ content: `:white_check_mark: ${spawnWindowMessage}` } as RESTPatchAPIChannelMessageJSONBody),
        },
        closed: {
          date: spawnWindowEnd.toISOString(),
          httpBody: JSON.stringify({
            content: `:grey_question: Spawn window unknown - register a spawn with \`/spawn register\` in the <#${env.DISCORD_SPAWN_ALERT_CHANNEL_ID}> channel`,
          } as RESTPatchAPIChannelMessageJSONBody),
        },
      },
    }),
  }))

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content: `${creature} ${location} ${time}` },
  }
}
