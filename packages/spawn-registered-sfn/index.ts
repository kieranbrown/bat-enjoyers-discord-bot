/// <reference path="../../.sst/platform/config.d.ts" />

type ComponentArgs = {
  eventConnection: aws.cloudwatch.EventConnection,
}

export class SpawnRegisteredSfn {
  private sfn

  constructor(name: string, args: ComponentArgs) {
    const { eventConnection } = args;

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

    this.sfn = new aws.sfn.StateMachine('SpawnRegistered', {
      name: `${$app.name}-${$app.stage}-spawn-registered`,
      roleArn: iamRole.arn,
      definition: $util.jsonStringify({
        "StartAt": "InitializeSpawnWindow",
        "States": {
          "InitializeSpawnWindow": {
            "Type": "Task",
            "Resource": "arn:aws:states:::http:invoke",
            "ResultPath": "$.spawnWindow.initialize.httpResponse",
            "TimeoutSeconds": 10,
            "Parameters": {
              "Authentication": {
                "ConnectionArn": eventConnection.arn
              },
              "RequestBody.$": "$.spawnWindow.initialize.httpBody",
              "ApiEndpoint.$": "$.spawnWindow.initialize.httpEndpoint",
              "Headers": {
                "Content-Type": "application/json"
              },
              "Method": "POST"
            },
            "Retry": [{
              "ErrorEquals": ["States.ALL"],
              "BackoffRate": 2,
              "MaxAttempts": 10,
              "MaxDelaySeconds": 60,
              "IntervalSeconds": 2
            }],
            "Next": "Parallel"
          },
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
                    "TimestampPath": "$.spawnWindow.active.date"
                  },
                  "SetSpawnWindowActive": {
                    "Type": "Task",
                    "Resource": "arn:aws:states:::http:invoke",
                    "ResultPath": "$.spawnWindow.active.httpResponse",
                    "TimeoutSeconds": 10,
                    "Parameters": {
                      "Method": "PATCH",
                      "Authentication": {
                        "ConnectionArn": eventConnection.arn
                      },
                      "RequestBody.$": "$.spawnWindow.active.httpBody",
                      "ApiEndpoint.$": "States.Format('{}/{}', $.spawnWindow.initialize.httpEndpoint, $.spawnWindow.initialize.httpResponse.ResponseBody.id)",
                      "Headers": {
                        "Content-Type": "application/json"
                      }
                    },
                    "Retry": [
                      {
                        "ErrorEquals": ["States.Http.StatusCode.404"],
                        "IntervalSeconds": 5,
                        "MaxAttempts": 2
                      },
                      {
                        "ErrorEquals": ["States.ALL"],
                        "BackoffRate": 2,
                        "MaxAttempts": 10,
                        "MaxDelaySeconds": 60,
                        "IntervalSeconds": 2
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
                    "TimestampPath": "$.spawnWindow.closed.date"
                  },
                  "SetSpawnWindowClosed": {
                    "Type": "Task",
                    "Resource": "arn:aws:states:::http:invoke",
                    "ResultPath": "$.spawnWindow.closed.httpResponse",
                    "TimeoutSeconds": 10,
                    "Parameters": {
                      "Method": "PATCH",
                      "Authentication": {
                        "ConnectionArn": eventConnection.arn
                      },
                      "RequestBody.$": "$.spawnWindow.closed.httpBody",
                      "ApiEndpoint.$": "States.Format('{}/{}', $.spawnWindow.initialize.httpEndpoint, $.spawnWindow.initialize.httpResponse.ResponseBody.id)",
                      "Headers": {
                        "Content-Type": "application/json"
                      }
                    },
                    "Retry": [
                      {
                        "ErrorEquals": ["States.Http.StatusCode.404"],
                        "IntervalSeconds": 5,
                        "MaxAttempts": 2
                      },
                      {
                        "ErrorEquals": ["States.ALL"],
                        "BackoffRate": 2,
                        "MaxAttempts": 10,
                        "MaxDelaySeconds": 60,
                        "IntervalSeconds": 2
                      }
                    ],
                    "End": true
                  }
                }
              }
            ],
            "Catch": [{
              "ErrorEquals": ["States.Http.StatusCode.404"],
              "Next": "Pass"
            }]
          },
          "Pass": {
            "Type": "Pass",
            "End": true
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
            resources: [this.sfn.arn],
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
  }

  public get nodes() {
    return {
      sfn: this.sfn,
    }
  }
}
