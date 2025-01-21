import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export enum SwapType {
    EXACT_INPUT = "EXACT_INPUT",
    EXACT_OUTPUT = "EXACT_OUTPUT",
}

export class TokensParameters extends createToolParameters(z.object({})) {}

export const TokensReponse = z.object({
    tokens: z.string().array().describe("TODO"),
});

export class QuoteParameters extends createToolParameters(
    z.object({
        fromToken: z.string().describe("TODO"),
        fromAmount: z.string().describe("TODO"),
        toToken: z.string().describe("TODO"),
    }),
) {}

export const QuoteResponse = z.object({
    amount: z.string().describe("TODO"),
    tokenPath: z.string().array().describe("TODO"),
});

export class SwapParameters extends createToolParameters(
    z.object({
        tokenPath: z.string().array().describe("TODO"),
        fromAmount: z.string().describe("TODO"),
        toAmount: z.string().describe("TODO"),
        toAddress: z.string().describe("TODO"),
        swapType: z.nativeEnum(SwapType),
        deadline: z.date().describe("TODO"),
    }),
) {}

export const SwapResponse = z.object({
    txHash: z.string().array().describe("TODO"),
    toAmount: z.string().describe("TODO"),
});
