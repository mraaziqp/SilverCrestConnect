import fs from 'fs';

const b64 = fs.readFileSync('public/logo.png').toString('base64');
const svgGold = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 305 269" fill="none">
  <defs>
    <filter id="gold-color" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="
        0 0 0 0 0.7725
        0 0 0 0 0.6275
        0 0 0 0 0.3490
        0 0 0 1 0" />
    </filter>
    <filter id="white-color" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="
        0 0 0 0 1
        0 0 0 0 1
        0 0 0 0 1
        0 0 0 1 0" />
    </filter>
  </defs>
  <image href="data:image/png;base64,${b64}" width="305" height="269" filter="url(#gold-color)" />
</svg>`;

const svgWhite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 305 269" fill="none">
  <defs>
    <filter id="white-color" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="
        0 0 0 0 1
        0 0 0 0 1
        0 0 0 0 1
        0 0 0 1 0" />
    </filter>
  </defs>
  <image href="data:image/png;base64,${b64}" width="305" height="269" filter="url(#white-color)" />
</svg>`;

fs.writeFileSync('public/logo-gold.svg', svgGold);
fs.writeFileSync('public/logo-white.svg', svgWhite);
fs.writeFileSync('public/logo.svg', svgGold);
console.log('Saved SVG logos in public/');
