/*
 * Câmera de avaliação: silhueta-guia da pose, linha de prumo, nível do celular,
 * timer de 10 segundos, troca de câmera e opção de galeria.
 * Uso: const blob = await openCamera({ pose: "frente", label: "Frente", index: 1, total: 4 });
 */
import { esc } from "./util.js";
import { fileToJpeg, videoFrameToJpeg } from "./image.js";

const SILHOUETTE = {
  front: `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4">
      <ellipse cx="50" cy="16" rx="9" ry="11"/>
      <path d="M44 27c0 4-1 6-3 7M56 27c0 4 1 6 3 7"/>
      <path d="M41 34c-9 1-14 4-15 10l-5 40c-1 6 0 14 2 22M59 34c9 1 14 4 15 10l5 40c1 6 0 14-2 22"/>
      <path d="M35 44l1 24c0 6-2 10-3 14l2 22c1 18-1 42-1 60l-1 26h9l3-30 4-46 4 46 3 30h9l-1-26c0-18-2-42-1-60l2-22c-1-4-3-8-3-14l1-24"/>
    </g>`,
  side: `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4">
      <ellipse cx="50" cy="16" rx="9" ry="11"/>
      <path d="M47 27v7M52 27c1 4 2 6 4 7"/>
      <path d="M46 34c-6 2-8 8-8 16l1 26c0 8 4 12 4 16l-1 18c0 16 2 36 2 54l-1 24h9l1-26c0-16 2-36 2-50l1-16c2-6 4-12 4-20l-1-26c0-10-6-15-14-16z"/>
      <path d="M50 46c2 10 4 22 2 38"/>
    </g>`,
};

export function openCamera({ pose, label, index, total }) {
  return new Promise((resolve) => {
    const isSide = pose.startsWith("lado");
    const el = document.createElement("div");
    el.className = "camera";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Foto " + label);
    el.innerHTML = `
      <header class="camera__bar">
        <span>Foto ${index} de ${total} · <b>${esc(label)}</b></span>
        <button type="button" class="icon-btn" data-act="close" aria-label="Fechar">✕</button>
      </header>

      <section class="camera__step camera__intro" data-step="intro">
        <svg class="camera__guide" viewBox="0 0 100 200" aria-hidden="true">${isSide ? SILHOUETTE.side : SILHOUETTE.front}</svg>
        <h2>${esc(label)}</h2>
        <ul class="checklist">
          <li>Roupa justa ou de treino</li>
          <li>Fundo liso e boa luz</li>
          <li>Corpo inteiro na tela, da cabeça aos pés</li>
          <li>Pés afastados na largura do quadril</li>
          <li>Braços relaxados ${isSide ? "ao lado do corpo" : "um pouco afastados do tronco"}</li>
          <li>${isSide ? "De lado para a câmera, olhando para a frente" : pose === "costas" ? "De costas para a câmera" : "De frente para a câmera"}</li>
        </ul>
        <div class="camera__intro-actions">
          <button type="button" class="btn btn--primary btn--block" data-act="open">Abrir câmera</button>
          <label class="btn btn--ghost btn--block">Escolher da galeria<input type="file" accept="image/*" data-act="file" hidden></label>
        </div>
        <p class="camera__msg" data-msg hidden></p>
      </section>

      <section class="camera__step camera__live" data-step="live" hidden>
        <div class="camera__view">
          <video playsinline muted autoplay></video>
          <svg class="camera__overlay" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${isSide ? SILHOUETTE.side : SILHOUETTE.front}</svg>
          <span class="camera__plumb" aria-hidden="true"></span>
          <span class="camera__level" data-level>Segure o celular na vertical</span>
          <span class="camera__count" data-count hidden></span>
        </div>
        <div class="camera__controls">
          <button type="button" class="icon-btn" data-act="flip" aria-label="Trocar câmera">⟲</button>
          <button type="button" class="shutter-btn" data-act="shoot" aria-label="Tirar foto"></button>
          <button type="button" class="icon-btn is-on" data-act="timer" aria-pressed="true" aria-label="Timer de 10 segundos">10s</button>
        </div>
      </section>

      <section class="camera__step camera__review" data-step="review" hidden>
        <img alt="Prévia da foto ${esc(label)}">
        <div class="camera__review-actions">
          <button type="button" class="btn btn--ghost" data-act="retake">Tirar de novo</button>
          <button type="button" class="btn btn--primary" data-act="use">Usar esta foto</button>
        </div>
      </section>`;
    document.body.appendChild(el);
    document.body.classList.add("no-scroll");

    const q = (s) => el.querySelector(s);
    const video = q("video");
    const msg = q("[data-msg]");
    const levelEl = q("[data-level]");
    const countEl = q("[data-count]");
    let stream = null, facing = "user", timerOn = true, blob = null, countTimer = null, previewURL = null;

    const show = (step) => el.querySelectorAll("[data-step]").forEach((s) => (s.hidden = s.dataset.step !== step));
    const stop = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    const close = (result) => {
      clearInterval(countTimer);
      stop();
      window.removeEventListener("deviceorientation", onTilt);
      if (previewURL) URL.revokeObjectURL(previewURL);
      el.remove();
      document.body.classList.remove("no-scroll");
      resolve(result);
    };

    // Nível: com o celular em pé, beta ≈ 90° e gamma ≈ 0°
    function onTilt(e) {
      if (e.beta == null) return;
      const g = e.gamma, b = e.beta;
      const ok = Math.abs(g) < 3 && Math.abs(b - 90) < 10;
      levelEl.classList.toggle("is-ok", ok);
      levelEl.textContent = ok ? "Celular nivelado" : Math.abs(g) >= 3 ? (g > 0 ? "Gire um pouco para a esquerda" : "Gire um pouco para a direita") : b < 80 ? "Deixe o celular mais em pé" : "Incline o topo do celular para trás";
    }

    async function startCamera() {
      stop();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = stream;
      video.classList.toggle("is-mirror", facing === "user");
      await video.play().catch(() => {});
    }

    async function openLive() {
      msg.hidden = true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg.textContent = "Seu navegador não permite usar a câmera aqui. Escolha uma foto da galeria.";
        msg.hidden = false;
        return;
      }
      try {
        // iPhone pede permissão para ler o nível do aparelho
        if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
          DeviceOrientationEvent.requestPermission().catch(() => {});
        }
        await startCamera();
        window.addEventListener("deviceorientation", onTilt);
        show("live");
      } catch (err) {
        msg.textContent = err && err.name === "NotAllowedError"
          ? "Você não permitiu o uso da câmera. Libere nas configurações do navegador ou escolha uma foto da galeria."
          : "Não foi possível abrir a câmera. Escolha uma foto da galeria.";
        msg.hidden = false;
      }
    }

    async function capture() {
      blob = await videoFrameToJpeg(video);
      stop();
      previewURL = URL.createObjectURL(blob);
      q(".camera__review img").src = previewURL;
      show("review");
    }

    function shoot() {
      if (!timerOn) return capture();
      let n = 10;
      countEl.hidden = false;
      countEl.textContent = n;
      clearInterval(countTimer);
      countTimer = setInterval(() => {
        n -= 1;
        if (n <= 0) { clearInterval(countTimer); countEl.hidden = true; capture(); }
        else countEl.textContent = n;
      }, 1000);
    }

    el.addEventListener("click", async (e) => {
      const act = e.target.closest("[data-act]") && e.target.closest("[data-act]").dataset.act;
      if (!act) return;
      if (act === "close") close(null);
      if (act === "open") openLive();
      if (act === "shoot") shoot();
      if (act === "timer") {
        timerOn = !timerOn;
        const b = q("[data-act='timer']");
        b.classList.toggle("is-on", timerOn);
        b.setAttribute("aria-pressed", String(timerOn));
      }
      if (act === "flip") { facing = facing === "user" ? "environment" : "user"; try { await startCamera(); } catch (err) { /* mantém a atual */ } }
      if (act === "retake") { if (previewURL) URL.revokeObjectURL(previewURL); previewURL = null; blob = null; try { await startCamera(); show("live"); } catch (err) { show("intro"); } }
      if (act === "use") close(blob);
    });
    q("input[type=file]").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        blob = await fileToJpeg(f);
        previewURL = URL.createObjectURL(blob);
        q(".camera__review img").src = previewURL;
        show("review");
      } catch (err) {
        msg.textContent = "Não foi possível ler essa imagem. Tente outra.";
        msg.hidden = false;
      }
    });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(null); });
    q("[data-act='open']").focus();
  });
}
