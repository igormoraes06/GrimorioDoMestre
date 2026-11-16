// ===== Lógica da tela de login / registro (login.html) =====
import { registrar, entrar, observarLogin, traduzirErroAuth } from "./firebase.js";

const $ = (id) => document.getElementById(id);

// Enquanto o registro grava o perfil no banco, não pode redirecionar ainda
let ocupado = false;

function irParaApp() {
  window.location.replace("index.html");
}

// Mostra carregando / erro no aviso abaixo dos formulários
function definirStatus(texto, { carregando = false, erro = false } = {}) {
  const el = $("auth-status");
  el.className = `status ${erro ? "erro" : ""}`;
  el.textContent = "";
  if (carregando) {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    el.appendChild(spinner);
  }
  el.append(texto);
}

// Alterna entre os formulários de entrar e criar conta
function alternarForm(modo) {
  document.querySelectorAll(".auth-aba").forEach((b) =>
    b.classList.toggle("ativa", b.dataset.auth === modo));
  $("form-login").hidden = modo !== "login";
  $("form-registro").hidden = modo !== "registro";
  definirStatus("");
}

async function fazerLogin(evento) {
  evento.preventDefault();
  ocupado = true;
  definirStatus("Entrando...", { carregando: true });
  try {
    await entrar($("login-email").value.trim(), $("login-senha").value);
    irParaApp();
  } catch (erro) {
    ocupado = false;
    definirStatus(traduzirErroAuth(erro), { erro: true });
  }
}

async function fazerRegistro(evento) {
  evento.preventDefault();
  const nome = $("registro-nome").value.trim();
  const email = $("registro-email").value.trim();
  const senha = $("registro-senha").value;

  if (!nome) {
    definirStatus("Informe seu nome.", { erro: true });
    return;
  }
  if (senha !== $("registro-confirmar").value) {
    definirStatus("As senhas não coincidem.", { erro: true });
    return;
  }

  ocupado = true;
  definirStatus("Criando conta...", { carregando: true });
  try {
    await registrar(nome, email, senha);
    irParaApp();
  } catch (erro) {
    ocupado = false;
    definirStatus(traduzirErroAuth(erro), { erro: true });
  }
}

// ---------- Eventos ----------
document.querySelectorAll(".auth-aba").forEach((b) =>
  b.addEventListener("click", () => alternarForm(b.dataset.auth)));
$("form-login").addEventListener("submit", fazerLogin);
$("form-registro").addEventListener("submit", fazerRegistro);

// ---------- Inicialização ----------
// Quem já está logado vai direto ao site; os demais veem os formulários
observarLogin((usuario) => {
  if (usuario) {
    if (!ocupado) irParaApp();
  } else {
    document.querySelector("main").hidden = false;
  }
});
