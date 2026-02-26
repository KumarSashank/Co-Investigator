import { extractContactInfoFromXml } from '../src/lib/pubmed';

describe('PubMed E-Utilities Parsing', () => {

    it('extracts affiliation without email correctly', () => {
        const xml = `
            <PMID Version="1">12345</PMID>
            <PubmedArticle>
                <Affiliation>Department of Biomedicine, Mock University, London, UK.</Affiliation>
            </PubmedArticle>
        `;
        const result = extractContactInfoFromXml(xml, '12345');

        expect(result.affiliations).toContain('Department of Biomedicine, Mock University, London, UK.');
        expect(result.correspondingEmail).toBeNull();
    });

    it('extracts emails embedded within affiliation text', () => {
        const xml = `
            <PMID Version="1">67890</PMID>
            <PubmedArticle>
                <Affiliation>Department of Biomedicine, Mock University, London, UK. Electronic address: fake.researcher@mock.edu.uk.</Affiliation>
            </PubmedArticle>
        `;
        const result = extractContactInfoFromXml(xml, '67890');

        expect(result.affiliations.length).toBe(1);
        expect(result.correspondingEmail).toBe('fake.researcher@mock.edu.uk');
    });

    it('handles multiple affiliations and finds the first occurring email', () => {
        const xml = `
            <PMID Version="1">99999</PMID>
            <PubmedArticle>
                <Affiliation>First Institute, USA.</Affiliation>
                <Affiliation>Second Institute, Canada. john.doe@utoronto.ca</Affiliation>
                <Affiliation>Third Institute, UK. jane.smith@oxford.ac.uk</Affiliation>
            </PubmedArticle>
        `;
        const result = extractContactInfoFromXml(xml, '99999');

        expect(result.affiliations.length).toBe(3);
        expect(result.correspondingEmail).toBe('john.doe@utoronto.ca');
    });

    it('ignores affiliations outside the targeted PMID block', () => {
        const xml = `
            <PMID Version="1">111</PMID>
            <PubmedArticle>
                <Affiliation>Wrong Author, Wrong University. wrong.email@test.com</Affiliation>
            </PubmedArticle>
            
            <PMID Version="1">222</PMID>
            <PubmedArticle>
                <Affiliation>Correct Author, Right University. correct@test.com</Affiliation>
            </PubmedArticle>
        `;
        const result = extractContactInfoFromXml(xml, '222');

        expect(result.correspondingEmail).toBe('correct@test.com');
        expect(result.affiliations).not.toContain('Wrong Author, Wrong University. wrong.email@test.com');
    });
});
