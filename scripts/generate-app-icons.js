const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const repoRoot = path.resolve(__dirname, '..');
    // source: use the copy in client/public if present, otherwise branding folder
    const possible = [
      path.join(repoRoot, 'client', 'public', 'brand-banner.png'),
      path.join(repoRoot, 'branding', 'banner.png'),
    ];

    const input = possible.find((p) => fs.existsSync(p));
    if (!input) throw new Error('Source image not found in client/public/brand-banner.png or branding/banner.png');

    const out512 = path.join(repoRoot, 'client', 'public', 'app-icon-512.webp');
    const out256 = path.join(repoRoot, 'client', 'public', 'app-icon-256.webp');

    console.log('Using input:', input);

    // Ensure output dir exists
    fs.mkdirSync(path.dirname(out512), { recursive: true });

    // 512x512
    await sharp(input)
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80, effort: 6 })
      .toFile(out512);

    // 256x256 (for non-retina)
    await sharp(input)
      .resize(256, 256, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80, effort: 6 })
      .toFile(out256);

    // Also generate PNG sizes for manifest / favicon usage
    const out512png = path.join(repoRoot, 'client', 'public', 'app-icon-512.png');
    const out192png = path.join(repoRoot, 'client', 'public', 'app-icon-192.png');
    const out32png = path.join(repoRoot, 'client', 'public', 'app-icon-32.png');

    await sharp(input)
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .png({ quality: 90 })
      .toFile(out512png);

    await sharp(input)
      .resize(192, 192, { fit: 'cover', position: 'centre' })
      .png({ quality: 90 })
      .toFile(out192png);

    await sharp(input)
      .resize(32, 32, { fit: 'cover', position: 'centre' })
      .png({ quality: 90 })
      .toFile(out32png);

    console.log('Wrote', out512);
    console.log('Wrote', out256);
    console.log('Wrote', out512png);
    console.log('Wrote', out192png);
    console.log('Wrote', out32png);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();