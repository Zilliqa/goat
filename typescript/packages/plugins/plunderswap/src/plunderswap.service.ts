import { Tool } from "@goat-sdk/core";
import { ZilliqaWalletClientViemOnly } from "@goat-sdk/wallet-zilliqa";
import { formatUnits, getContract, parseAbi, parseUnits } from "viem";
import textAbiErc20 from "../abi/ERC20.json";
import textAbiPlunderFactory from "../abi/IPlunderFactory.json";
import textAbiPlunderPair from "../abi/IPlunderPair.json";
import textAbiPlunderRouter from "../abi/IPlunderRouter01.json";
import { QuoteParameters, SwapParameters, TokensParameters } from "./types";

type HexString = `0x${string}`;

type ContractAddresses = {
    factory: HexString;
    router: HexString;
};

type Token = {
    symbol: string;
    address: HexString;
    decimals: number;
};

type Tokens = {
    bySymbol: Map<string, Token>;
    byAddress: Map<string, Token>;
};

type Reserves = {
    from: bigint;
    to: bigint;
};

type TradeDirect = {
    reserves: Reserves;
};

type TradeFrom = {
    tokenTo: Token;
    reserves: Reserves;
};

type TradeTo = {
    tokenFrom: Token;
    reserves: Reserves;
};

function getContractAddresses(chainId: number): ContractAddresses {
    if (chainId === 32769) {
        return {
            factory: "0xf42d1058f233329185A36B04B7f96105afa1adD2",
            router: "0x33C6a20D2a605da9Fd1F506ddEd449355f0564fe",
        };
    }
    if (chainId === 33101) {
        return {
            factory: "0xd0156eFCA4D847E4c4aD3F9ECa7FA697bb105cC0",
            router: "0x144e7AEee22F388350E9EAEFBb626A021fcd0250",
        };
    }
    throw `unknown chain ${chainId}`;
}

export class PlunderSwapService {
    private erc20Abi = parseAbi(textAbiErc20);
    private pairAbi = parseAbi(textAbiPlunderPair);
    private factoryAbi = parseAbi(textAbiPlunderFactory);
    private routerAbi = parseAbi(textAbiPlunderRouter);

    private tokensByChain = new Map<number, Tokens>();

    private async ensureTokens(chainId: number) {
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
        const tokensByName = new Map<string, Token>();
        const tokensByAddress = new Map<string, Token>();
        for (const token of responseTokens) {
            tokensByName.set(token.symbol, token);
            tokensByAddress.set(token.address.toLowerCase(), token);
        }
        this.tokensByChain.set(chainId, {
            bySymbol: tokensByName,
            byAddress: tokensByAddress,
        });
    }

    private async ensureApproval(
        walletClient: ZilliqaWalletClientViemOnly,
        tokenAddress: HexString,
        spender: HexString,
        amount: bigint,
    ): Promise<HexString | null> {
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const erc20 = getContract({
            address: tokenAddress,
            abi: this.erc20Abi,
            client: {
                public: viemPublic,
                wallet: viemWallet,
            },
        });
        const [address] = await viemWallet.getAddresses();
        const amountGranted = (await erc20.read.allowance([address, spender])) as bigint;
        if (amount <= amountGranted) {
            return null;
        }
        const approveTxHash = await erc20.write.approve([spender, amount]);
        await viemPublic.waitForTransactionReceipt({
            hash: approveTxHash,
        });
        return approveTxHash;
    }

    @Tool({
        name: "plunderswap_tokens",
        description:
            "Get the symbols for the tokens on the current blockchain that are registered with PlunderSwap for exchange.",
    })
    async getTokens(walletClient: ZilliqaWalletClientViemOnly, _parameters: TokensParameters) {
        const viemPublic = walletClient.getViemPublicClient();
        const chainId = await viemPublic.getChainId();
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId)?.bySymbol.keys();
        return {
            tokens: tokens ? Array.from(tokens) : [],
        };
    }

    @Tool({
        name: "plunderswap_quote",
        description:
            "Get a quote for how many tokens would be received if the given tokens were swapped for another token.",
    })
    async getQuote(walletClient: ZilliqaWalletClientViemOnly, parameters: QuoteParameters) {
        if (parameters.fromToken === parameters.toToken) {
            throw "quote tokens must differ";
        }
        // Set up data.
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const chainId = await viemPublic.getChainId();
        const contracts = getContractAddresses(chainId);
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        const fromTokenInfo = tokens?.bySymbol.get(parameters.fromToken);
        const toTokenInfo = tokens?.bySymbol.get(parameters.toToken);
        if (!fromTokenInfo) {
            throw `unknown token ${parameters.fromToken} on chain ${chainId}`;
        }
        if (!toTokenInfo) {
            throw `unknown token ${parameters.toToken} on chain ${chainId}`;
        }
        const fromAmountInt = parseUnits(parameters.fromAmount, fromTokenInfo.decimals);
        console.log({ fromAmountInt, fromTokenInfo, toTokenInfo });
        // Note the possibly relevant pairs of reserves of tokens.
        const factory = getContract({
            address: contracts.factory,
            abi: this.factoryAbi,
            client: viemPublic,
        });
        const tradeDirect: TradeDirect[] = [];
        const tradeFrom: TradeFrom[] = [];
        const tradeTo: TradeTo[] = [];
        const pairCount = (await factory.read.allPairsLength()) as bigint;
        for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
            const pairAddress = (await factory.read.allPairs([pairIndex])) as HexString;
            const pair = getContract({
                address: pairAddress,
                abi: this.pairAbi,
                client: viemPublic,
            });
            const tokenAddress0 = (await pair.read.token0()) as HexString;
            const tokenAddress1 = (await pair.read.token1()) as HexString;
            const token0 = tokens?.byAddress.get(tokenAddress0.toLowerCase());
            const token1 = tokens?.byAddress.get(tokenAddress1.toLowerCase());
            if (!token0 || !token1) {
                continue;
            }
            const reserves = (await pair.read.getReserves()) as unknown[];
            const reserve0 = reserves[0] as bigint;
            const reserve1 = reserves[1] as bigint;
            if ([reserve0, reserve1].includes(BigInt(0))) {
                continue;
            }
            console.log("liquidity pair", {
                tokens: [token0.symbol, token1.symbol],
                reserves: [reserve0, reserve1],
            });
            const pairTokens = [token0, token1];
            const hasFromToken = pairTokens.includes(fromTokenInfo);
            const hasToToken = pairTokens.includes(toTokenInfo);
            if (hasFromToken) {
                if (hasToToken) {
                    if (fromTokenInfo === token0) {
                        tradeDirect.push({
                            reserves: { from: reserve0, to: reserve1 },
                        });
                    } else {
                        tradeDirect.push({
                            reserves: { from: reserve1, to: reserve0 },
                        });
                    }
                } else {
                    if (fromTokenInfo === token0) {
                        tradeFrom.push({
                            reserves: { from: reserve0, to: reserve1 },
                            tokenTo: token1,
                        });
                    } else {
                        tradeFrom.push({
                            reserves: { from: reserve1, to: reserve0 },
                            tokenTo: token0,
                        });
                    }
                }
            } else if (hasToToken) {
                if (toTokenInfo === token1) {
                    tradeTo.push({
                        reserves: { from: reserve0, to: reserve1 },
                        tokenFrom: token0,
                    });
                } else {
                    tradeTo.push({
                        reserves: { from: reserve1, to: reserve0 },
                        tokenFrom: token1,
                    });
                }
            }
        }
        // Combine the relevant pairs into token paths to find the best.
        let bestQuoteAmount = BigInt(0);
        let bestQuotePath: Token[] = [];
        for (const direct of tradeDirect) {
            if (direct.reserves.from < fromAmountInt) {
                continue;
            }
            const toAmount = (fromAmountInt * direct.reserves.to) / direct.reserves.from;
            if (direct.reserves.to < toAmount) {
                continue;
            }
            if (toAmount > bestQuoteAmount) {
                bestQuoteAmount = toAmount;
                bestQuotePath = [fromTokenInfo, toTokenInfo];
            }
        }
        for (const from of tradeFrom) {
            for (const to of tradeTo) {
                if (from.tokenTo === to.tokenFrom) {
                    if (from.reserves.from < fromAmountInt) {
                        continue;
                    }
                    const betweenAmount = (fromAmountInt * from.reserves.to) / from.reserves.from;
                    if (from.reserves.to < betweenAmount || to.reserves.from < betweenAmount) {
                        continue;
                    }
                    const toAmount = (betweenAmount * to.reserves.to) / to.reserves.from;
                    if (to.reserves.to < toAmount) {
                        continue;
                    }
                    if (toAmount > bestQuoteAmount) {
                        bestQuoteAmount = toAmount;
                        bestQuotePath = [fromTokenInfo, from.tokenTo, toTokenInfo];
                    }
                }
            }
        }
        if (bestQuoteAmount === BigInt(0)) {
            throw "cannot make that swap";
        }
        // Use the best token path to find the real quote amount from the router.
        const txHashes: HexString[] = [];
        const approveTxHash = await this.ensureApproval(
            walletClient,
            bestQuotePath[0].address,
            contracts.router,
            fromAmountInt,
        );
        if (approveTxHash) {
            txHashes.push(approveTxHash);
        }
        const router = getContract({
            address: contracts.router,
            abi: this.routerAbi,
            client: viemPublic,
        });
        const swapOutcome = await router.simulate.swapExactTokensForTokens([
            fromAmountInt,
            BigInt(0),
            bestQuotePath.map((token) => token.address),
            contracts.router,
            BigInt(Math.round(new Date().getTime() / 800)),
        ]);
        const amounts = swapOutcome.result as bigint[];
        return {
            amount: formatUnits(amounts[amounts.length - 1], toTokenInfo.decimals),
            tokenPath: bestQuotePath.map((token) => token.symbol),
            txHashes,
        };
    }

    @Tool({
        name: "plunderswap_swap",
        description: "Exchange the given tokens for another token.",
    })
    async swap(walletClient: ZilliqaWalletClientViemOnly, parameters: SwapParameters) {
        if (parameters.tokenPath.length < 2) {
            throw "token path must include at least two tokens";
        }
        if (new Set([...parameters.tokenPath]).size !== parameters.tokenPath.length) {
            throw "tokens on path must differ";
        }
        // Set up data.
        console.log({parameters});
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const chainId = await viemPublic.getChainId();
        const contracts = getContractAddresses(chainId);
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        const tokenInfo: Token[] = [];
        for (const symbol of parameters.tokenPath) {
            const token = tokens?.bySymbol.get(symbol);
            if (!token) {
                throw `unknown token ${symbol} on chain ${chainId}`;
            }
            tokenInfo.push(token);
        }
        const fromAmountInt = parseUnits(parameters.fromAmount, tokenInfo[0].decimals);
        const toAmountInt = parseUnits(parameters.toAmount, tokenInfo[tokenInfo.length - 1].decimals);
        const deadline = Math.round(parameters.deadline.getTime() / 1000);
        const tokenAddresses = tokenInfo.map((token) => token.address);
        // Perform the swap.
        const txHashes: HexString[] = [];
        const approveTxHash = await this.ensureApproval(
            walletClient,
            tokenAddresses[0],
            contracts.router,
            fromAmountInt,
        );
        if (approveTxHash) {
            txHashes.push(approveTxHash);
        }
        const router = getContract({
            address: contracts.router,
            abi: this.routerAbi,
            client: {
                public: viemPublic,
                wallet: viemWallet,
            },
        });
        const [address] = await viemWallet.getAddresses();
        const swapTxHash = await router.write.swapExactTokensForTokens([
            fromAmountInt,
            toAmountInt,
            tokenAddresses,
            address,
            deadline,
        ]);
        txHashes.push(swapTxHash);
        await viemPublic.waitForTransactionReceipt({
            hash: swapTxHash,
        });
        return { txHashes };
    }
}
