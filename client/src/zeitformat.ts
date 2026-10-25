/** Dauer als „45 Sek.“, „2:05“ oder ab einer Stunde „2:16:24“ */
export const formatDauer = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  if (totalSeconds < 60) return `${totalSeconds} Sek.`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${remainingSeconds}` : `${minutes}:${remainingSeconds}`;
};
