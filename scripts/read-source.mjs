import { readFile } from 'node:fs/promises';
import { BRAND_NAME, FORMER_BRAND_NAME } from './brand.mjs';
import { applyCatalogUpdate } from './catalog-update.mjs';

// Read literal content only. Never execute the scripts in the supplied mock-up.
export async function readSource(filename) {
  // Rebrand on read so the preserved mock-up file itself stays unchanged.
  const source = (await readFile(filename, 'utf8')).replaceAll(FORMER_BRAND_NAME, BRAND_NAME);
  const required = (pattern, label, text = source) => {
    const match = text.match(pattern);
    if (!match) throw new Error(`Source content not found: ${label}`);
    return match[1];
  };
  const literals = text => Object.fromEntries([...text.matchAll(/\b(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|null|\d+)/g)].map(([,key,value]) => [key, JSON.parse(value)]));
  const store = literals(required(/const STORE = \{([\s\S]*?)\n\};/, 'store'));
  const sourceProducts = [...required(/const P = \[([\s\S]*?)\n\];/, 'catalog').matchAll(/\{([^{}]+)\}/g)].map(([,entry])=>literals(entry));
  const prose = Object.fromEntries([...source.matchAll(/\b(quality|institutional|faq|contact|shipping|refunds|ruo|terms|privacy):\["([^"]+)",`([\s\S]*?)`\]/g)].map(([,key,title,body])=>[key,{title,body}]));
  const home = required(/V\.home = \(\)=>`([\s\S]*?)`;\n/, 'homepage');
  const hero = {
    eyebrow: required(/<span class="eyebrow">([^<]+)<\/span>/, 'hero eyebrow', home),
    title: required(/<h1>([\s\S]*?)<\/h1>/, 'hero title', home),
    description: required(/<p class="lede">([\s\S]*?)<\/p>/, 'hero copy', home),
    specification: required(/<div class="hero-spec"[\s\S]*?<dl>([\s\S]*?)<\/dl>/, 'hero specification', home)
  };
  const pillars = [...home.matchAll(/<div><span class="k">([^<]+)<\/span><p>([^<]+)<\/p><\/div>/g)].map(([,title,text])=>({title,text}));
  const documentBlock = required(/<span class="eyebrow">Documentation<\/span>([\s\S]*?)<div><a/, 'documentation', home);
  const coa = required(/<div class="coa"[^>]*>([\s\S]*?)\n  <\/div>/, 'sample COA', home);
  const institutional = required(/<span class="eyebrow">Institutional purchasing<\/span>([\s\S]*?)<div><a/, 'institutional', home);
  const steps = required(/<ol class="steps">([\s\S]*?)<\/ol>/, 'ordering steps', home);
  const footer = required(/<div class="fdisc">\s*<p>([\s\S]*?)<\/p>/, 'footer');
  if (sourceProducts.length !== 19 || pillars.length !== 4 || Object.keys(prose).length !== 9) throw new Error('Unexpected source inventory');
  const products = applyCatalogUpdate(sourceProducts);
  return { source,store,products,prose,hero,pillars,documentBlock,coa,institutional,steps,footer };
}
