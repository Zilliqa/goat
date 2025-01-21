import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

enum SwapType {
    EXACT_INPUT = "EXACT_INPUT",
    EXACT_OUTPUT = "EXACT_OUTPUT",
}

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

export class ApproveParameters extends createToolParameters(
    z.object({
        token: z.string().describe("TODO"),
        amount: z.string().describe("TODO"),
    }),
) {}

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

export const TransactionResponse = z.object({
    txHash: z.string().describe("TODO"),
});
