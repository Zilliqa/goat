import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class TokensParameters extends createToolParameters(z.object({})) {}

export const TokensReponse = z.object({
    tokens: z.string().array().describe("symbols for tokens registered with PlunderSwap"),
});

export class QuoteParameters extends createToolParameters(
    z.object({
        fromToken: z.string().describe("symbol for the token to swap"),
        fromAmount: z.string().describe("how much of the token to swap"),
        toToken: z.string().describe("symbol for the other token to receive in exchange"),
    }),
) {}

export const QuoteResponse = z.object({
    amount: z.string().describe("how much would be received"),
    tokenPath: z
        .string()
        .array()
        .describe("ordered list of the symbols of the tokens to be used in a series of swaps to effect the exchange"),
    txHashes: z.string().array().describe("hashes of all transactions used to achieve the quote"),
});

export class SwapParameters extends createToolParameters(
    z.object({
        tokenPath: z
            .string()
            .array()
            .describe("ordered list of the symbols of the tokens to use in a series of swaps to effect the exchange"),
        fromAmount: z.string().describe("how much of the token, the first in the token path, to swap"),
        toAmount: z
            .string()
            .describe(
                "minimum bound on how much of the other token, the last in the token path, must be received in exchange",
            ),
        toAddress: z.string().describe("address of the account in which to deposit the tokens received in exchange"),
        deadline: z.coerce.date().describe("by when the exchange must be completed"),
    }),
) {}

export const SwapResponse = z.object({
    txHashes: z.string().array().describe("the hashes of all transactions used to achieve the swap"),
});
