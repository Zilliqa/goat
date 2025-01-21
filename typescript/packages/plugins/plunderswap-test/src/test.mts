import { PlunderSwapPlugin } from "@goat-sdk/plugin-plunderswap";
import { ZilliqaPlugin } from "@goat-sdk/plugin-zilliqa";
import { ZilliqaWalletClient, ZilliqaWalletClientViemOnly, zilliqaJSViemWalletClient } from "@goat-sdk/wallet-zilliqa";
import { Account } from "@zilliqa-js/account";
import { http, PublicClient, createWalletClient, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zilliqaTestnet } from "viem/chains";

const private_key = "0x9b3bcb7edf78b422d9886c27239a55a9cd78a96c6b6f4bb82657045b85c2f161";
const account = privateKeyToAccount(private_key);

const viemWalletClient = createWalletClient({
    chain: zilliqaTestnet,
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
    "https://api.testnet.zilliqa.com",
    new Account(private_key),
    333,
);

///

const plunderSwapPlugin = new PlunderSwapPlugin();

const plunderSwapPluginWallet = await ZilliqaWalletClientViemOnly.createClient(viemPublicClient, viemWalletClient);

for (const tool of await plunderSwapPlugin.getTools(plunderSwapPluginWallet)) {
    if (tool.name === "plunderswap_approve") {
        const params = {
            token: "0x63B991C17010C21250a0eA58C6697F696a48cdf3",
            amount: "1",
        };
        const result = await tool.execute(params);
        console.log({ result });
    }
}
