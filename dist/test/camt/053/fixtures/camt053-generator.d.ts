/**
 * Emits one logical CAMT.053 statement in the wire structure of a given
 * schema version, so the version-matrix tests can prove the parser produces
 * identical output regardless of which version a bank sends.
 *
 * Only a handful of structures the parser depends on change between versions;
 * each is a switch in VERSION_PROFILES. Every profile row must be pinned from
 * evidence — the version's XSD, or real bank output — never from memory:
 *
 *   02  pinned from test/assets/goldman_sachs (real bank output)
 *   08  pinned from the ISO 20022 eRepository (2026-09-04 export),
 *       BankToCustomerStatementV08 — the same export independently
 *       reproduces the 02 and 12 rows below
 *   12  pinned from schemas/camt/camt.053.001.12.xsd
 *   13  pinned from the ISO 20022 eRepository (2026-09-04 export),
 *       BankToCustomerStatementV13
 *   14  pinned from the ISO 20022 eRepository (2026-09-04 export),
 *       BankToCustomerStatementV14
 *
 * To add a version, inspect its XSD for the three switches below and add a
 * row. The matrix test picks it up automatically and validates the generated
 * document against schemas/camt/camt.053.001.<version>.xsd when that file is
 * present.
 */
export declare const VERSION_PROFILES: {
    readonly '02': {
        /** Dbtr/Cdtr hold the party directly (Dbtr/Nm). */
        readonly partyWrapper: false;
        /** FinancialInstitutionIdentification7 spells it BIC. */
        readonly bicElement: "BIC";
        /** Sts is the EntryStatus2Code simple type. */
        readonly statusAsChoice: false;
    };
    readonly '08': {
        /** Dbtr/Cdtr are Party40Choice (Pty | Agt) — the same shape v12's Party50Choice keeps. */
        readonly partyWrapper: true;
        /** FinancialInstitutionIdentification18 spells it BICFI. */
        readonly bicElement: "BICFI";
        /** Sts is EntryStatus1Choice (Sts/Cd). */
        readonly statusAsChoice: true;
    };
    readonly '12': {
        /** Dbtr/Cdtr are Party50Choice; the party sits under Pty (Dbtr/Pty/Nm). */
        readonly partyWrapper: true;
        /** FinancialInstitutionIdentification23 spells it BICFI. */
        readonly bicElement: "BICFI";
        /** Sts is EntryStatus1Choice (Sts/Cd). */
        readonly statusAsChoice: true;
    };
    readonly '13': {
        /** Dbtr/Cdtr are Party50Choice (Pty | Agt). */
        readonly partyWrapper: true;
        /** FinancialInstitutionIdentification23 spells it BICFI. */
        readonly bicElement: "BICFI";
        /** Sts is EntryStatus1Choice (Sts/Cd). */
        readonly statusAsChoice: true;
    };
    readonly '14': {
        /** Dbtr/Cdtr are Party50Choice (Pty | Agt). */
        readonly partyWrapper: true;
        /** FinancialInstitutionIdentification23 spells it BICFI. */
        readonly bicElement: "BICFI";
        /** Sts is EntryStatus1Choice (Sts/Cd). */
        readonly statusAsChoice: true;
    };
};
export type Camt053Version = keyof typeof VERSION_PROFILES;
export declare const camt053Namespace: (version: Camt053Version) => string;
/**
 * Builds the statement. Element order follows the xs:sequence shared by every
 * version's AccountStatement / ReportEntry / EntryTransaction types; only the
 * profile switches change between versions.
 */
export declare const buildCamt053: (version: Camt053Version) => string;
