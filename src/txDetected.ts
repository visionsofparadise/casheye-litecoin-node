import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { Currency, eventbridge, logger, Network, networkCurrencies } from './helpers';
import { rpc } from './rpc'

interface GetTransactionResponse {
	txid: string;
	confirmations: number;
	amount: number;
	currency: Currency
	details: Array<{
		address: string;
		category: string;
		label: string;
	}>;
}

type NodeTxDetectedDetail = GetTransactionResponse

export const nodeTxDetectedEvent = new Event<NodeTxDetectedDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'nodeTxDetected',
	detailJSONSchema: jsonObjectSchemaGenerator<NodeTxDetectedDetail>({
		description: 'Triggered when an address is being watched for transactions and confirmations.',
		properties: {
			txid: { type: 'string' },
			confirmations: { type: 'number' },
			amount: { type: 'number' },
			currency: { type: 'string' },
			details: { type: 'array', items: jsonObjectSchemaGenerator<NodeTxDetectedDetail['details'][number]>({ 
				properties: {
					address: { type: 'string' },
					category: { type: 'string' },
					label: { type: 'string' }
				}
			})}
		}
	})
});

export const txDetected = async (txId: string) => {
	const tx = (await rpc.getTransaction(txId, true)) as GetTransactionResponse;

	if (tx.confirmations !== 0) return 

	logger.info({tx})

	const addresses = tx.details.filter(detail => detail.category === 'receive' && detail.label === 'watching')

	await Promise.all(addresses.map(async address => {
		await rpc.setLabel(address.address, 'confirming');

		await nodeTxDetectedEvent.send({
			...tx,
		currency: networkCurrencies[process.env.NETWORK! as Network][0] as Currency
		})

		return
	}))

	return;
};
