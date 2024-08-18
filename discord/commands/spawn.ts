import { SlashCommandBuilder } from "@discordjs/builders";
import * as subcommands from './spawn/index';
import { executeSubcommand } from '@/discord/execute-subcommand';

export const register = new SlashCommandBuilder()
  .setName('spawn')
  .setDescription('Operations related to spawns');

Object.values(subcommands).forEach(subcommand => register.addSubcommand(subcommand.register));

export const execute = executeSubcommand(subcommands);
