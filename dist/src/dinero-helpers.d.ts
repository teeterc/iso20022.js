import { type Dinero } from 'dinero.js';
import { Currency } from './lib/currency';
type DineroCurrency = {
    code: string;
    base: number;
    exponent: number;
};
export declare function currencyObj(code: Currency): DineroCurrency;
export declare function createDinero(amount: number, currency: Currency): Dinero<number, string>;
export declare function formatDinero(d: Dinero<number>): string;
export declare function formatAmount(amount: number, currency: Currency): string;
export declare function sumAmounts(amounts: number[], currency: Currency): string;
export {};
