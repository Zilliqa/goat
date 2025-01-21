import { PlunderSwapPlugin, SwapType } from "@goat-sdk/plugin-plunderswap";
import { ZilliqaPlugin } from "@goat-sdk/plugin-zilliqa";
import {
    ZilliqaWalletClient,
    ZilliqaWalletClientViemOnly,
    zilliqaJSViemWalletClient,
} from "@goat-sdk/wallet-zilliqa";
import { Account } from "@zilliqa-js/account";
import { http, PublicClient, createWalletClient, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zilliqa, zilliqaTestnet } from "viem/chains";

const private_key = "0x9b3bcb7edf78b422d9886c27239a55a9cd78a96c6b6f4bb82657045b85c2f161";
const account = privateKeyToAccount(private_key);
const chain = zilliqaTestnet;

const viemWalletClient = createWalletClient({
    chain,
    transport: http(),
    name: "Wallet for testing PlunderSwap on Zilliqa",
    account,
}).extend(publicActions);

const viemPublicClient = viemWalletClient as unknown as PublicClient;

const [wallet] = await viemWalletClient.getAddresses();

console.log({ wallet });

///

const zilliqaPlugin = new ZilliqaPlugin();

const zilliqaPluginWallet: ZilliqaWalletClient = zilliqaJSViemWalletClient(
    viemWalletClient,
    chain.rpcUrls.default.http[0],
    new Account(private_key),
    chain.id & 0x7fff,
);

///

const plunderSwapPlugin = new PlunderSwapPlugin();

const plunderSwapPluginWallet = await ZilliqaWalletClientViemOnly.createClient(
    viemPublicClient,
    viemWalletClient,
);

for (const tool of await plunderSwapPlugin.getTools(plunderSwapPluginWallet)) {
    if (tool.name === "plunderswap_tokens") {
        const result = await tool.execute({});
        console.log(result);
    }
    if (tool.name === "plunderswap_quote") {
        const params = {
            fromToken: "SEED",
            toToken: "XSGD",
            fromAmount: "5",
        };
        const result = await tool.execute(params);
        console.log({ result });
    }
    if (tool.name === "plunderswap_swap") {
        let deadline = new Date();
        deadline.setTime(deadline.getTime() + 100 * 1000);
        const params = {
            tokenPath: ['HRSE', 'WZIL'],
            fromAmount: '5.5',
            toAmount: '0',
            toAddress: wallet,
            swapType: SwapType.EXACT_INPUT,
            deadline
        };
        const result = await tool.execute(params);
        console.log({ result });
    }
}
