import { createInterface } from "node:readline";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { http } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { worldstore } from "@goat-sdk/plugin-worldstore";
import { viem } from "@goat-sdk/wallet-viem";
import { z } from "zod";

require("dotenv").config();

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: baseSepolia,
});

const MY_CROSSMINT_COLLECTION_ID = process.env.CROSSMINT_COLLECTION_ID as string;

// HEY! Fill me out based on the expected call data for the collection/contract you are using!
const myCallDataSchema = z.object({
    productId: z.string(),
    to: z.string(),
    quantity: z.string(),
    totalPrice: z.string(),
});

// Create readline interface for user input
const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Function to get user input
const getUserInput = () => {
    return new Promise<string>((resolve) => {
        rl.question("You: ", (input) => {
            resolve(input);
        });
    });
};

(async () => {
    const tools = await getOnChainTools({
        wallet: viem(walletClient),
        plugins: [worldstore("http://localhost:3000")],
    });

    let conversationHistory = "";

    while (true) {
        const userInput = await getUserInput();

        if (userInput.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            break;
        }

        conversationHistory += `User: ${userInput}\n`;

        const result = await generateText({
            model: openai("gpt-4o"),
            tools: tools,
            maxSteps: 5,
            prompt: `${conversationHistory}\nAssistant: `,
        });

        console.log("\nAssistant:", result.text, "\n");
        conversationHistory += `Assistant: ${result.text}\n`;
    }
})();
