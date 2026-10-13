import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('Logo.png');
const publicDir = resolve('public');
const destination = resolve(publicDir, 'nyayaai-logo.png');

await mkdir(publicDir, { recursive: true });
await copyFile(source, destination);
console.log('Prepared NyayaAI branding from Logo.png');
