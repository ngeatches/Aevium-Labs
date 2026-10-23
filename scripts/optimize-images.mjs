import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Optional authoring utility: provide SHARP_MODULE or install sharp locally.
// Site build and preview have no dependency on this image-export utility.
const { default: sharp } = await import(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'design/products');
const output = path.join(root, 'site/assets/images/products');
await mkdir(output, { recursive:true });
const files = (await readdir(input)).filter(file => file.endsWith('.png')).sort();
const report = [];
for (const file of files) {
  const id = file.slice(0,-4);
  for (const width of [640,1024]) {
    const result = await sharp(path.join(input,file)).resize({width,withoutEnlargement:true}).webp({quality:85,effort:5}).toFile(path.join(output,`${id}-${width}.webp`));
    report.push({file:`${id}-${width}.webp`,width:result.width,height:result.height,bytes:result.size});
  }
}
await writeFile(path.join(root,'design/image-exports.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Exported ${files.length} product images in two responsive sizes. Total: ${Math.round(report.reduce((sum,item)=>sum+item.bytes,0)/1024)} KiB. Largest: ${Math.round(Math.max(...report.map(item=>item.bytes))/1024)} KiB.`);
