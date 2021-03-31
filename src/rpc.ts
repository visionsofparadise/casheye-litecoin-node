import Client from 'bitcoin-core';

const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

export const rpc = new Client({ 
	network: process.env.NETWORK!,
	port: process.env.NETWORK! === 'mainnet' ? 9333 : process.env.NETWORK! === 'testnet' ? 19335 : 19332,
	username: rpcuser,
	password: rpcpassword
 } as any);