import { Command, ExecuteCommand } from "@/types/discord";
import { ApplicationCommandOptionType, ApplicationCommandType, InteractionResponseType } from "discord-api-types/v10";

const UnknownErrorResponse: Awaited<ReturnType<ExecuteCommand>> = {
  type: InteractionResponseType.ChannelMessageWithSource,
  data: {
    content: 'Something went wrong. This command doesn\'t have a registered handler.',
  }
}

export const executeSubcommand = (subcommands: Record<string, Command>) => {
  const run: ExecuteCommand = async (interaction) => {
    if (interaction.data.type !== ApplicationCommandType.ChatInput) return UnknownErrorResponse;

    const option = interaction.data.options?.find((subcommand) => {
      return subcommand.type === ApplicationCommandOptionType.Subcommand;
    });

    if (option === undefined) return UnknownErrorResponse;

    for (const subcommand of Object.values(subcommands)) {
      if (subcommand.register.name === option.name) {
        return subcommand.execute(interaction);
      }
    }

    return UnknownErrorResponse;
  }

  return run;
}
