import * as cdk from '@aws-cdk/core';
import * as msk from '@aws-cdk/aws-msk'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as lambda from '@aws-cdk/aws-lambda'
import * as lambdaSources from '@aws-cdk/aws-lambda-event-sources'
import * as iam from '@aws-cdk/aws-iam'
import { join } from 'path';

export class CdkKafkaLambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // the network
    const vpc = new ec2.Vpc(this, 'kafka-network', {})
    // the cluster
    const cluster = new msk.Cluster(this, 'msk-cluster', {
      kafkaVersion: msk.KafkaVersion.V2_8_1,
      vpc,
      clusterName: 'kafka-cluster',
    })
    const lambdaSecGroup = new ec2.SecurityGroup(this, 'lambda-security-group', {
      vpc,
      securityGroupName: 'lambdaSecGroup'
    })
    lambdaSecGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp())
    lambdaSecGroup.addEgressRule(ec2.Peer.anyIpv6(), ec2.Port.allTcp())
    cluster.connections.allowFrom(lambdaSecGroup.connections, ec2.Port.allTcp())
    const fx = new lambda.Function(this, 'processing-lambda', {
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(join(__dirname, '../lambda-handler')),
      vpc,
      securityGroups: [lambdaSecGroup],
    })
    fx.addEventSource(new lambdaSources.ManagedKafkaEventSource({
      clusterArn: cluster.clusterArn,
      topic: 'dataTopic',
      startingPosition: lambda.StartingPosition.LATEST
    }))
  }
}
