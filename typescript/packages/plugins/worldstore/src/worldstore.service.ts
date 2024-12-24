import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { SearchParameters } from "./parameters";
import { BuyProductParameters } from "./parameters";

export class WorldstoreService {
    @Tool({
        description: "Searches for products on all stores within the WorldStore",
    })
    async searchForProduct(parameters: SearchParameters) {
        const res = await fetch(
            `https://www.crossmint.com/api/worldstore/search?query=${parameters.query}&limit=${parameters.limit}`,
        );
        return res.json();
    }

    @Tool({
        description: "Buy a product from the WorldStore",
    })
    async buyProduct(walletClient: EVMWalletClient, parameters: BuyProductParameters) {
        const { contractAddress, productId, to, quantity } = parameters;

        const abi = [
            {
                inputs: [
                    {
                        internalType: "string",
                        name: "sku",
                        type: "string",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "quantity",
                        type: "uint256",
                    },
                ],
                name: "buyListing",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
            },
        ] as const;

        return await walletClient.sendTransaction({
            to: contractAddress,
            abi,
            functionName: "buyListing",
            args: [productId, to, quantity],
        });
    }
}
