import { APIInteractionResponse, InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { LambdaFunctionURLHandler, LambdaFunctionURLResult } from "aws-lambda";
import { verifyInteractionRequest } from "@/discord/verify-request";
import * as commands from '@/discord/commands';
import { Command } from "@/types/discord";
import { env } from '@/env';

const CommandNotFoundResponse: APIInteractionResponse = {
  type: InteractionResponseType.ChannelMessageWithSource,
  data: {
    content: 'Something went wrong. Command not found',
  },
};

const JsonResponse = (resp: APIInteractionResponse): LambdaFunctionURLResult => {
  return {
    body: JSON.stringify(resp),
    headers: { 'content-type': 'application/json' },
    statusCode: 200,
  }
}

// For some reason SST blacklists the TZ variable which affects running in dev mode
// https://github.com/sst/ion/blob/92e13dc027f01cbeef0c3ad8c6b402f21adef028/platform/functions/bridge/bridge.go#L54
process.env.TZ = env.TZ;

export const handler: LambdaFunctionURLHandler = async (event) => {
  const verifyResult = await verifyInteractionRequest(event, env.DISCORD_APP_PUBLIC_KEY);

  if (!verifyResult.isValid || !verifyResult.interaction) {
    return { statusCode: 401, body: 'Invalid request' };
  }

  const { interaction } = verifyResult;

  if (interaction.type === InteractionType.Ping) {
    return JsonResponse({ type: InteractionResponseType.Pong })
  }

  // Currently no need to support these interaction types
  if (interaction.type === InteractionType.MessageComponent || interaction.type === InteractionType.ModalSubmit) {
    return JsonResponse(CommandNotFoundResponse);
  }

  const command: Command | undefined = Object.values(commands).find(({ register }) => {
    return register.name === interaction.data.name;
  });

  if (command === undefined) {
    return JsonResponse(CommandNotFoundResponse);
  }

  return JsonResponse(await command.execute(interaction));
}
