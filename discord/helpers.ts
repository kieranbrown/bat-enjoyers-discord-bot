import { APIApplicationCommandInteraction, ApplicationCommandOptionType, ApplicationCommandType } from "discord-api-types/v10";

export const ParseOptions = (interaction: APIApplicationCommandInteraction) => {
  if (interaction.data.type !== ApplicationCommandType.ChatInput) return {};

  return (interaction.data.options?.reduce((acc, option) => {
    if (option.type !== ApplicationCommandOptionType.Subcommand) return acc;

    option.options?.forEach(({ name, value }) => {
      acc[name] = value;
    });

    return acc;
  }, {} as Record<string, string | number | boolean>) ?? {});
}
