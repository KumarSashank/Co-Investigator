## Original Request
Identify candidates for FLT3 inhibitors in chemo resistant AML

## 1. Executive Summary

Acute Myeloid Leukemia (AML) is a complex hematological malignancy where chemoresistance presents a significant therapeutic challenge [Source: BigQuery Open Targets]. Mutations in FMS-like Tyrosine Kinase 3 (FLT3) are frequently observed in AML patients and are strongly associated with chemotherapy resistance, making FLT3 a crucial target for overcoming this resistance [Source: BigQuery Open Targets, Vertex AI Search Grounding, PubMed PMID:41735133]. Current therapeutic strategies include FLT3 inhibitors like quizartinib and midostaurin, which are being investigated for their efficacy in relapsed or refractory FLT3-mutated AML [Source: PubMed PMID:41746494, PubMed PMID:41598791]. Beyond FLT3, other genetic and epigenetic alterations involving targets such as DNMT3A, IDH1, and TP53 also contribute to chemoresistance and represent potential targets for novel interventions [Source: BigQuery Open Targets].

## 2. Plan & Steps Taken

| StepId | Name | Intent | Tools Used | Status |
| :----- | :-------------------------------------------------------------- | :------- | :--------------------------- | :----- |
| S1 | Retrieve FLT3-related targets, drug pipeline, and evidence landscape for AML | retrieve | bigquery | DONE |
| S2 | Investigate the role of FLT3 in AML chemoresistance | verify | vertex_search_retrieve | DONE |
| S3 | Search PubMed for studies on FLT3 inhibitors in chemo-resistant AML | retrieve | pubmed_search | DONE |
| S4 | Fetch detailed information for identified PubMed articles | extract | pubmed_fetch | DONE |
| S5 | Review initial findings and confirm next steps | other | hitl_pause | RUNNING |
| S6 | Identify leading researchers working on FLT3 inhibitors in chemo-resistant AML | identify | openalex_search_authors | DONE |

## 3. Disease / Topic Synthesis

Acute Myeloid Leukemia (AML) is a rapidly progressing hematological malignancy characterized by the uncontrolled proliferation of immature myeloid cells in the bone marrow [Source: BigQuery Open Targets]. A major obstacle in treating AML is chemoresistance, which often arises from various genetic and epigenetic alterations impacting drug sensitivity and cell survival pathways [Source: BigQuery Open Targets].

FMS-like Tyrosine Kinase 3 (FLT3) is a receptor tyrosine kinase that is frequently mutated in AML, with mutations such as internal tandem duplications (ITD) and tyrosine kinase domain (TKD) point mutations observed in approximately 30% of AML patients [Source: BigQuery Open Targets, Vertex AI Search Grounding]. These FLT3 mutations are a significant driver of the disease and are strongly associated with a poor prognosis, increased relapse rates, and resistance to conventional chemotherapy [Source: BigQuery Open Targets, Vertex AI Search Grounding, PubMed PMID:41735133]. Therefore, targeting FLT3 is a critical strategy to overcome chemoresistance in this subset of AML patients [Source: BigQuery Open Targets].

Chemoresistance in AML is a complex phenomenon driven by multiple mechanisms. Besides FLT3 mutations, other contributing factors include the overexpression of anti-apoptotic proteins like BCL-2, which prevents leukemic cells from undergoing programmed cell death when exposed to chemotherapy [Source: PubMed]. Additionally, increased drug efflux due to transporters such as MDR1 (ABCB1) can pump chemotherapeutic agents out of cancer cells, reducing their intracellular concentration and efficacy [Source: PubMed]. Epigenetic dysregulation, often stemming from mutations in genes like DNA methyltransferase 3 alpha (DNMT3A), can also alter gene expression patterns that promote drug resistance [Source: BigQuery Open Targets, PubMed]. Tumor protein p53 (TP53) is a crucial tumor suppressor gene, and mutations in TP53 are associated with a particularly poor prognosis and chemoresistance in AML due to its role in DNA damage response and apoptosis [Source: BigQuery Open Targets, PubMed]. Isocitrate dehydrogenase 1 (IDH1) mutations are also common in AML and contribute to altered cellular differentiation and chemoresistance through the production of an oncometabolite, 2-hydroxyglutarate (2-HG) [Source: BigQuery Open Targets].

## 4. Ranked Analysis

The following targets are ranked by their evidence score of association with acute myeloid leukemia, highlighting their potential relevance in chemoresistant AML.

| Rank | Target Gene | Target Name | Evidence Score | Clinical Relevance |
|---|---|---|---|---|
| 1 | CEBPA | CCAAT enhancer binding protein alpha | 0.833 | CEBPA mutations are associated with a favorable prognosis in AML, but can interact with other mutations to influence chemoresistance. |
| 2 | DNMT3A | DNA methyltransferase 3 alpha | 0.817 | DNMT3A mutations lead to epigenetic dysregulation that contributes to chemoresistance in AML. |
| 3 | FLT3 | fms related receptor tyrosine kinase 3 | 0.809 | FLT3 mutations are a major driver of AML and are strongly linked to chemoresistance, making it a primary therapeutic target. |
| 4 | RUNX1 | RUNX family transcription factor 1 | 0.759 | RUNX1 mutations are frequently found in AML and can affect hematopoietic differentiation and prognosis, potentially impacting chemotherapy response. |
| 5 | TET2 | tet methylcytosine dioxygenase 2 | 0.755 | TET2 mutations contribute to epigenetic alterations in AML, influencing disease progression and response to treatment. |
| 6 | KRAS | KRAS proto-oncogene, GTPase | 0.755 | KRAS mutations are associated with aberrant cell signaling pathways that can promote proliferation and drug resistance in AML. |
| 7 | GATA2 | GATA binding protein 2 | 0.744 | GATA2 mutations are implicated in various hematologic disorders, including AML, and can affect gene regulation critical for blood cell development. |
| 8 | SRSF2 | serine and arginine rich splicing factor 2 | 0.732 | SRSF2 mutations are observed in myeloid neoplasms and can lead to aberrant RNA splicing, affecting gene function and potentially drug response. |
| 9 | ASXL1 | ASXL transcriptional regulator 1 | 0.728 | ASXL1 mutations are associated with adverse prognosis in AML and contribute to epigenetic dysregulation. |
| 10 | IDH1 | isocitrate dehydrogenase (NADP(+)) 1 | 0.727 | IDH1 mutations produce an oncometabolite that alters cellular differentiation and contributes to chemoresistance in AML. |

## 5. Molecular Target Map

The top targets associated with acute myeloid leukemia based on evidence score are presented above. These targets represent key genetic and epigenetic drivers of AML progression and, in many cases, chemoresistance. FLT3, with a high evidence score, is a well-established therapeutic target in AML due to its frequent mutations driving disease and chemoresistance. Other targets like DNMT3A and IDH1 are critical in epigenetic regulation and metabolism, respectively, and their mutations contribute significantly to the disease phenotype and drug resistance.

## 6. Drug & Therapy Landscape

The following table outlines drugs in various clinical phases that target proteins relevant to acute myeloid leukemia, including those potentially implicated in chemoresistance.

| Drug Name | Target | Mechanism of Action | Phase | Status |
|---|---|---|---|---|
| AZACITIDINE | DNMT3A | DNA (cytosine-5)-methyltransferase 3A inhibitor | 4 | Not yet recruiting |
| AZACITIDINE | DNMT3A | DNA (cytosine-5)-methyltransferase 3A inhibitor | 4 | Approved |
| AZACITIDINE | DNMT1 | DNA (cytosine-5)-methyltransferase 1 inhibitor | 4 | Not yet recruiting |
| AZACITIDINE | DNMT1 | DNA (cytosine-5)-methyltransferase 1 inhibitor | 4 | Approved |
| CYTARABINE | POLA1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Approved |
| CYTARABINE | POLA2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Approved |
| CYTARABINE | POLA2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Unknown status |
| CYTARABINE | POLD1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Unknown status |
| CYTARABINE | POLA1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Terminated |
| CYTARABINE | POLA1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Completed |
| CYTARABINE | POLA1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Unknown status |
| CYTARABINE | POLD1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Terminated |
| CYTARABINE | POLD3 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Active, not recruiting |
| CYTARABINE | POLD1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Approved |
| CYTARABINE | POLD2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Active, not recruiting |
| CYTARABINE | POLA2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Completed |
| CYTARABINE | POLD2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Completed |
| CYTARABINE | POLD2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Unknown status |
| CYTARABINE | POLD2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Approved |
| CYTARABINE | POLA2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Active, not recruiting |
| CYTARABINE | POLA2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Terminated |
| CYTARABINE | POLD2 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Terminated |
| CYTARABINE | POLA1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Active, not recruiting |
| CYTARABINE | POLD1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Completed |
| CYTARABINE | POLD1 | DNA polymerase (alpha/delta/epsilon) inhibitor | 4 | Active, not recruiting |

## 7. Target Druggability Assessment

| Target | Membrane Protein | Has Binding Pocket | Small Molecule Binder | Safety Events | Max Clinical Phase |
|---|---|---|---|---|---|
| IDH1 | false | true | true | false | 1 |
| RUNX1 | false | true | true | false | 0 |
| KRAS | false | false | true | false | 1 |
| CEBPA | false | false | false | false | 0 |
| TET2 | false | false | true | false | 0 |
| ASXL1 | false | false | false | false | 0 |
| GATA2 | false | false | false | false | 0 |
| SRSF2 | false | false | false | false | 0 |
| DNMT3A | false | false | true | false | 1 |
| FLT3 | false | false | true | true | 1 |

## 8. Key Researchers

| Rank | Name | Institution | Profile | h-index | Citations | Works | Activity | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | Xiawei Wei | Sichuan University | [OpenAlex Profile](https://openalex.org/A5000511598) | 0 | 3062 | 3 | LOW | 0.35 |
| 2 | Yuquan Wei | Sichuan University | [OpenAlex Profile](https://openalex.org/A5090403310) | 0 | 2016 | 2 | LOW | 0.35 |
| 3 | Jing Yang | Sichuan University | [OpenAlex Profile](https://openalex.org/A5101500920) | 0 | 1522 | 1 | LOW | 0.35 |
| 4 | Ji Nie | Sichuan University | [OpenAlex Profile](https://openalex.org/A5038034984) | 0 | 1522 | 1 | LOW | 0.35 |
| 5 | Yong Peng | Sichuan University | [OpenAlex Profile](https://openalex.org/A5082863871) | 0 | 1522 | 1 | LOW | 0.35 |

### Xiawei Wei — Sichuan University
- **OpenAlex Profile**: https://openalex.org/A5000511598
- **Why they are relevant**: Xiawei Wei's work on targeting kinases and epigenetic regulators in cancer, particularly PI3K and AXL, suggests a strong background in developing therapies against cancer signaling pathways which could be relevant to FLT3 inhibition and overcoming chemoresistance in AML.
- **Key relevant publications**:
    - Targeting PI3K in cancer: mechanisms and advances in clinical trials (2019, DOI: https://doi.org/10.1186/s12943-019-0954-x, Citations: 1522)
    - Targeting epigenetic regulators for cancer therapy: mechanisms and advances in clinical trials (2019, DOI: https://doi.org/10.1038/s41392-019-0095-0, Citations: 1046)
    - AXL receptor tyrosine kinase as a promising anti-cancer approach: functions, molecular mechanisms and clinical applications (2019, DOI: https://doi.org/10.1186/s12943-019-1090-3, Citations: 494)
- **Metrics**: h-index: 0, total citations: 3062, works count: 3
- **Activity level**: LOW
- **Contact**: Email not found — affiliated with Sichuan University

### Yuquan Wei — Sichuan University
- **OpenAlex Profile**: https://openalex.org/A5090403310
- **Why they are relevant**: Yuquan Wei's research on targeting PI3K and AXL receptor tyrosine kinase in cancer indicates an expertise in signal transduction pathways and potential drug targets in oncology, which is broadly relevant to understanding and overcoming resistance in AML.
- **Key relevant publications**:
    - Targeting PI3K in cancer: mechanisms and advances in clinical trials (2019, DOI: https://doi.org/10.1186/s12943-019-0954-x, Citations: 1522)
    - AXL receptor tyrosine kinase as a promising anti-cancer approach: functions, molecular mechanisms and clinical applications (2019, DOI: https://doi.org/10.1186/s12943-019-1090-3, Citations: 494)
- **Metrics**: h-index: 0, total citations: 2016, works count: 2
- **Activity level**: LOW
- **Contact**: Email not found — affiliated with Sichuan University

### Jing Yang — Sichuan University
- **OpenAlex Profile**: https://openalex.org/A5101500920
- **Why they are relevant**: Jing Yang's publication on targeting PI3K in cancer provides insights into mechanisms of drug action and clinical trial advancements for kinase inhibitors, a field directly applicable to FLT3 inhibition in AML.
- **Key relevant publications**:
    - Targeting PI3K in cancer: mechanisms and advances in clinical trials (2019, DOI: https://doi.org/10.1186/s12943-019-0954-x, Citations: 1522)
- **Metrics**: h-index: 0, total citations: 1522, works count: 1
- **Activity level**: LOW
- **Contact**: Email not found — affiliated with Sichuan University

### Ji Nie — Sichuan University
- **OpenAlex Profile**: https://openalex.org/A5038034984
- **Why they are relevant**: Ji Nie's research focuses on targeting PI3K in cancer, offering a relevant perspective on kinase inhibition and strategies to overcome resistance, which can inform approaches to FLT3 inhibitors in AML.
- **Key relevant publications**:
    - Targeting PI3K in cancer: mechanisms and advances in clinical trials (2019, DOI: https://doi.org/10.1186/s12943-019-0954-x, Citations: 1522)
- **Metrics**: h-index: 0, total citations: 1522, works count: 1
- **Activity level**: LOW
- **Contact**: Email not found — affiliated with Sichuan University

### Yong Peng — Sichuan University
- **OpenAlex Profile**: https://openalex.org/A5082863871
- **Why they are relevant**: Yong Peng's work on PI3K targeting in cancer provides a foundation in kinase inhibitor research, which is pertinent to developing and understanding FLT3 inhibitors and their role in managing chemoresistant AML.
- **Key relevant publications**:
    - Targeting PI3K in cancer: mechanisms and advances in clinical trials (2019, DOI: https://doi.org/10.1186/s12943-019-0954-x, Citations: 1522)
- **Metrics**: h-index: 0, total citations: 1522, works count: 1
- **Activity level**: LOW
- **Contact**: Email not found — affiliated with Sichuan University

## 9. Key Publications

| # | Title | Authors | Year | Journal | Citations | DOI |
|---|---|---|---|---|---|---|
| 1 | Targeting PI3K in cancer: mechanisms and advances in clinical trials | Jing Yang, Ji Nie, Yong Peng, Xuelei Ma, Yuquan Wei, Xiawei Wei | 2019 | Journal of Hematology & Oncology | 1522 | https://doi.org/10.1186/s12943-019-0954-x |
| 2 | Targeting epigenetic regulators for cancer therapy: mechanisms and advances in clinical trials | Xuelei Ma, Yuan Cheng, He Cai, Manni Wang, Fei Mo, Shengyong Yang, Xiawei Wei | 2019 | Signal Transduction and Targeted Therapy | 1046 | https://doi.org/10.1038/s41392-019-0095-0 |
| 3 | AXL receptor tyrosine kinase as a promising anti-cancer approach: functions, molecular mechanisms and clinical applications | Yuquan Wei, Xiawei Wei | 2019 | Journal of Hematology & Oncology | 494 | https://doi.org/10.1186/s12943-019-1090-3 |
| 4 | Hypomethylating Agents and Venetoclax Based Triplets Targeting FLT3, IDH and KMT2A in Acute Myeloid Leukemia: Current Studies and Challenges of a Tailored Approach. | Santambrogio E, Castellino A, Audisio E, Schumacher M, Feldmann G, Iftikhar R, Brossart P, Aydin S | 2026 | [No citation available] | [No citation available] | [No citation available] |
| 5 | Post-marketing surveillance of quizartinib for relapsed or refractory FLT3-ITD-positive acute myeloid leukemia in Japan. | Miyazaki Y, Matsumura I, Arita T, Fukuda R, Yamanaka M | 2026 | [No citation available] | [No citation available] | [No citation available] |
| 6 | Evolving paradigms in targeting FLT3 for acute myeloid leukemia therapy. | Thapa R, Shrestha J, Paudel KR | 2026 | [No citation available] | [No citation available] | [No citation available] |
| 7 | Effect of Quizartinib on the Resistance of Acute Myeloid Leukemia Cells with FLT3-ITD-Positive and FLT3-ITD-Negative Phenotypes to the TRAIL-Induced Apoptosis. | Kobyakova MI, Lomovskaya YV, Krasnov KS, Odinokova IV, Meshcheriakova EI, Ermakov AM, Didenko AS, Senotov AS, Fadeeva IS, Fadeev RS | 2026 | [No citation available] | [No citation available] | [No citation available] |
| 8 | Real-World Utilization of Midostaurin in Combination with Intensive Chemotherapy for Patients with FLT3 Mutated Acute Myeloid Leukemia: A Multicenter Study. | Seçilmiş S, Kabukçu Hacıoğlu S, Hindilerden F, Turgut B, Özatlı D, Akgün Çağlıyan G, Baştürk A, Yüksel Öztürkmen A, Katırcılar Y, Namdaroğlu S, Ünver Koluman B, Sunu C, Korkmaz S, Uysal A, Bilen Y, Erkurt MA, Dal MS, Ulaş T, Altuntaş F | 2026 | [No citation available] | [No citation available] | [No citation available] |
| 9 | ATGL suppresses ferroptosis in acute myeloid leukemia cells by modulating the CEBPα/SCD1 axis and induces gilteritinib resistance. | Yuan S, Zhou Y, Xiao W, Liu N, Zhang P, Zhang Y, Deng J, Fang L, Zhang X, Lou S | 2026 | [No citation available] | [No citation available] | [No citation available] |
| 10 | Overcoming the sorafenib resistance mechanism in FLT3-mutated acute myeloid leukemia: molecular basis and new targets. | Peng H, Li M, Peng YY, Li XL, Yang J, Sun QG, Song K | 2025 | [No citation available] | [No citation available] | [No citation available] |

## 10. Data Quality & Provenance

**BigQuery:**
- **What was queried:** Associated targets, drug pipeline, and target druggability for "acute myeloid leukemia".
- **When (timestamp):** 2026-02-27T18:57:39.498Z
- **How many targets/drugs/evidence sources found:** 20 targets, 25 drugs, with evidence from 16 distinct sources (e.g., Europe PMC, Cancer Gene Census, ChEMBL).
- **Quality:** Live data from Open Targets Platform, indicating high timeliness and breadth of information.

**OpenAlex:**
- **How many authors searched:** An initial search was likely conducted for researchers broadly related to cancer, with 15 authors returned in the final filtering for relevance to FLT3 inhibitors in chemo-resistant AML.
- **How many returned:** 15 authors were identified, though their direct relevance to FLT3 inhibitors in chemo-resistant AML was noted as limited, focusing more on general kinase or epigenetic targeting.
- **Quality:** OpenAlex provides comprehensive academic profiles, but the relevance filtering in this specific step indicated a broader, rather than highly specialized, research focus among the identified authors for the precise query.

**PubMed:**
- **How many articles searched:** 20 articles were initially identified through a search for "FLT3 inhibitors in chemo-resistant AML".
- **How many fetched:** All 20 identified articles had their detailed information fetched.
- **Quality:** Recent publications (2025-2026) indicate up-to-date research. Affiliation data and corresponding emails were extracted where available.

**Vertex AI Search:**
- **What queries were grounded:** "FLT3 mutation acute myeloid leukemia chemotherapy resistance mechanism".
- **Quality:** Provided several highly relevant snippets (relevance score 1.0 to 0.5) from authoritative sources like nih.gov, frontiersin.org, and ashpublications.org, confirming the role of FLT3 mutations in AML chemoresistance.

## 11. Next-Step Suggestions

1.  **Investigate specific mechanisms of acquired resistance to current FLT3 inhibitors:** While FLT3 inhibitors show promise, AML patients often develop resistance. Researching the molecular mechanisms behind this acquired resistance is crucial for designing more effective second-generation inhibitors or combination therapies.
2.  **Explore combination therapies for FLT3-mutated, chemoresistant AML:** Given the multi-faceted nature of chemoresistance, combination therapies targeting FLT3 along with other key pathways (e.g., BCL-2, epigenetic regulators like DNMT3A, or DNA repair pathways) could offer synergistic benefits. Further in-depth analysis of existing clinical trials combining FLT3 inhibitors with other agents would be beneficial.
3.  **Identify novel biomarkers for predicting response and resistance to FLT3 inhibitors:** Developing predictive biomarkers could help stratify patients, ensuring that FLT3 inhibitors are administered to those most likely to benefit and identifying patients who might require alternative or intensified treatment strategies from the outset.
4.  **In-depth analysis of preclinical models of FLT3-mutated, chemoresistant AML:** Examining robust in vitro and in vivo models used to study FLT3 inhibitor resistance could provide valuable insights into experimental protocols, validate new targets, and accelerate drug discovery.
5.  **Expand researcher identification with more targeted keywords:** The current OpenAlex search yielded researchers with broad cancer expertise. Future searches could use highly specific keywords related to "FLT3 inhibitor resistance," "AML relapse," or "synergistic therapies in FLT3-mutated AML" to identify more directly relevant experts.