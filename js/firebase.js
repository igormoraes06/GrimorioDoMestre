// ===== Configuração e CRUD do Cloud Firestore =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, setDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// SUBSTITUA pelos dados do seu projeto (Console Firebase > Configurações do projeto > Seus apps)
const firebaseConfig = {
  apiKey: "AIzaSyDDcW9M-8cph9whUJwC-BR60WTxCvLOgO4",
  authDomain: "grimorio-do-mestre-9dde3.firebaseapp.com",
  projectId: "grimorio-do-mestre-9dde3",
  storageBucket: "grimorio-do-mestre-9dde3.firebasestorage.app",
  messagingSenderId: "983244955114",
  appId: "1:983244955114:web:99a255bdbe8fe41b95e693",
  measurementId: "G-RQY429WPZ6"

};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Cada usuário tem os próprios dados, em usuarios/{uid}/grimorio, /encontros e /sessoes.
function uidAtual() {
  if (!auth.currentUser) throw new Error("Você precisa entrar na sua conta.");
  return auth.currentUser.uid;
}

function colecaoDoUsuario(nome) {
  return collection(db, "usuarios", uidAtual(), nome);
}

function docDoUsuario(colecao, id) {
  return doc(db, "usuarios", uidAtual(), colecao, id);
}

// CREATE: grava um novo documento e devolve o id gerado
export async function criar(colecao, dados) {
  const ref = await addDoc(colecaoDoUsuario(colecao), { ...dados, criadoEm: serverTimestamp() });
  return ref.id;
}

// READ: devolve todos os documentos, do mais novo para o mais antigo
export async function listar(colecao) {
  const consulta = query(colecaoDoUsuario(colecao), orderBy("criadoEm", "desc"));
  const resultado = await getDocs(consulta);
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// UPDATE: altera apenas os campos informados
export function atualizar(colecao, id, dados) {
  return updateDoc(docDoUsuario(colecao, id), dados);
}

// DELETE: remove o documento
export function excluir(colecao, id) {
  return deleteDoc(docDoUsuario(colecao, id));
}

// ===== Autenticação (Firebase Authentication) =====

// Cria a conta no Auth e grava o perfil (nome e e-mail) no Firestore
export async function registrar(nome, email, senha) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  await setDoc(doc(db, "usuarios", cred.user.uid), {
    nome, email, criadoEm: serverTimestamp()
  });
  return cred.user;
}

export function entrar(email, senha) {
  return signInWithEmailAndPassword(auth, email, senha);
}

export function sair() {
  return signOut(auth);
}

// Chama o callback ao abrir a página e sempre que alguém entra ou sai
export function observarLogin(callback) {
  return onAuthStateChanged(auth, callback);
}

const ERROS_AUTH = {
  "auth/email-already-in-use": "Este e-mail já está cadastrado.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet.",
  "permission-denied": "Sem permissão no banco. Confira as regras do Firestore."
};

export function traduzirErroAuth(erro) {
  return ERROS_AUTH[erro.code] || "Não foi possível concluir. Tente novamente.";
}
