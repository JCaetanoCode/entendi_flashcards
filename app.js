import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeOVz5jRue8Y1Io7hAndWd-iwTlvaS9eI",
  authDomain: "entendi-flashcards.firebaseapp.com",
  projectId: "entendi-flashcards",
  storageBucket: "entendi-flashcards.firebasestorage.app",
  messagingSenderId: "181208616106",
  appId: "1:181208616106:web:dbbbb7689af03e761f94d3",
  measurementId: "G-ZFP29T103F"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const docRef = doc(db, "flashcards", "data");

let cards = [];
let categories = ["Geral"]; 
let activeCategory = "Geral"; 
let stats = { right: 0, wrong: 0 };
let direction = "pt-en"; 
let deck = [];         
let currentIndex = 0;
let flipped = false;
let syncTimeout = null;
let isFirstLoad = true;

const THEME_KEY = "flashcards_theme";

const $ = (id) => document.getElementById(id);
const cardEl = $("card");
const textFront = $("textFront");
const textBack = $("textBack");
const langFront = $("langFront");
const langBack = $("langBack");

function initRealtimeListener() {
  onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      cards = data.cards || [];
      categories = data.categories || ["Geral"];
      stats = data.stats || { right: 0, wrong: 0 };
      
      if (data.activeCategory && categories.includes(data.activeCategory)) {
          activeCategory = data.activeCategory;
      }

      if (!categories.includes("Geral")) categories.unshift("Geral");
      cards.forEach(c => { if (!c.cat || !categories.includes(c.cat)) c.cat = "Geral"; });
      if (!categories.includes(activeCategory)) activeCategory = "Geral";
      
      updateUI();
    } else {
      saveToCloud();
    }
    isFirstLoad = false;
  }, (error) => {
    console.error("Erro no tempo real:", error);
    toast("Erro de conexão com o banco.");
  });
}

function saveToCloud() {
  if (isFirstLoad) return;

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await setDoc(docRef, {
        cards: cards,
        categories: categories,
        stats: stats,
        activeCategory: activeCategory
      }, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar", e);
      toast("Erro ao salvar na nuvem.");
    }
  }, 800);
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

function buildDeck() {
  deck = cards.filter(c => c.cat === activeCategory);
  if (currentIndex >= deck.length) currentIndex = 0;
  if (deck.length === 0) currentIndex = 0;
}

function renderCategories() {
  const list = $("catList");
  list.innerHTML = "";
  
  categories.forEach(cat => {
    const pill = document.createElement("div");
    pill.className = "cat-pill" + (activeCategory === cat ? " active" : "");
    
    const span = document.createElement("span");
    span.textContent = cat;
    span.style.flex = "1";
    span.onclick = () => { activeCategory = cat; saveToCloud(); updateUI(); };
    pill.appendChild(span);

    if (cat !== "Geral") {
      const del = document.createElement("span");
      del.className = "del-cat";
      del.textContent = "×";
      del.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Excluir a categoria "${cat}"?\n\nATENÇÃO: Todas as frases dentro dela também serão apagadas!`)) {
          categories = categories.filter(c => c !== cat);
          cards = cards.filter(c => c.cat !== cat); 
          if (activeCategory === cat) activeCategory = "Geral";
          saveToCloud();
          updateUI();
          toast(`Categoria "${cat}" excluída.`);
        }
      };
      pill.appendChild(del);
    }
    list.appendChild(pill);
  });
}

function updateUI() {
  $("catCurrent").textContent = activeCategory;
  $("badgeAdd").textContent = `em: ${activeCategory}`;
  $("badgeImport").textContent = `Importa para: ${activeCategory}`;
  
  if (activeCategory !== "Geral") {
    $("catAccordion").classList.add("active");
  } else {
    $("catAccordion").classList.remove("active");
  }
  
  buildDeck();
  renderCategories();
  updateStats();
  renderCard();
  renderList();
}

function updateStats() {
  $("statRight").textContent = stats.right;
  $("statWrong").textContent = stats.wrong;
  $("statTotal").textContent = cards.length;
  $("listCount").textContent = deck.length;
  
  const counterEl = $("deckCounter");
  if (counterEl) {
    if (deck.length > 0) {
      counterEl.textContent = `Card ${currentIndex + 1} de ${deck.length} nesta categoria`;
    } else {
      counterEl.textContent = `Nenhum card nesta categoria`;
    }
  }
}

function renderCard() {
  if (deck.length === 0) {
    langFront.textContent = direction === "pt-en" ? "Português" : "Inglês";
    langBack.textContent = direction === "pt-en" ? "Inglês" : "Português";
    textFront.textContent = `Nenhum card em "${activeCategory}".`;
    textBack.textContent = "—";
    cardEl.classList.remove("flipped");
    flipped = false;
    return;
  }
  
  const c = deck[currentIndex];
  const frontText = direction === "pt-en" ? c.pt : c.en;
  const backText = direction === "pt-en" ? c.en : c.pt;
  langFront.textContent = direction === "pt-en" ? "Português" : "Inglês";
  langBack.textContent = direction === "pt-en" ? "Inglês" : "Português";
  textFront.textContent = frontText;
  textBack.textContent = backText;
  
  cardEl.classList.remove("flipped");
  flipped = false;
  window.speechSynthesis.cancel();
  
  updateStats();
}

function renderList() {
  const list = $("cardList");
  list.innerHTML = "";
  
  if (deck.length === 0) {
    list.innerHTML = '<div style="color:var(--text-light);font-size:0.85rem;padding:8px 0;">Nenhum card nesta categoria.</div>';
    return;
  }

  deck.forEach((c) => {
    const realIndex = cards.findIndex(card => card.en === c.en && card.pt === c.pt && card.cat === c.cat);
    
    const div = document.createElement("div");
    div.className = "list-item";
    
    const pair = document.createElement("div");
    pair.className = "pair";
    pair.innerHTML = `<b>${escapeHtml(c.en)}</b> <span>| ${escapeHtml(c.pt)}</span>`;
    
    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.title = "Editar";
    editBtn.onclick = () => {
      div.innerHTML = ""; 
      
      const editEn = document.createElement("input");
      editEn.type = "text";
      editEn.value = c.en;
      editEn.style.flex = "1";
      editEn.style.marginRight = "4px";

      const editPt = document.createElement("input");
      editPt.type = "text";
      editPt.value = c.pt;
      editPt.style.flex = "1";
      editPt.style.marginRight = "4px";

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "💾";
      saveBtn.title = "Salvar";
      saveBtn.style.color = "var(--right-text)";
      saveBtn.onclick = () => {
        const newEn = editEn.value.trim();
        const newPt = editPt.value.trim();
        if (!newEn || !newPt) { toast("Preencha os dois campos"); return; }
        
        if(realIndex > -1) {
          cards[realIndex].en = newEn;
          cards[realIndex].pt = newPt;
          saveToCloud(); 
          buildDeck();
          updateUI();
          toast("Card atualizado!");
        }
      };

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "✖️";
      cancelBtn.title = "Cancelar";
      cancelBtn.style.color = "var(--wrong-text)";
      cancelBtn.onclick = () => { renderList(); };

      div.appendChild(editEn);
      div.appendChild(editPt);
      div.appendChild(saveBtn);
      div.appendChild(cancelBtn);
    };
    
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑";
    delBtn.title = "Excluir";
    delBtn.onclick = () => {
      if(realIndex > -1) {
          cards.splice(realIndex, 1);
          saveToCloud(); 
          buildDeck();
          updateUI();
          toast("Card excluído");
      }
    };
    
    div.appendChild(pair);
    div.appendChild(editBtn);
    div.appendChild(delBtn);
    list.appendChild(div);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function speak(text, lang) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "en" ? "en-US" : "pt-BR";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

cardEl.addEventListener("click", (e) => {
  if (deck.length === 0) return;
  flipped = !flipped;
  cardEl.classList.toggle("flipped", flipped);
  if (flipped) {
    const c = deck[currentIndex];
    speak(c.en, "en"); 
  } else {
    window.speechSynthesis.cancel();
  }
});

function nextCard() {
  if (deck.length === 0) return;
  currentIndex = (currentIndex + 1) % deck.length;
  renderCard();
}
function prevCard() {
  if (deck.length === 0) return;
  currentIndex = (currentIndex - 1 + deck.length) % deck.length;
  renderCard();
}

$("btnRight").onclick = () => {
  if (deck.length === 0) return;
  stats.right++;
  saveToCloud();
  nextCard();
  updateStats();
};
$("btnWrong").onclick = () => {
  if (deck.length === 0) return;
  stats.wrong++;
  saveToCloud();
  nextCard();
  updateStats();
};
$("btnPrev").onclick = () => { if (deck.length > 0) prevCard(); };
$("btnNext").onclick = () => { if (deck.length > 0) nextCard(); };

$("catHeader").onclick = () => {
  const content = $("catContent");
  const arrow = $("catArrow");
  content.classList.toggle("open");
  arrow.textContent = content.classList.contains("open") ? "▲" : "▼";
};

$("btnAddCat").onclick = () => {
  const newCat = $("inputNewCat").value.trim();
  if (!newCat) return;
  if (categories.includes(newCat)) { toast("Categoria já existe"); return; }
  categories.push(newCat);
  activeCategory = newCat; 
  saveToCloud();
  $("inputNewCat").value = "";
  updateUI(); 
  toast(`Categoria "${newCat}" criada e ativada`);
};
$("inputNewCat").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btnAddCat").click();
});

$("dirPTEN").onclick = () => {
  direction = "pt-en";
  $("dirPTEN").classList.add("active");
  $("dirENPT").classList.remove("active");
  renderCard();
};
$("dirENPT").onclick = () => {
  direction = "en-pt";
  $("dirENPT").classList.add("active");
  $("dirPTEN").classList.remove("active");
  renderCard();
};

$("themeBtn").onclick = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  if (newTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    $("themeBtn").textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-theme');
    $("themeBtn").textContent = '🌙';
  }
  localStorage.setItem(THEME_KEY, newTheme);
};

$("btnAdd").onclick = () => {
  const en = $("inputEN").value.trim();
  const pt = $("inputPT").value.trim();
  if (!en || !pt) { toast("Preencha os dois campos"); return; }
  cards.push({ en, pt, cat: activeCategory });
  saveToCloud();
  $("inputEN").value = "";
  $("inputPT").value = "";
  $("inputEN").focus();
  buildDeck();
  updateUI();
  toast(`Card adicionado em "${activeCategory}"`);
};
["inputEN", "inputPT"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btnAdd").click();
  });
});
$("btnTranslate").onclick = async () => {
  const inputEN = $("inputEN");
  const inputPT = $("inputPT");
  const en = inputEN.value.trim();
  const pt = inputPT.value.trim();

  if ((!en && !pt) || (en && pt)) {
    toast("Preencha apenas um dos campos para traduzir.");
    return;
  }

  const btn = $("btnTranslate");
  const originalText = btn.textContent;
  btn.textContent = "⏳ Traduzindo...";
  btn.disabled = true;

  try {
    let textToTranslate = "";
    let langpair = "";

    if (pt) {
      textToTranslate = encodeURIComponent(pt);
      langpair = "pt|en"; 
    } else {
      textToTranslate = encodeURIComponent(en);
      langpair = "en|pt"; 
    }

    const response = await fetch(`https://api.mymemory.translated.net/get?q=${textToTranslate}&langpair=${langpair}`);
    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData.translatedText) {
      let translated = data.responseData.translatedText;
      if (translated === translated.toUpperCase()) {
         translated = translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
      }

      if (langpair === "pt|en") {
        inputEN.value = translated;
      } else {
        inputPT.value = translated;
      }
      toast("Traduzido com sucesso!");
    } else {
      toast("Não foi possível traduzir. Tente novamente.");
    }
  } catch (error) {
    console.error("Erro na tradução:", error);
    toast("Erro de conexão ao traduzir.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
};

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

$("btnExportTxt").onclick = () => {
  if (cards.length === 0) { toast("Nada para exportar"); return; }
  const lines = cards.map((c) => `(${c.en} | ${c.pt} | ${c.cat})`).join("\n");
  download("flashcards.txt", lines);
  toast("TXT exportado com sucesso");
};

$("btnExportJson").onclick = () => {
  const data = {
    app: "flashcards",
    version: 2,
    exportedAt: new Date().toISOString(),
    cards: cards,
    categories: categories,
    stats: stats,
    direction: direction
  };
  download("flashcards.json", JSON.stringify(data, null, 2), "application/json");
  toast("JSON exportado com sucesso");
};

function processImport(importedCards) {
  if (importedCards.length === 0) { toast("Nenhuma frase válida encontrada"); return; }
  importedCards.forEach(c => {
    cards.push({ en: c.en, pt: c.pt, cat: activeCategory });
  });
  saveToCloud();
  buildDeck();
  updateUI();
  toast(`${importedCards.length} frase(s) importada(s) para "${activeCategory}"`);
}

$("fileTxt").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const parsed = [];
    const lines = text.split(/\r?\n/);
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      line = line.replace(/^\((.*)\)$/, "$1").trim();
      const parts = line.split("|");
      if (parts.length >= 2) {
        const en = parts[0].trim();
        const pt = parts[1].trim();
        if (en && pt) parsed.push({ en, pt });
      }
    }
    processImport(parsed);
  };
  reader.readAsText(file);
  e.target.value = "";
});

$("fileJson").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      let importedCards = [];
      if (Array.isArray(data)) importedCards = data;
      else if (data && Array.isArray(data.cards)) importedCards = data.cards;

      importedCards = importedCards
        .filter(c => c && (c.en || c.pt))
        .map(c => ({ 
          en: String(c.en || ""), 
          pt: String(c.pt || "")
        }))
        .filter(c => c.en && c.pt);

      processImport(importedCards);
    } catch (err) {
      toast("Arquivo JSON inválido");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  $("themeBtn").textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

initRealtimeListener();