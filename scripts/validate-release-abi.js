/*
 * Keep the published catalog requirement aligned with the pinned Jellyfin
 * controller/model packages. This validates metadata only; it never changes
 * release assets or a manifest entry's URL, checksum, version, or timestamp.
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
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
for (const plugin of manifest) {
    for (const releaseEntry of plugin.versions || []) {
        if (releaseEntry.targetAbi !== targetAbi) {
            throw new Error(`Manifest ${releaseEntry.version} targetAbi must be ${targetAbi}.`);
        }
    }
}
console.log(`Release ABI metadata matches Jellyfin packages: ${targetAbi}`);
