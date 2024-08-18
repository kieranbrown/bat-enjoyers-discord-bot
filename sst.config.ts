/// <reference path="./.sst/platform/config.d.ts" />

import { createEnv } from "@t3-oss/env-core";
import { env } from './env';
import { z } from "zod";

const SSTEnvironment = createEnv({
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  server: {
    CLOUDFLARE_API_TOKEN: z.string().min(1),
    CLOUDFLARE_ZONE_ID: z.string().min(1),
  },
});

export default $config({
  app(input) {
    return {
      name: "bat-enjoyers-discord-bot",
      home: "aws",
      providers: {
        aws: {
          region: "eu-west-2",
          version: "6.49.1",
          defaultTags: {
            tags: {}, // todo: define these
          },
        },
        cloudflare: {
          apiToken: SSTEnvironment.CLOUDFLARE_API_TOKEN,
          version: '5.35.1',
        },
      },
    };
  },
  async run() {
    const { stateMachineLinkable } = await import('@/packages/spawn-registered-sfn');

    const interaction = new sst.aws.Function('Interaction', {
      handler: 'app/interaction.handler',
      architecture: 'arm64',
      environment: env,
      link: [stateMachineLinkable],
      memory: '512 MB',
      nodejs: {
        minify: true,
      },
      timeout: '5 seconds',
      url: {
        authorization: 'none', // CloudFront does not sign POST requests to lambda, so this can't be protected
        cors: false,
      }
    });

    const cdn = new sst.aws.Cdn('CDN', {
      comment: `${$app.name} (${$app.stage})`,
      defaultCacheBehavior: {
        allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', "POST", 'PATCH', 'DELETE'],
        cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingDisabled
        compress: true,
        originRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac', // Managed-AllViewerExceptHostHeader
        responseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03', // Managed-SecurityHeadersPolicy
        targetOriginId: 'lambda',
        viewerProtocolPolicy: 'https-only',
      },
      domain: {
        name: { prod: 'bat-enjoyers.bots.kswb.uk' }[$app.stage] ?? `bat-enjoyers.bots.sst-stage-${$app.stage}.kswb.uk`,
        dns: sst.cloudflare.dns({
          zone: SSTEnvironment.CLOUDFLARE_ZONE_ID,
        }),
      },
      origins: [{
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: 'https-only',
          originSslProtocols: ['TLSv1.2'],
        },
        domainName: interaction.url.apply((url) => new URL(url).hostname),
        originId: 'lambda',
      }],
      transform: {
        distribution: {
          httpVersion: 'http2and3',
          priceClass: 'PriceClass_100',
        },
      },
    });

    new aws.lambda.Permission('InteractionAllowAll', {
      action: 'lambda:InvokeFunctionUrl',
      function: interaction.name,
      functionUrlAuthType: 'NONE',
      principal: '*',
      statementId: 'AllowAllPrincipal',
    });

    return {
      url: cdn.domainUrl
    }
  },
});
