// ===== Consumo da D&D 5e API (https://www.dnd5eapi.co) =====
// Se a versão com "/2014" não responder, troque por "https://www.dnd5eapi.co/api".
const URL_BASE = "https://www.dnd5eapi.co/api/2014";

// Faz a requisição e lança um erro legível caso algo dê errado
async function requisitar(caminho) {
  let resposta;
  try {
    resposta = await fetch(URL_BASE + caminho);
  } catch (erro) {
    // fetch só rejeita quando não há conexão ou o servidor está inacessível
    throw new Error("Não foi possível conectar à API. Verifique sua internet.");
  }
  if (!resposta.ok) {
    throw new Error(`A API respondeu com erro ${resposta.status}.`);
  }
  return resposta.json();
}

// tipo: "monsters" ou "spells". Retorna [{ index, name, url }, ...]
export async function buscarLista(tipo, texto) {
  const filtro = texto ? `?name=${encodeURIComponent(texto)}` : "";
  const dados = await requisitar(`/${tipo}${filtro}`);
  return dados.results;
}

// Retorna todos os dados de um monstro ou de uma magia
export function buscarDetalhe(tipo, indice) {
  return requisitar(`/${tipo}/${encodeURIComponent(indice)}`);
}
