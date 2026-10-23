// Owner-approved catalog (price list supplied 2026-10-16). Applied on top of the preserved
// revamp.html catalog: sets every price, corrects amounts, adds new listings and fixes order.
// Specs for new single peptides were checked against supplier datasheets; blends and anything
// uncertain show "Confirm on lot COA" on the site.
export const CATALOG_ORDER = [
  ['retatrutide-20', 65], ['retatrutide-30', 85], ['retatrutide-40', 95],
  ['tesamorelin-10', 50], ['tesamorelin-20', 80], ['sermorelin-10', 50],
  ['cjc-dac-10', 45], ['cjc-nodac-10', 45], ['cjc-ipa-blend', 45],
  ['ipamorelin-5', 35], ['ipamorelin-10', 60], ['blend-ipa-tesa', 75],
  ['bpc157-10', 65], ['tb500-5', 45], ['tb500-10', 60], ['blend-bpc-tb', 65],
  ['ghkcu-100', 35], ['blend-gbt', 70], ['blend-gbtk', 75], ['kpv-10', 35],
  ['motsc-40', 75], ['pt141-1', 35], ['semax-10', 35], ['selank-10', 35],
  ['dsip-5', 40], ['epitalon-10', 65], ['mt2-10', 30], ['nad-1000', 60],
  ['cardiogen-10', 40], ['vip-10', 40], ['blend-wolverine', 65]
];

// Changes to existing listings.
export const CATALOG_EDITS = {
  'blend-gbtk': { mg: '80 mg' },
  // Renamed to RT3 (Oct 23). Original labels saved in design/backup-retatrutide-original/.
  'retatrutide-20': { name: 'RT3' }, 'retatrutide-30': { name: 'RT3' }, 'retatrutide-40': { name: 'RT3' }
};

const copy = (from, changes) => ({ from, ...changes });
export const CATALOG_ADDITIONS = {
  'retatrutide-20': copy('retatrutide-30', { mg: '20 mg' }),
  'retatrutide-40': copy('retatrutide-30', { mg: '40 mg' }),
  'tesamorelin-20': copy('tesamorelin-10', { mg: '20 mg' }),
  'cjc-nodac-10': { name: 'CJC-1295 without DAC', mg: '10 mg', cat: 'GHRH analogs', cas: '863288-34-0', formula: 'C152H252N44O42', mw: '3367.9 g/mol', type: 'Synthetic peptide (29 aa), Mod GRF 1-29' },
  'blend-ipa-tesa': { name: 'Ipamorelin / Tesamorelin Blend', mg: '10 mg / 10 mg', cat: 'Blends', cas: null, formula: null, mw: null, type: 'Two-component research blend', comp: 'Ipamorelin 10 mg; Tesamorelin 10 mg' },
  'blend-bpc-tb': { name: 'BPC-157 / TB-500 Blend', mg: '10 mg / 10 mg', cat: 'Blends', cas: null, formula: null, mw: null, type: 'Two-component research blend', comp: 'BPC-157 10 mg; TB-500 10 mg' },
  'kpv-10': { name: 'KPV', mg: '10 mg', cat: 'Short peptides', cas: '67727-97-3', formula: 'C16H30N4O4', mw: '342.4 g/mol', type: 'Tripeptide (Lys-Pro-Val)' },
  'motsc-40': { name: 'MOTS-C', mg: '40 mg', cat: 'Mitochondrial peptides', cas: '1627580-64-6', formula: 'C101H152N28O22S2', mw: '2174.6 g/mol', type: 'Mitochondrial-derived peptide (16 aa)' },
  'pt141-1': { name: 'PT-141', mg: '1 mg', cat: 'Melanocortin analogs', cas: '189691-06-3', formula: 'C50H68N14O10', mw: '1025.2 g/mol', type: 'Cyclic heptapeptide (bremelanotide)' },
  'cardiogen-10': { name: 'Cardiogen', mg: '10 mg', cat: 'Short peptides', cas: '857267-11-9', formula: 'C18H31N7O9', mw: '489.5 g/mol', type: 'Tetrapeptide (Ala-Glu-Asp-Arg)' },
  'vip-10': { name: 'VIP', mg: '10 mg', cat: 'Neuropeptides', cas: '40077-57-4', formula: 'C147H238N44O42S', mw: '3325.8 g/mol', type: 'Vasoactive intestinal peptide (28 aa)' },
  'blend-wolverine': { name: 'Wolverine Blend', mg: '20 mg', cat: 'Blends', cas: null, formula: null, mw: null, type: 'Research blend', comp: 'Composition per lot COA' }
};

export function applyCatalogUpdate(products) {
  const byId = new Map(products.map(p => [p.id, p]));
  return CATALOG_ORDER.map(([id, price]) => {
    let p = byId.get(id);
    if (!p) {
      const add = CATALOG_ADDITIONS[id];
      if (!add) throw new Error(`Catalog update: unknown product ${id}`);
      const { from, ...rest } = add;
      p = { ...(from ? byId.get(from) : {}), ...rest, id };
    }
    return { ...p, ...(CATALOG_EDITS[id] || {}), price };
  });
}
