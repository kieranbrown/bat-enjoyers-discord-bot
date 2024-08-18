import { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIInteractionResponse } from "discord-api-types/v10";
import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "@discordjs/builders";

export type ExecuteCommand = (
  interaction: APIApplicationCommandAutocompleteInteraction | APIApplicationCommandInteraction,
) => Promise<APIInteractionResponse>

export type Command = {
  register: SlashCommandBuilder | SlashCommandSubcommandBuilder,
  execute: ExecuteCommand,
}
