/* tslint:disable */
/* eslint-disable */
import "sst"
declare module "sst" {
  export interface Resource {
    "Interaction": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
    "SpawnRegisteredStateMachine": {
      "arn": string
      "type": "sst.sst.Linkable"
    }
  }
}
export {}
