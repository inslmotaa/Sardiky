// ================================================================
//  DADOS DO ESCRITÓRIO — altere aqui e o site inteiro é atualizado.
// ================================================================
const CONFIG = {
  // Somente números, com DDI 55 + DDD. Ex.: "5511987654321"
  whatsapp: "5500000000000",
  whatsappMessage: "Olá, Dr. Gregory! Vim pelo site e gostaria de agendar um atendimento.",
  phone: "(00) 00000-0000",
  email: "contato@gregoryadv.com.br",
  oab: "OAB/UF 000.000",
  address: "Endereço do escritório — Cidade/UF",
  hours: "Segunda a sexta, 9h às 18h",
  instagram: "https://instagram.com/",
};

const waLink = (text) =>
  `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

// Preenche os campos de texto
document.querySelectorAll("[data-field]").forEach((el) => {
  const value = CONFIG[el.dataset.field];
  if (value) el.textContent = value;
});

// Links de WhatsApp, e-mail e Instagram
document.querySelectorAll("[data-whatsapp]").forEach((el) => {
  el.href = waLink(CONFIG.whatsappMessage);
  el.target = "_blank";
  el.rel = "noopener";
});
document.querySelectorAll("[data-email]").forEach((el) => {
  el.href = `mailto:${CONFIG.email}`;
});
document.querySelectorAll("[data-instagram]").forEach((el) => {
  el.href = CONFIG.instagram;
  el.target = "_blank";
  el.rel = "noopener";
});

// Formulário → abre o WhatsApp com a mensagem pronta
document.getElementById("contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const text = [
    "Olá, Dr. Gregory! Vim pelo site.",
    `Nome: ${data.get("nome")}`,
    `Telefone: ${data.get("telefone")}`,
    `Assunto: ${data.get("assunto")}`,
    data.get("mensagem") ? `Mensagem: ${data.get("mensagem")}` : "",
  ].filter(Boolean).join("\n");
  window.open(waLink(text), "_blank", "noopener");
});

// Menu mobile
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("menu");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// Sombra no cabeçalho ao rolar
const header = document.querySelector(".header");
const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

document.getElementById("year").textContent = new Date().getFullYear();
