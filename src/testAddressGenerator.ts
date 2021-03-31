import { HDPublicKey, Address, Networks } from 'litecore-lib'

export const testAddressGenerator = (n?: number) => {
	const xPubKeyObj = new HDPublicKey(process.env.TEST_XPUBKEY!);

	const number = n || Math.floor((Math.random() * 1000 * 1000) + 1);

	const derivedxPubKey = xPubKeyObj.deriveChild(`m/0/${number}`);

	const addressObj = new Address(derivedxPubKey.publicKey, Networks.testnet);

	const address = addressObj.toString()

	return address
}