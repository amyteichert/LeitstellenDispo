export const formatCurrency = (value: number) => {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(normalized)} €`;
};
