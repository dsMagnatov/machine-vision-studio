export function inkRGB(value, fallback, saturation = 1) {
  const rgb=/^#[0-9a-f]{6}$/i.test(value||'')?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)):fallback;
  const grey=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  return rgb.map(channel=>Math.round(Math.max(0,Math.min(255,grey+(channel-grey)*saturation)))).join(',');
}
