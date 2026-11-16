// ===== Lógica principal da interface =====
import { buscarLista, buscarDetalhe } from "./api.js";
import { criar, listar, atualizar, excluir, sair, observarLogin } from "./firebase.js";

// ---------- Estado da aplicação ----------
let favoritos = [];            // documentos da coleção "grimorio"
let encontros = [];            // documentos da coleção "encontros"
let itemAberto = null;         // { tipo, dados } do modal em modo "salvar"
let favoritoEmEdicao = null;   // id do favorito sendo editado
let encontroEmEdicao = null;   // id do encontro sendo editado

const NOMES_TIPO = { monsters: "Monstro", spells: "Magia" };

// ---------- Atalhos e utilitários ----------
const $ = (id) => document.getElementById(id);

// Evita que texto digitado vire HTML (proteção contra XSS)
function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// Exibe uma mensagem temporária de sucesso ou erro
function mostrarToast(mensagem, tipo = "sucesso") {
  const toast = document.createElement("div");
  toast.className = `toast ${tipo === "erro" ? "erro" : ""}`;
  toast.textContent = mensagem;
  $("toasts").appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Mostra o indicador de carregamento ou uma mensagem de estado em um elemento .status
function definirStatus(elemento, texto, { carregando = false, erro = false } = {}) {
  elemento.className = `status ${erro ? "erro" : ""}`;
  elemento.innerHTML = (carregando ? '<span class="spinner"></span>' : "") + escapar(texto);
}

// Converte "chefe, área urbana" em ["chefe", "área urbana"]
function lerTags(texto) {
  return texto.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
}

function formatarCR(cr) {
  return { 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[cr] ?? String(cr);
}

// ---------- Navegação por abas ----------
function mostrarAba(nome) {
  document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === nome));
  document.querySelectorAll(".painel").forEach((p) => (p.hidden = p.id !== `aba-${nome}`));
}

// ---------- SESSÃO DO USUÁRIO (login feito em login.html) ----------
// Mostra o site depois que o Firebase confirma que há alguém logado
function mostrarApp(usuario) {
  document.querySelectorAll(".topo, main, footer").forEach((e) => (e.hidden = false));
  $("usuario-nome").textContent = usuario.displayName || usuario.email;
}

// Carrega os dados do usuário logado (cada um só enxerga os próprios)
function iniciarApp() {
  carregarFavoritos();
  carregarEncontros();
  carregarSessoes();
}

async function fazerLogout() {
  if (temPendencias()) {
    if (!confirm("Há anotações de sessão não salvas. Sair mesmo assim? Elas serão perdidas.")) return;
    rascunho = structuredClone(sessoesSalvas); // descarta, para o aviso de beforeunload não aparecer
  }
  try {
    await sair(); // o observarLogin leva para login.html
  } catch (erro) {
    mostrarToast("Não foi possível sair: " + erro.message, "erro");
  }
}

// ---------- BUSCA NA API ----------
async function pesquisar(evento) {
  evento.preventDefault();
  const tipo = $("busca-tipo").value;
  const texto = $("busca-texto").value.trim();
  $("busca-resultados").innerHTML = "";
  definirStatus($("busca-status"), "Consultando a API...", { carregando: true });
  try {
    const lista = await buscarLista(tipo, texto);
    if (lista.length === 0) {
      definirStatus($("busca-status"), "Nada encontrado. Tente outro nome em inglês.");
      return;
    }
    definirStatus($("busca-status"), `${lista.length} resultado(s).`);
    renderizarResultados(lista, tipo);
  } catch (erro) {
    definirStatus($("busca-status"), erro.message, { erro: true });
  }
}

function renderizarResultados(lista, tipo) {
  $("busca-resultados").innerHTML = lista.map((item) => `
    <article class="card">
      <h3>${escapar(item.name)}</h3>
      <p class="meta">${NOMES_TIPO[tipo]}</p>
      <div class="acoes">
        <button class="botao pequeno" data-acao="detalhes" data-tipo="${tipo}" data-indice="${escapar(item.index)}">Ver e salvar</button>
      </div>
    </article>`).join("");
}

// Busca os detalhes na API e abre o modal para salvar no grimório
async function abrirDetalhes(tipo, indice) {
  try {
    mostrarToast("Carregando detalhes...");
    const dados = await buscarDetalhe(tipo, indice);
    itemAberto = { tipo, dados };
    favoritoEmEdicao = null;
    $("modal-titulo").textContent = dados.name;
    $("modal-detalhes").innerHTML = montarDetalhes(tipo, dados);
    $("modal-nota").value = "";
    $("modal-tags").value = "";
    $("modal-confirmar").textContent = "Salvar no grimório";
    $("modal").showModal();
  } catch (erro) {
    mostrarToast(erro.message, "erro");
  }
}

// Monta o HTML com os dados principais de um monstro ou magia
function montarDetalhes(tipo, d) {
  if (tipo === "monsters") {
    const ca = d.armor_class?.[0]?.value ?? "?";
    const acoes = (d.actions || []).map((a) => escapar(a.name)).join(", ") || "nenhuma";
    return `<div class="detalhes">
      <p>${escapar(d.size)} ${escapar(d.type)}, ${escapar(d.alignment)}</p>
      <div class="atributos">
        <span>CR ${formatarCR(d.challenge_rating)}</span><span>CA ${ca}</span><span>PV ${d.hit_points}</span>
        <span>FOR ${d.strength}</span><span>DES ${d.dexterity}</span><span>CON ${d.constitution}</span>
        <span>INT ${d.intelligence}</span><span>SAB ${d.wisdom}</span><span>CAR ${d.charisma}</span>
      </div>
      <p><strong>Ações:</strong> ${acoes}</p></div>`;
  }
  return `<div class="detalhes">
    <div class="atributos">
      <span>Nível ${d.level}</span><span>${escapar(d.school?.name)}</span>
      <span>Alcance: ${escapar(d.range)}</span><span>Conjuração: ${escapar(d.casting_time)}</span>
      <span>Duração: ${escapar(d.duration)}</span>
    </div>
    <p>${escapar((d.desc || []).join(" "))}</p></div>`;
}

// ---------- GRIMÓRIO (CRUD 1) ----------
async function carregarFavoritos() {
  definirStatus($("grimorio-status"), "Carregando grimório...", { carregando: true });
  try {
    favoritos = await listar("grimorio");
    definirStatus($("grimorio-status"), "");
    $("contador-grimorio").textContent = favoritos.length;
    preencherFiltroTags();
    renderizarGrimorio();
    renderizarOpcoesMonstros();
  } catch (erro) {
    definirStatus($("grimorio-status"), "Erro ao carregar o grimório: " + erro.message, { erro: true });
  }
}

// CREATE: salva o item aberto no modal
async function salvarFavorito() {
  const { tipo, dados } = itemAberto;
  const registro = {
    indice: dados.index, nome: dados.name, tipo,
    cr: tipo === "monsters" ? dados.challenge_rating : null,
    nivel: tipo === "spells" ? dados.level : null,
    nota: $("modal-nota").value.trim(),
    tags: lerTags($("modal-tags").value)
  };
  await criar("grimorio", registro);
  mostrarToast(`${dados.name} foi salvo no grimório.`);
  await carregarFavoritos();
}

// UPDATE: abre o modal com nota e tags atuais
function abrirEdicao(id) {
  const fav = favoritos.find((f) => f.id === id);
  favoritoEmEdicao = id;
  itemAberto = null;
  $("modal-titulo").textContent = fav.nome;
  $("modal-detalhes").innerHTML = "";
  $("modal-nota").value = fav.nota || "";
  $("modal-tags").value = (fav.tags || []).join(", ");
  $("modal-confirmar").textContent = "Salvar alterações";
  $("modal").showModal();
}

async function salvarEdicao() {
  await atualizar("grimorio", favoritoEmEdicao, {
    nota: $("modal-nota").value.trim(),
    tags: lerTags($("modal-tags").value)
  });
  mostrarToast("Alterações salvas.");
  await carregarFavoritos();
}

// DELETE
async function excluirFavorito(id) {
  const fav = favoritos.find((f) => f.id === id);
  if (!confirm(`Remover "${fav.nome}" do grimório?`)) return;
  try {
    await excluir("grimorio", id);
    mostrarToast("Removido do grimório.");
    await carregarFavoritos();
  } catch (erro) {
    mostrarToast("Não foi possível remover: " + erro.message, "erro");
  }
}

function preencherFiltroTags() {
  const atual = $("filtro-tag").value;
  const todas = [...new Set(favoritos.flatMap((f) => f.tags || []))].sort();
  $("filtro-tag").innerHTML = '<option value="">Todas as tags</option>' +
    todas.map((t) => `<option value="${escapar(t)}">${escapar(t)}</option>`).join("");
  $("filtro-tag").value = todas.includes(atual) ? atual : "";
}

function dentroDaFaixaCR(cr, faixa) {
  if (!faixa) return true;
  if (cr === null || cr === undefined) return false; // magias não têm CR
  if (faixa === "10+") return cr >= 10;
  const [min, max] = faixa.split("-").map(Number);
  return cr >= min && cr < max + 1;
}

// Aplica busca por texto, tipo, CR e tag sobre a lista já carregada
function renderizarGrimorio() {
  const texto = $("filtro-texto").value.trim().toLowerCase();
  const tipo = $("filtro-tipo").value;
  const faixa = $("filtro-cr").value;
  const tag = $("filtro-tag").value;

  const filtrados = favoritos.filter((f) =>
    (!texto || f.nome.toLowerCase().includes(texto) || (f.nota || "").toLowerCase().includes(texto)) &&
    (!tipo || f.tipo === tipo) &&
    dentroDaFaixaCR(f.cr, faixa) &&
    (!tag || (f.tags || []).includes(tag)));

  if (filtrados.length === 0) {
    $("grimorio-lista").innerHTML = `<p class="status">${favoritos.length === 0
      ? "Seu grimório está vazio. Pesquise na aba Buscar e salve seu primeiro favorito."
      : "Nenhum favorito corresponde aos filtros."}</p>`;
    return;
  }
  $("grimorio-lista").innerHTML = filtrados.map((f) => `
    <article class="card">
      <h3>${escapar(f.nome)}</h3>
      <p class="meta">${NOMES_TIPO[f.tipo]} · ${f.tipo === "monsters" ? "CR " + formatarCR(f.cr) : "Nível " + f.nivel}</p>
      ${f.nota ? `<p class="nota">${escapar(f.nota)}</p>` : ""}
      <div class="tags">${(f.tags || []).map((t) => `<span class="tag">${escapar(t)}</span>`).join("")}</div>
      <div class="acoes">
        <button class="botao secundario pequeno" data-acao="editar" data-id="${f.id}">Editar</button>
        <button class="botao perigo pequeno" data-acao="excluir" data-id="${f.id}">Excluir</button>
      </div>
    </article>`).join("");
}

// ---------- ENCONTROS (CRUD 2) ----------
async function carregarEncontros() {
  definirStatus($("encontros-status"), "Carregando encontros...", { carregando: true });
  try {
    encontros = await listar("encontros");
    definirStatus($("encontros-status"), "");
    renderizarEncontros();
  } catch (erro) {
    definirStatus($("encontros-status"), "Erro ao carregar encontros: " + erro.message, { erro: true });
  }
}

// Lista os monstros salvos como caixas de seleção, mantendo a seleção atual
function renderizarOpcoesMonstros(selecionados = []) {
  const monstros = favoritos.filter((f) => f.tipo === "monsters");
  $("encontro-monstros").innerHTML = monstros.length === 0
    ? "<p>Salve monstros no grimório para montar um encontro.</p>"
    : monstros.map((m) => `
      <label><input type="checkbox" value="${m.id}" ${selecionados.includes(m.indice) ? "checked" : ""}>
        ${escapar(m.nome)} (CR ${formatarCR(m.cr)})</label>`).join("");
}

// CREATE ou UPDATE, conforme haja um encontro em edição
async function salvarEncontro(evento) {
  evento.preventDefault();
  const marcados = [...document.querySelectorAll("#encontro-monstros input:checked")].map((i) => i.value);
  if (marcados.length === 0) {
    mostrarToast("Escolha pelo menos um monstro.", "erro");
    return;
  }
  const dados = {
    nome: $("encontro-nome").value.trim(),
    monstros: marcados.map((id) => {
      const m = favoritos.find((f) => f.id === id);
      return { indice: m.indice, nome: m.nome, cr: m.cr };
    })
  };
  try {
    if (encontroEmEdicao) {
      await atualizar("encontros", encontroEmEdicao, dados);
      mostrarToast("Encontro atualizado.");
    } else {
      await criar("encontros", dados);
      mostrarToast("Encontro criado.");
    }
    limparFormEncontro();
    await carregarEncontros();
  } catch (erro) {
    mostrarToast("Erro ao salvar o encontro: " + erro.message, "erro");
  }
}

function renderizarEncontros() {
  if (encontros.length === 0) {
    $("encontros-lista").innerHTML = '<p class="status">Nenhum encontro ainda. Monte o primeiro acima.</p>';
    return;
  }
  $("encontros-lista").innerHTML = encontros.map((e) => `
    <article class="card">
      <h3>${escapar(e.nome)}</h3>
      <p class="meta">${e.monstros.length} monstro(s)</p>
      <div class="tags">${e.monstros.map((m) => `<span class="tag">${escapar(m.nome)}</span>`).join("")}</div>
      <div class="acoes">
        <button class="botao secundario pequeno" data-acao="editar-encontro" data-id="${e.id}">Editar</button>
        <button class="botao perigo pequeno" data-acao="excluir-encontro" data-id="${e.id}">Excluir</button>
      </div>
    </article>`).join("");
}

function editarEncontro(id) {
  const enc = encontros.find((e) => e.id === id);
  encontroEmEdicao = id;
  $("titulo-form-encontro").textContent = "Editar encontro";
  $("btn-salvar-encontro").textContent = "Salvar alterações";
  $("btn-cancelar-encontro").hidden = false;
  $("encontro-nome").value = enc.nome;
  renderizarOpcoesMonstros(enc.monstros.map((m) => m.indice));
  $("form-encontro").scrollIntoView({ behavior: "smooth" });
}

function limparFormEncontro() {
  encontroEmEdicao = null;
  $("form-encontro").reset();
  $("titulo-form-encontro").textContent = "Novo encontro";
  $("btn-salvar-encontro").textContent = "Salvar encontro";
  $("btn-cancelar-encontro").hidden = true;
  renderizarOpcoesMonstros();
}

async function excluirEncontro(id) {
  const enc = encontros.find((e) => e.id === id);
  if (!confirm(`Excluir o encontro "${enc.nome}"?`)) return;
  try {
    await excluir("encontros", id);
    mostrarToast("Encontro excluído.");
    await carregarEncontros();
  } catch (erro) {
    mostrarToast("Não foi possível excluir: " + erro.message, "erro");
  }
}

// ---------- ANOTAÇÕES SOBRE A SESSÃO (CRUD 3) ----------
const COLECAO_SESSOES = "sessoes";
const COR_SALVO = "#b3844f";
const COR_PENDENTE = "#cbcaae";

let sessoesSalvas = {};  // o que está no Firestore, indexado por data "AAAA-MM-DD"
let rascunho = {};       // cópia editável: as alterações pendentes ficam aqui
let calendario = null;   // instância do FullCalendar, criada na primeira abertura da aba
let catalogo = { monsters: [], spells: [] };  // listas reais da API ({ index, name })
let dataAberta = null;   // data do registro aberto no modal
let monstrosModal = [];  // seleção temporária do modal
let feiticosModal = [];
let modalAlterado = false;

// "2026-11-14" -> "sábado, 14 de novembro de 2026" (T00:00:00 evita erro de fuso horário)
function formatarDataLonga(dataISO) {
  return new Date(dataISO + "T00:00:00").toLocaleDateString("pt-BR", { dateStyle: "full" });
}

// Lê as sessões salvas no Firestore e prepara o rascunho
async function carregarSessoes() {
  definirStatus($("sessoes-status"), "Carregando sessões...", { carregando: true });
  try {
    const lista = await listar(COLECAO_SESSOES);
    sessoesSalvas = {};
    lista.forEach((s) => {
      sessoesSalvas[s.data] = {
        id: s.id, data: s.data, descricao: s.descricao || "",
        monstros: s.monstros || [], feiticos: s.feiticos || [], progresso: s.progresso || 0
      };
    });
    rascunho = structuredClone(sessoesSalvas);
    definirStatus($("sessoes-status"), "");
    atualizarCalendario();
  } catch (erro) {
    definirStatus($("sessoes-status"), "Erro ao carregar as sessões: " + erro.message, { erro: true });
  }
}

// Busca as listas reais de monstros e feitiços na API (mesma função da aba Buscar)
async function carregarCatalogoAPI() {
  try {
    const [monsters, spells] = await Promise.all([buscarLista("monsters", ""), buscarLista("spells", "")]);
    catalogo = { monsters, spells };
    preencherDatalist("lista-monstros", monsters);
    preencherDatalist("lista-feiticos", spells);
  } catch (erro) {
    mostrarToast("Não foi possível carregar monstros e feitiços: " + erro.message, "erro");
  }
}

function preencherDatalist(id, itens) {
  $(id).innerHTML = itens.map((i) => `<option value="${escapar(i.name)}"></option>`).join("");
}

// Representação comparável de um registro (ignora o id)
function normalizar(r) {
  return JSON.stringify([r.descricao.trim(), r.monstros.map((m) => m.indice),
    r.feiticos.map((f) => f.indice), r.progresso]);
}

// Compara rascunho x banco e diz o que é novo, o que foi editado e o que foi removido
function calcularPendencias() {
  const novas = [], editadas = [], removidas = [];
  Object.keys(rascunho).forEach((data) => {
    if (!sessoesSalvas[data]) novas.push(data);
    else if (normalizar(rascunho[data]) !== normalizar(sessoesSalvas[data])) editadas.push(data);
  });
  Object.keys(sessoesSalvas).forEach((data) => {
    if (!rascunho[data]) removidas.push(data);
  });
  return { novas, editadas, removidas };
}

function temPendencias() {
  const p = calcularPendencias();
  return p.novas.length + p.editadas.length + p.removidas.length > 0;
}

// Cada dia com registro vira um evento com bolinha: marrom = salvo, cinza = pendente
function montarEventos() {
  const p = calcularPendencias();
  const pendentes = new Set([...p.novas, ...p.editadas]);
  return Object.values(rascunho).map((r) => ({
    start: r.data, allDay: true, display: "list-item",
    title: `Sessão · ${r.progresso}%`,
    color: pendentes.has(r.data) ? COR_PENDENTE : COR_SALVO
  }));
}

function iniciarCalendario() {
  calendario = new FullCalendar.Calendar($("calendario"), {
    initialView: "dayGridMonth",
    locale: "pt-br",
    height: "auto",
    fixedWeekCount: false,
    headerToolbar: { left: "prev,next today", center: "title", right: "" },
    events: (info, sucesso) => sucesso(montarEventos()),
    dateClick: (info) => abrirSessao(info.dateStr),
    eventClick: (info) => abrirSessao(info.event.startStr.slice(0, 10))
  });
  calendario.render();
}

function atualizarCalendario() {
  if (calendario) calendario.refetchEvents();
  atualizarBarraSalvar();
}

// O botão Salvar só fica ativo quando há algo pendente
function atualizarBarraSalvar() {
  const p = calcularPendencias();
  const total = p.novas.length + p.editadas.length + p.removidas.length;
  $("btn-salvar-sessoes").disabled = total === 0;
  $("btn-descartar-sessoes").disabled = total === 0;
  $("aviso-pendencias").textContent = total === 0 ? "" : `${total} alteração(ões) não salva(s)`;
}

// Abre o modal: mostra o registro existente (para editar) ou um formulário vazio
function abrirSessao(data) {
  dataAberta = data;
  const r = rascunho[data];
  monstrosModal = r ? [...r.monstros] : [];
  feiticosModal = r ? [...r.feiticos] : [];
  $("sessao-titulo").textContent = formatarDataLonga(data);
  $("sessao-descricao").value = r ? r.descricao : "";
  $("sessao-progresso").value = r ? r.progresso : 0;
  mostrarProgresso(r ? r.progresso : 0);
  $("sessao-monstro").value = "";
  $("sessao-feitico").value = "";
  $("btn-excluir-sessao").hidden = !r;
  renderizarSelecionados();
  modalAlterado = false;
  $("modal-sessao").showModal();
}

function mostrarProgresso(valor) {
  $("sessao-barra").value = valor;
  $("sessao-valor").textContent = valor + "%";
}

// Só aceita nomes que existem na lista da API (nada de dados inventados)
function adicionarItem(tipoApi, idCampo, lista) {
  const campo = $(idCampo);
  const nome = campo.value.trim().toLowerCase();
  const item = catalogo[tipoApi].find((i) => i.name.toLowerCase() === nome);
  if (!item) {
    mostrarToast("Escolha um nome da lista sugerida pela API.", "erro");
    return;
  }
  if (lista.some((x) => x.indice === item.index)) {
    mostrarToast(`${item.name} já foi adicionado.`, "erro");
    return;
  }
  lista.push({ indice: item.index, nome: item.name });
  campo.value = "";
  modalAlterado = true;
  renderizarSelecionados();
}

function renderizarSelecionados() {
  const chips = (lista, tipo) => lista.map((i, n) => `
    <span class="tag">${escapar(i.nome)}<button type="button" data-remover="${tipo}" data-posicao="${n}"
      aria-label="Remover ${escapar(i.nome)}">×</button></span>`).join("");
  $("sessao-monstros").innerHTML = chips(monstrosModal, "monstros");
  $("sessao-feiticos").innerHTML = chips(feiticosModal, "feiticos");
}

// "Confirmar" grava só no rascunho (alteração pendente). O banco só muda ao clicar em Salvar.
function confirmarSessao(evento) {
  evento.preventDefault();
  rascunho[dataAberta] = {
    id: sessoesSalvas[dataAberta]?.id ?? null,
    data: dataAberta,
    descricao: $("sessao-descricao").value.trim(),
    monstros: [...monstrosModal],
    feiticos: [...feiticosModal],
    progresso: Number($("sessao-progresso").value)
  };
  modalAlterado = false;
  $("modal-sessao").close();
  atualizarCalendario();
}

// A exclusão também fica pendente até o Salvar
function removerRegistroSessao() {
  if (!confirm(`Excluir o registro de ${formatarDataLonga(dataAberta)}? A exclusão só vale depois de clicar em Salvar.`)) return;
  delete rascunho[dataAberta];
  modalAlterado = false;
  $("modal-sessao").close();
  atualizarCalendario();
}

function tentarFecharModalSessao() {
  if (modalAlterado && !confirm("Descartar as alterações deste registro?")) return;
  modalAlterado = false;
  $("modal-sessao").close();
}

function dadosParaGravar(r) {
  return { data: r.data, descricao: r.descricao, monstros: r.monstros, feiticos: r.feiticos, progresso: r.progresso };
}

// Persiste todas as pendências no Firestore. Após cada operação bem-sucedida, sessoesSalvas
// é atualizado na hora; assim, se algo falhar no meio, clicar em Salvar de novo não duplica nada.
async function salvarSessoes() {
  const p = calcularPendencias();
  const botao = $("btn-salvar-sessoes");
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    for (const data of p.removidas) {
      await excluir(COLECAO_SESSOES, sessoesSalvas[data].id);
      delete sessoesSalvas[data];
    }
    for (const data of p.editadas) {
      const id = sessoesSalvas[data].id;
      await atualizar(COLECAO_SESSOES, id, dadosParaGravar(rascunho[data]));
      sessoesSalvas[data] = { ...structuredClone(rascunho[data]), id };
    }
    for (const data of p.novas) {
      const id = await criar(COLECAO_SESSOES, dadosParaGravar(rascunho[data]));
      rascunho[data].id = id;
      sessoesSalvas[data] = structuredClone(rascunho[data]);
    }
    mostrarToast("Anotações salvas.");
  } catch (erro) {
    mostrarToast("Erro ao salvar: " + erro.message, "erro");
  } finally {
    botao.textContent = "Salvar";
    atualizarCalendario();
  }
}

function descartarSessoes() {
  if (!confirm("Descartar todas as alterações não salvas?")) return;
  rascunho = structuredClone(sessoesSalvas);
  atualizarCalendario();
}

// ---------- Eventos ----------
document.querySelectorAll(".aba").forEach((b) => b.addEventListener("click", () => mostrarAba(b.dataset.aba)));
$("form-busca").addEventListener("submit", pesquisar);
["filtro-texto", "filtro-tipo", "filtro-cr", "filtro-tag"].forEach((id) =>
  $(id).addEventListener("input", renderizarGrimorio));
$("btn-sair").addEventListener("click", fazerLogout);
$("form-encontro").addEventListener("submit", salvarEncontro);
$("btn-cancelar-encontro").addEventListener("click", limparFormEncontro);
$("modal-fechar").addEventListener("click", () => $("modal").close());

// Confirmação do modal: salva um novo favorito ou grava a edição
$("form-modal").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  try {
    if (favoritoEmEdicao) await salvarEdicao();
    else await salvarFavorito();
    $("modal").close();
  } catch (erro) {
    mostrarToast("Erro ao gravar no banco: " + erro.message, "erro");
  }
});

// Cliques nos botões dos cards (delegação de eventos)
document.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-acao]");
  if (!botao) return;
  const { acao, id, tipo, indice } = botao.dataset;
  if (acao === "detalhes") abrirDetalhes(tipo, indice);
  if (acao === "editar") abrirEdicao(id);
  if (acao === "excluir") excluirFavorito(id);
  if (acao === "editar-encontro") editarEncontro(id);
  if (acao === "excluir-encontro") excluirEncontro(id);
});

// ---------- Eventos: Anotações sobre a sessão ----------
// Proteção 1: fechar ou recarregar a página com alterações não salvas
window.addEventListener("beforeunload", (evento) => {
  if (temPendencias()) {
    evento.preventDefault();
    evento.returnValue = "";
  }
});

// Proteção 2: sair da aba com pendências. Fase de captura (true): roda antes dos
// listeners das abas, então não é preciso alterar o mostrarAba.
document.querySelector(".abas").addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-aba]");
  const abaAtual = document.querySelector(".aba.ativa")?.dataset.aba;
  if (!botao || abaAtual !== "sessoes" || botao.dataset.aba === "sessoes") return;
  if (temPendencias() && !confirm("Há alterações não salvas. Sair da aba mesmo assim? Elas continuam pendentes até você salvar ou descartar.")) {
    evento.stopPropagation();
  }
}, true);

// Proteção 3: fechar o modal com Esc e edições não confirmadas
$("modal-sessao").addEventListener("cancel", (evento) => {
  if (modalAlterado && !confirm("Descartar as alterações deste registro?")) evento.preventDefault();
  else modalAlterado = false;
});

// Ao abrir a aba: cria o calendário e busca a lista da API só na primeira vez
document.querySelector('[data-aba="sessoes"]').addEventListener("click", () => {
  if (!calendario) {
    iniciarCalendario();
    carregarCatalogoAPI();
  } else {
    calendario.updateSize();
  }
});

$("btn-salvar-sessoes").addEventListener("click", salvarSessoes);
$("btn-descartar-sessoes").addEventListener("click", descartarSessoes);
$("form-sessao").addEventListener("submit", confirmarSessao);
$("form-sessao").addEventListener("input", () => (modalAlterado = true));
$("sessao-fechar").addEventListener("click", tentarFecharModalSessao);
$("btn-excluir-sessao").addEventListener("click", removerRegistroSessao);
$("sessao-progresso").addEventListener("input", (e) => mostrarProgresso(e.target.value));

$("btn-add-monstro").addEventListener("click", () => adicionarItem("monsters", "sessao-monstro", monstrosModal));
$("btn-add-feitico").addEventListener("click", () => adicionarItem("spells", "sessao-feitico", feiticosModal));
// Enter no campo adiciona o item em vez de enviar o formulário
[["sessao-monstro", "monsters", () => monstrosModal], ["sessao-feitico", "spells", () => feiticosModal]]
  .forEach(([id, tipo, pegarLista]) => $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); adicionarItem(tipo, id, pegarLista()); }
  }));

// Remover um item (×) de monstros ou feitiços
$("modal-sessao").addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-remover]");
  if (!botao) return;
  const lista = botao.dataset.remover === "monstros" ? monstrosModal : feiticosModal;
  lista.splice(Number(botao.dataset.posicao), 1);
  modalAlterado = true;
  renderizarSelecionados();
});

// ---------- Inicialização ----------
// Sem usuário logado, volta para a tela de login/registro
observarLogin((usuario) => {
  if (usuario) {
    mostrarApp(usuario);
    iniciarApp();
  } else {
    window.location.replace("login.html");
  }
});
