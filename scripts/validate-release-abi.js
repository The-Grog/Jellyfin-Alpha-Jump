/*
 * Keep the next release's catalog requirement aligned with the pinned Jellyfin
 * controller/model packages. Historical manifest entries intentionally are not
 * compared here: each must retain the ABI of the release that produced it.
 */
const fs = require('node:fs');

const project = fs.readFileSync('plugin/Jellyfin.Plugin.AlphaJump/Jellyfin.Plugin.AlphaJump.csproj', 'utf8');
const versions = ['Jellyfin.Controller', 'Jellyfin.Model'].map(name => {
    const match = project.match(new RegExp(`<PackageReference Include="${name}" Version="([^"]+)"`));
    if (!match) throw new Error(`Missing pinned ${name} package reference.`);
    return match[1];
});
if (versions[0] !== versions[1] || !/^\d+\.\d+\.\d+$/.test(versions[0])) {
    throw new Error('Jellyfin controller/model package versions must be the same three-part ABI version.');
}
const targetAbi = `${versions[0]}.0`;
const release = fs.readFileSync('.github/workflows/release.yml', 'utf8');
if (!new RegExp(`TARGET_ABI:\\s*${targetAbi.replaceAll('.', '\\.')}`).test(release)) {
    throw new Error(`Release workflow TARGET_ABI must be ${targetAbi}.`);
}
console.log(`Next-release ABI metadata matches Jellyfin packages: ${targetAbi}`);
