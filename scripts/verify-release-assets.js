'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
function verify(manifest, version, url, zip, sidecar) {
    const entries = manifest.flatMap(p => p.versions || []).filter(v => v.version === version && v.sourceUrl === url);
    if (entries.length !== 1) throw new Error('Expected exactly one matching release');
    const md5 = crypto.createHash('md5').update(zip).digest('hex');
    if (!/^[a-f0-9]{32}$/i.test(entries[0].checksum) || md5 !== entries[0].checksum.toLowerCase()) throw new Error('Manifest MD5 mismatch');
    const match = sidecar.trim().match(/^([a-f0-9]{64})\s+\*?([^\r\n]+)$/i);
    if (!match || match[2].replaceAll('\\', '/').split('/').pop() !== `alpha-jump_${version}.zip`) throw new Error('Invalid SHA-256 sidecar');
    if (crypto.createHash('sha256').update(zip).digest('hex') !== match[1].toLowerCase()) throw new Error('SHA-256 mismatch');
}
module.exports = verify;
if (require.main === module) {
    const [manifest, version, url, zip, sidecar] = process.argv.slice(2);
    verify(JSON.parse(fs.readFileSync(manifest, 'utf8')), version, url, fs.readFileSync(zip), fs.readFileSync(sidecar, 'utf8'));
    console.log('Release asset MD5 and SHA-256 verified.');
}
