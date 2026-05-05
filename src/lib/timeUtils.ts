export const msToTimeStr = (ms: number) => {
  const totalMs = Math.max(0, ms);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const mm = Math.floor(totalMs % 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${mm.toString().padStart(3, '0')}`;
};

export const timeStrToMs = (str: string) => {
  if (!str) return 0;
  // Remove negative signs if any
  const cleanStr = str.replace(/-/g, '');
  const parts = cleanStr.split('.');
  const hms = parts[0] || "00:00:00";
  const mm = (parts[1] || "000").padEnd(3, '0').slice(0, 3);
  
  let h = 0, m = 0, s = 0;
  const hmsParts = hms.split(':').reverse();
  
  if (hmsParts[0]) s = parseInt(hmsParts[0]) || 0;
  if (hmsParts[1]) m = parseInt(hmsParts[1]) || 0;
  if (hmsParts[2]) h = parseInt(hmsParts[2]) || 0;
  
  return Math.max(0, (h * 3600000) + (m * 60000) + (s * 1000) + (parseInt(mm) || 0));
};
