import { normalize, calculateRecencyScore, determineActivityLevel } from '../src/lib/openalex';

describe('OpenAlex DeepResearch Scoring Engine', () => {

    describe('normalize()', () => {
        it('should scale down values relative to max', () => {
            expect(normalize(50, 100)).toBe(0.5);
            expect(normalize(100, 100)).toBe(1.0);
            expect(normalize(500, 1000)).toBe(0.5);
            expect(normalize(0, 10)).toBe(0);
        });

        it('should cap at 1.0 if value exceeds max', () => {
            expect(normalize(150, 100)).toBe(1.0);
        });
    });

    describe('calculateRecencyScore()', () => {
        it('gives 1.0 to current year', () => {
            expect(calculateRecencyScore(2026, 2026)).toBe(1.0);
        });

        it('subtracts 0.2 per year of age', () => {
            expect(parseFloat(calculateRecencyScore(2025, 2026).toFixed(1))).toBe(0.8);
            expect(parseFloat(calculateRecencyScore(2024, 2026).toFixed(1))).toBe(0.6);
            expect(parseFloat(calculateRecencyScore(2022, 2026).toFixed(1))).toBe(0.2);
        });

        it('floors at 0.0 for very old papers', () => {
            expect(calculateRecencyScore(2010, 2026)).toBe(0);
        });
    });

    describe('determineActivityLevel()', () => {
        const currentYear = 2026;

        it('returns ACTIVE for high output in recent years', () => {
            expect(determineActivityLevel(4, 2026, currentYear)).toBe('ACTIVE');
            expect(determineActivityLevel(3, 2024, currentYear)).toBe('ACTIVE');
        });

        it('returns ACTIVE if last work was within 12 months even if total is low', () => {
            expect(determineActivityLevel(1, 2025, currentYear)).toBe('ACTIVE');
        });

        it('returns MODERATE for 1-2 works in last 3 years', () => {
            expect(determineActivityLevel(2, 2024, currentYear)).toBe('MODERATE');
        });

        it('returns LOW for 0 recent works and old papers', () => {
            expect(determineActivityLevel(0, 2020, currentYear)).toBe('LOW');
        });
    });
});
