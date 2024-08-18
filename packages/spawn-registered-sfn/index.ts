/// <reference path="../../.sst/platform/config.d.ts" />
import { env } from "@/env";

const iamRole = new aws.iam.Role('SpawnRegisteredSfn', {
  name: `${$app.name}-${$app.stage}-spawn-registered-sfn`,
  assumeRolePolicy: {
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Action: 'sts:AssumeRole',
      Principal: {
        Service: 'states.amazonaws.com',
      },
    }],
  },
});

const eventConnection = new aws.cloudwatch.EventConnection("SpawnRegisteredSfn", {
  name: `${$app.name}-${$app.stage}-discord-api`,
  authorizationType: 'API_KEY',
  authParameters: {
    apiKey: {
      key: 'Authorization',
      value: `Bot ${env.DISCORD_BOT_TOKEN}`,
    }
  }
});

const stateMachine = new aws.sfn.StateMachine('SpawnRegistered', {
  name: `${$app.name}-${$app.stage}-spawn-registered`,
  roleArn: iamRole.arn,
  definition: $util.jsonStringify({
    "StartAt": "Parallel",
    "States": {
      "Parallel": {
        "Type": "Parallel",
        "End": true,
        "Branches": [
          {
            "StartAt": "WaitUntilSpawnWindowActive",
            "States": {
              "WaitUntilSpawnWindowActive": {
                "Type": "Wait",
                "Next": "SetSpawnWindowActive",
                "TimestampPath": "$.spawnWindowActive.ISO8601"
              },
              "SetSpawnWindowActive": {
                "Type": "Task",
                "Resource": "arn:aws:states:::http:invoke",
                "Parameters": {
                  "Method": "PATCH",
                  "Authentication": {
                    "ConnectionArn": eventConnection.arn,
                  },
                  "RequestBody.$": "$.spawnWindowActive.httpBody",
                  "ApiEndpoint.$": "$.spawnWindowActive.httpEndpoint",
                  "Headers": {
                    "Content-Type": "application/json"
                  }
                },
                "Retry": [
                  {
                    "ErrorEquals": [
                      "States.ALL"
                    ],
                    "BackoffRate": 2,
                    "IntervalSeconds": 1,
                    "MaxAttempts": 3,
                    "JitterStrategy": "FULL"
                  }
                ],
                "End": true
              }
            }
          },
          {
            "StartAt": "WaitUntilSpawnWindowClosed",
            "States": {
              "WaitUntilSpawnWindowClosed": {
                "Type": "Wait",
                "Next": "SetSpawnWindowClosed",
                "TimestampPath": "$.spawnWindowClosed.ISO8601"
              },
              "SetSpawnWindowClosed": {
                "Type": "Task",
                "Resource": "arn:aws:states:::http:invoke",
                "Parameters": {
                  "Method": "PATCH",
                  "ApiEndpoint.$": "$.spawnWindowClosed.httpEndpoint",
                  "Authentication": {
                    "ConnectionArn": eventConnection.arn,
                  },
                  "RequestBody.$": "$.spawnWindowClosed.httpBody",
                  "Headers": {
                    "Content-Type": "application/json"
                  }
                },
                "Retry": [
                  {
                    "ErrorEquals": [
                      "States.ALL"
                    ],
                    "BackoffRate": 2,
                    "IntervalSeconds": 1,
                    "MaxAttempts": 3,
                    "JitterStrategy": "FULL"
                  }
                ],
                "End": true
              }
            }
          }
        ]
      }
    }
  }),
});

new aws.iam.RolePolicy('SpawnRegisteredSfn', {
  role: iamRole.id,
  policy: aws.iam.getPolicyDocumentOutput({
    version: '2012-10-17',
    statements: [
      {
        actions: ['states:InvokeHTTPEndpoint'],
        resources: [stateMachine.arn],
      },
      {
        actions: ['events:RetrieveConnectionCredentials'],
        resources: [eventConnection.arn],
      },
      {
        actions: ['secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue'],
        resources: ['arn:aws:secretsmanager:*:*:secret:events!connection/*']
      }
    ]
  }).json
});

export const stateMachineLinkable = new sst.Linkable('SpawnRegisteredStateMachine', {
  properties: {
    arn: stateMachine.arn,
  },
  include: [
    sst.aws.permission({
      actions: ['states:StartExecution'],
      resources: [stateMachine.arn],
    })
  ]
});
