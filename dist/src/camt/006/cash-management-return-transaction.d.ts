import { BusinessError } from "../types";
import { GenericISO20022Message, ISO20022MessageTypeName } from "../../lib/interfaces";
import { Agent, MessageHeader, Party } from "../../lib/types";
import { Currency } from "../../lib/currency";
export interface TransactionReport {
    msgId?: string;
    reqExecutionDate?: Date;
    /**
     * Payment status. `code` is `<branch>:<value>` over PaymentStatusCode6Choice
     * (e.g. `Sttlm:ACCC`, `Fnl:STLD`, `Prtry:CUST`). `reason` follows the same
     * convention for the coded branches of PaymentStatusReason1Choice
     * (`Umtchd:DMON`, `Canc:CANI`, `PrtryRjctn:XXXX`) and is the bare text for
     * the Prtry branch. Only the first Sts and first Rsn are read.
     */
    status?: {
        code: string;
        reason?: string;
    };
    /** Party50Choice: a party (Pty) or, when the bank identifies it as an institution, just an agent. */
    debtor?: Party;
    debtorAgent?: Agent;
    creditor?: Party;
    creditorAgent?: Agent;
}
/** Which branch of PaymentIdentification8Choice carried the identifier. */
export type PaymentIdentifierType = 'TxId' | 'UETR' | 'QId' | 'LngBizId' | 'ShrtBizId' | 'PrtryId';
export interface PaymentIdentification {
    identifierType: PaymentIdentifierType;
    /**
     * LngBizId/IntrBkSttlmAmt is ImpliedCurrencyAndAmount — a bare decimal. The
     * currency is read from Tx/Pmt/IntrBkSttlmAmt or InstdAmt (AmtWthCcy) when
     * the bank provides it. Absent that, `amount` is converted assuming two
     * decimal places.
     */
    currency?: Currency;
    /** In the smallest unit of `currency`. Only LngBizId carries an amount. */
    amount?: number;
    /** IntrBkSttlmDt — mandatory on both LngBizId and ShrtBizId. */
    settlementDate?: Date;
    instructingAgent?: Agent;
    instructedAgent?: Agent;
    endToEndId?: string;
    transactionId?: string;
    uetr?: string;
    queueId?: string;
    proprietaryId?: string;
}
export interface TransactionReportOrError {
    paymentId: PaymentIdentification;
    report?: TransactionReport;
    error?: BusinessError;
}
export interface CashManagementReturnTransactionData {
    header: MessageHeader;
    reports: TransactionReportOrError[];
}
export declare class CashManagementReturnTransaction implements GenericISO20022Message {
    private _data;
    constructor(data: CashManagementReturnTransactionData);
    get data(): CashManagementReturnTransactionData;
    static supportedMessages(): ISO20022MessageTypeName[];
    static fromDocumentOject(doc: any): CashManagementReturnTransaction;
    static fromXML(xml: string): CashManagementReturnTransaction;
    static fromJSON(json: string): CashManagementReturnTransaction;
    serialize(): string;
    toJSON(): any;
}
