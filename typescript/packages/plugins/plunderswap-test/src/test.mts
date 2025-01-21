import { ToolBase } from "@goat-sdk/core";
import { PlunderSwapPlugin } from "@goat-sdk/plugin-plunderswap";
import { ZilliqaWalletClientViemOnly } from "@goat-sdk/wallet-zilliqa";
import { http, PublicClient, createWalletClient, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zilliqaTestnet } from "viem/chains";
import { type ZodType, type ZodTypeDef } from "zod";

// Set up wallet.

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

// Find tools in plugin.

const plunderSwapPlugin = new PlunderSwapPlugin();

const plunderSwapPluginWallet = await ZilliqaWalletClientViemOnly.createClient(viemPublicClient, viemWalletClient);

type GoatTool = ToolBase<ZodType<unknown, ZodTypeDef, unknown>, unknown>;
let quoteTool: GoatTool | undefined = undefined;
let swapTool: GoatTool | undefined = undefined;

for (const tool of await plunderSwapPlugin.getTools(plunderSwapPluginWallet)) {
    if (tool.name === "plunderswap_tokens") {
        const result = await tool.execute({});
        console.log(result);
    }
    if (tool.name === "plunderswap_quote") {
        quoteTool = tool;
    }
    if (tool.name === "plunderswap_swap") {
        swapTool = tool;
    }
}

// Use tools to swap tokens.

type QuoteResponse = {
    amount: string;
    tokenPath: string[];
};

if (quoteTool && swapTool) {
    const quoteParams = {
        fromToken: "SEED",
        toToken: "XSGD",
        fromAmount: "25",
    };
    const quoteResponse = (await quoteTool.execute(quoteParams)) as QuoteResponse;
    console.log({ quoteParams, quoteResponse });

    const minimum = BigInt(Math.floor(Number(quoteResponse.amount) * 0.9));
    const deadline = new Date();
    deadline.setTime(deadline.getTime() + 200 * 1000);
    const swapParams = {
        tokenPath: quoteResponse.tokenPath,
        fromAmount: quoteParams.fromAmount,
        toAmount: minimum.toString(),
        toAddress: wallet,
        deadline,
    };
    const swapResponse = await swapTool.execute(swapParams);
    console.log({ swapParams, swapResponse });
}
