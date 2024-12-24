import { Tool } from "@goat-sdk/core";
import { SearchParameters } from "./parameters";

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
}
