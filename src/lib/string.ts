import { loadSTRINGInteractions, loadSTRINGProteinInfo } from './cloudData';

export interface ProteinInteraction {
    protein1: string;
    protein1_name: string;
    protein2: string;
    protein2_name: string;
    score: number;
}

/**
 * Fetches protein-protein interactions for a given protein symbol or ID.
 * Searches the human STRING interaction dataset in GCS.
 */
export async function fetchProteinInteractions(query: string): Promise<ProteinInteraction[]> {
    const searchTerm = query.toUpperCase();

    // Load data from cloud (cached in memory)
    const [interactions, info] = await Promise.all([
        loadSTRINGInteractions(),
        loadSTRINGProteinInfo()
    ]);

    // Find the internal STRING ID for the search term
    const protein = info.find(i => i.name.toUpperCase() === searchTerm || i.id === searchTerm);
    if (!protein) {
        throw new Error(`Protein "${query}" not found in STRING dataset.`);
    }

    const proteinId = protein.id;

    // Filter interactions involving this protein
    const matches = interactions.filter(i => i.protein1 === proteinId || i.protein2 === proteinId);

    // Map to include names
    return matches.map(m => {
        const p1Info = info.find(i => i.id === m.protein1);
        const p2Info = info.find(i => i.id === m.protein2);
        return {
            protein1: m.protein1,
            protein1_name: p1Info?.name || m.protein1,
            protein2: m.protein2,
            protein2_name: p2Info?.name || m.protein2,
            score: m.score
        };
    }).sort((a, b) => b.score - a.score);
}
