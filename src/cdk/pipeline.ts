import { Stack, Construct, StackProps, SecretValue } from '@aws-cdk/core';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { CdkPipeline, SimpleSynthAction, ShellScriptAction } from '@aws-cdk/pipelines';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { CasheyeLitecoinNodeStage } from './stack';
import { App } from '@aws-cdk/core';
import { EventBus } from '@aws-cdk/aws-events';

export const serviceName = 'casheye-litecoin-node';

export class CasheyeLitecoinNodePipelineStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const sourceArtifact = new Artifact();
		const cloudAssemblyArtifact = new Artifact();

		const sourceAction = new GitHubSourceAction({
			actionName: 'source',
			owner: 'visionsofparadise',
			repo: serviceName,
			oauthToken: SecretValue.secretsManager('GITHUB_TOKEN'),
			output: sourceArtifact,
			branch: 'main'
		});

		const synthAction = new SimpleSynthAction({
			sourceArtifact,
			cloudAssemblyArtifact,
			installCommands: ['npm i'],
			buildCommands: [
				`CDK_DEFAULT_ACCOUNT=${SecretValue.secretsManager('ACCOUNT_NUMBER')}`,
				'npm run compile',
				'npm run build'
				],
			testCommands: ['npm run test'],
			synthCommand: 'npm run synth'
		});

		const pipeline = new CdkPipeline(this, 'pipeline', {
			pipelineName: serviceName + '-pipeline',
			cloudAssemblyArtifact,
			sourceAction,
			synthAction
		});

		const testApp = new CasheyeLitecoinNodeStage(this, serviceName + '-regtest-test', {
			STAGE: 'test',
			NETWORK: 'regtest'
		});

		const testAppStage = pipeline.addApplicationStage(testApp);

		const testEnv = [
			'STAGE=test',
			`CDK_DEFAULT_ACCOUNT=${SecretValue.secretsManager('ACCOUNT_NUMBER')}`,
			`TEST_XPUBKEY=${SecretValue.secretsManager('TEST_XPUBKEY_LTC')}`,
		]

		const outputs = {
			INSTANCE_URL: pipeline.stackOutput(testApp.instanceUrl!)
		}

		const integrationTestAction = new ShellScriptAction({
			actionName: 'Integration',
			runOrder: testAppStage.nextSequentialRunOrder(),
			additionalArtifacts: [sourceArtifact],
			commands: [
				'sleep 300s',
				...testEnv,
				'npm rm litecoind',
				'npm ci',
				'npm run integration'
			],
			useOutputs: outputs
		})

		testAppStage.addActions(integrationTestAction)

		testEnv.push('PERFORMANCE_TEST_N=100')

		const performanceTestAction = new ShellScriptAction({
			actionName: 'Performance',
			runOrder: testAppStage.nextSequentialRunOrder(),
			additionalArtifacts: [sourceArtifact],
			commands: [
				'sleep 10s',
				...testEnv,
				'npm rm litecoind',
				'npm ci',
				'npm run performance'
			],
			useOutputs: outputs
		})

		testAppStage.addActions(performanceTestAction)

		EventBus.grantAllPutEvents(integrationTestAction)
		EventBus.grantAllPutEvents(performanceTestAction)

		// const testnetApp = new CasheyeLitecoinNodeStage(this, serviceName + '-testnet-prod', {
		// 	STAGE: 'prod',
		// 	NETWORK: 'testnet'
		// });

		// pipeline.addApplicationStage(testnetApp);

		// const mainnetApp = new CasheyeLitecoinNodeStage(this, serviceName + '-mainnet-prod', {
		// 	STAGE: 'prod',
		// 	NETWORK: 'mainnet'
		// });

		// pipeline.addApplicationStage(mainnetApp);
	}
}

const app = new App();

new CasheyeLitecoinNodePipelineStack(app, `${serviceName}-pipeline-stack`, {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: 'us-east-1'
	}
});

app.synth();