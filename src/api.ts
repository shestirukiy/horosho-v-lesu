export interface UserStats {
  "Артем": number | string;
  "Ирина": number | string;
}

export interface CoupleStats {
  "Секс": { "Артем": number; "Ирина": number };
  "Секс пожелания": { "Артем": string; "Ирина": string };
  "Общение": { "Артем": number; "Ирина": number };
  "Общение пожелания": { "Артем": string; "Ирина": string };
  "Быт": { "Артем": number; "Ирина": number };
  "Быт пожелания": { "Артем": string; "Ирина": string };
  "Цвет": { "Артем": string; "Ирина": string };
  "Секс динамика": { "Артем": string; "Ирина": string };
  "Общение динамика": { "Артем": string; "Ирина": string };
  "Быт динамика": { "Артем": string; "Ирина": string };
}

export const API_URL = 'https://script.google.com/macros/s/AKfycbzSGd0RJp8SOB2B3Bc4UL7MbqjAty7BrIdNxFjSigYbdSflnW6YziJDs3J7b6J27Sbb/exec';

export async function fetchStats(): Promise<CoupleStats> {
  const res = await fetch(API_URL, {
    method: 'GET',
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Ошибка загрузки: ${res.status}`);
  }
  return await res.json();
}

export async function updateStat(category: string, user: string, value: number | string): Promise<boolean> {
  const res = await fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ category, user, value }),
  });
  const text = await res.text();
  return text.includes('OK');
}
