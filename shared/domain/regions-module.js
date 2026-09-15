const REGION_DISPLAY_NAMES = Object.freeze({
  "Yorkshire and The Humber": "Yorkshire & Humber",
});

export function formatRegionDisplayName(canonicalName) {
  return REGION_DISPLAY_NAMES[canonicalName] || canonicalName;
}

export default Object.freeze({
  formatRegionDisplayName,
});
