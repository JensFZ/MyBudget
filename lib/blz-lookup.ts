// FinTS server URLs for major German banks.
// Sparkasse and Volksbank vary by region — users must enter URL manually.
const BLZ_MAP: Record<string, string> = {
  // ING
  '50010517': 'https://fints.ing-diba.de/fints/',
  // DKB
  '12030000': 'https://banking.dkb.de/fints',
  // Comdirect
  '20041144': 'https://fints.comdirect.de/fints',
  // Postbank
  '20010020': 'https://mbs.postbank.de/',
  '10010010': 'https://mbs.postbank.de/',
  // Deutsche Bank
  '10020000': 'https://mbs.deutsche-bank.de/',
  '20070000': 'https://mbs.deutsche-bank.de/',
  '30070010': 'https://mbs.deutsche-bank.de/',
  '50070010': 'https://mbs.deutsche-bank.de/',
  '70070010': 'https://mbs.deutsche-bank.de/',
  // Commerzbank
  '20040000': 'https://fints.commerzbank.de/fints',
  '37040044': 'https://fints.commerzbank.de/fints',
  '50040000': 'https://fints.commerzbank.de/fints',
  '70040041': 'https://fints.commerzbank.de/fints',
  // HypoVereinsbank / UniCredit
  '70020270': 'https://fints.hypovereinsbank.de/fints',
  '10020200': 'https://fints.hypovereinsbank.de/fints',
  '20030000': 'https://fints.hypovereinsbank.de/fints',
  // Targobank
  '30020900': 'https://fints.targobank.de/fints',
  // Consorsbank
  '76030080': 'https://fints.consorsbank.de/banking',
  // 1822direkt (Frankfurter Sparkasse)
  '50050201': 'https://banking.1822direkt.com/HBCI',
  // N26 (kein FinTS)
  // Revolut (kein FinTS)
};

export function lookupFintsUrl(blz: string): string | null {
  return BLZ_MAP[blz.replace(/\s/g, '')] ?? null;
}
