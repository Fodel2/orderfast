const ORDER_EMPTY_MESSAGES = [
  'No orders right now… shall we check the cleaning logs?',
  'All quiet on the frying pan front.',
  'Your ticket printer is sleeping. Shhh...',
  'Kitchen’s calm—dare we restock the napkins?',
  'Nothing cooking yet — maybe time for a tea?',
  'Still no dings. The bell is getting lonely.',
  'No orders, no chaos. Suspiciously peaceful.',
  'Perfect time to clean the sauce bottles again!',
  'No orders… did someone forget to open?',
];

export function getRandomOrderEmptyMessage() {
  return ORDER_EMPTY_MESSAGES[Math.floor(Math.random() * ORDER_EMPTY_MESSAGES.length)];
}
