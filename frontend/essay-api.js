
const API = 'http://localhost:3000/api'; // troque pelo endereço real do back-end em produção

async function callGroqAPI(theme, text) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Faça login para enviar a redação.');

  const response = await fetch(`${API}/essay/correct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ theme, text }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro ao corrigir a redação.');
  return data; // { notaFinal, statusNota, xpGanhos, comentarioGeral, criterios, sugestoes }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'': '&#39;' }[c]));
}