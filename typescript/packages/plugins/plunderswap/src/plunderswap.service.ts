import { Tool } from "@goat-sdk/core";
import { ZilliqaWalletClientViemOnly } from "@goat-sdk/wallet-zilliqa";
import { type PublicClient, type WalletClient, getContract, parseAbi, parseUnits } from "viem";
import textAbiErc20 from "../abi/ERC20.json";
import textAbiPlunderFactory from "../abi/IPlunderFactory.json";
import textAbiPlunderPair from "../abi/IPlunderPair.json";
import textAbiPlunderRouter from "../abi/IPlunderRouter01.json";
import { ApproveParameters, QuoteParameters, SwapParameters } from "./types";

type Token = {
    symbol: string;
    address: `0x${string}`;
    decimals: number;
};

type TokenInfo = {
    address: `0x${string}`;
    decimals: number;
};

const GAS_TOKEN = "WZIL";

function ensureHexPrefix(hex: string): `0x${string}` {
    return hex.startsWith("0x") ? (hex as `0x${string}`) : `0x${hex}`;
}

export class PlunderSwapService {
    private erc20Abi = parseAbi(textAbiErc20);
    private pairAbi = parseAbi(textAbiPlunderPair);
    private factoryAbi = parseAbi(textAbiPlunderFactory);
    private routerAbi = parseAbi(textAbiPlunderRouter);

    private tokensByChain = new Map<number, Map<string, TokenInfo>>();

    /*
     * Implementation notes:
     *
     * IPlunderPair offers token0, token1, getReserves
     * IPlunderFactory offers allPairs and allPairsLength
     * Between them, we can construct a list of token-token-pairs, and corresponding reserves.
     */

    private async ensureTokens(client: PublicClient) {
        const chainId = await client.getChainId();
        if (this.tokensByChain.has(chainId)) {
            return;
        }
        let uri: string;
        if (chainId === 32769) {
            uri = "https://plunderswap.github.io/token-lists/default-mainnet.json";
        } else if (chainId === 33101) {
            uri = "https://plunderswap.com/lists/default-testnet.json";
        } else {
            throw `unknown chain ${chainId}`;
        }
        const response = await fetch(uri);
        if (!response.ok) {
            throw `failed to fetch tokens for chain ${chainId}: ${response.statusText}`;
        }
        const responseObject = await response.json();
        const responseTokens: [Token] = responseObject.tokens;
        const tokens = new Map<string, TokenInfo>();
        for (const token of responseTokens) {
            const info = { address: token.address, decimals: token.decimals };
            tokens.set(token.symbol, info);
        }
        this.tokensByChain.set(chainId, tokens);
    }

    private async ensureGas(client: PublicClient, wallet: WalletClient) {
        const gasToken = this.tokensByChain.get(await client.getChainId())?.get(GAS_TOKEN);
        if (!gasToken) {
            return;
        }
        const [walletAddress] = await wallet.getAddresses();
        const gasContract = getContract({
            address: gasToken.address,
            abi: this.erc20Abi,
            client,
        });
        const gasBalance = await gasContract.read.balanceOf([walletAddress]);
        if (gasBalance === 0n) {
            throw "user has no gas";
        }
    }

    @Tool({
        name: "plunderswap_approve",
        description: "TODO",
    })
    async ensureApproval(walletClient: ZilliqaWalletClientViemOnly, parameters: ApproveParameters) {
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        await this.ensureTokens(viemPublic);
        await this.ensureGas(viemPublic, viemWallet);

        const erc20 = getContract({
            address: ensureHexPrefix(parameters.token),
            abi: this.erc20Abi,
            client: {
                public: viemPublic,
                wallet: viemWallet,
            },
        });
        const [address] = await viemWallet.getAddresses();
        const someContract = "0x0000000000000000000000000000000000000001";
        const amountGranted = await erc20.read.allowance([address, someContract]);
        const amountRequired = parseUnits(parameters.amount, 18);
        return amountGranted;
        //const approval_hash = await erc20.write.approve();
        /*
         * This one's a simple ERC-20 approval.
         * Check the allowance first in case there's already enough.
         * Return the transaction hash, if any.
         */
    }

    @Tool({
        name: "plunderswap_quote",
        description: "TODO",
    })
    async getQuote(walletClient: ZilliqaWalletClientViemOnly, parameters: QuoteParameters) {
        /*
         * Look through the list of token-token pairs.
         * Keep track of best quote among,
         *   Any pair that happens to be exactly what we want.
         *   Any pair of pairs with a common intermediate token.
         *   IPlunderRouter01 offers quote, which needs tokens translating to reserves.
         * Return the best quote and the path through tokens to achieve it.
         */
    }

    @Tool({
        name: "plunderswap_swap",
        description: "TODO",
    })
    async swap(walletClient: ZilliqaWalletClientViemOnly, parameters: SwapParameters) {
        /*
         * This is just calling IPlunderRouter01,
         * swapType determines swapExactTokensForTokens or swapTokensForExactTokens.
         * tokenPath is from getQuote.
         * First check that ZIL balance isn't zero.
         * Return the transaction hash.
         */
    }
}
