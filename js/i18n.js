/**
 * i18n.js - Offline-First PT-PT <-> EN Translation Engine for Cuidar em Emergência
 * Preserves medical acronyms (112, SNS 24, ERC 2025) and works 100% offline.
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'cuidar_emergencia_lang';
  const saved = (() => {
    try {
      const val = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('socorro112_lang');
      return val === 'en' ? 'en' : 'pt';
    } catch (e) {
      return 'pt';
    }
  })();

  global.AppLang = saved;

  const ATTRS_TO_TRANSLATE = ['placeholder', 'title', 'alt', 'aria-label'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'SVG', 'TEXTAREA']);

  // Build fast lookup tables from window.I18N_PT_TO_EN
  const rawDict = global.I18N_PT_TO_EN || {};
  const normDict = Object.create(null);
  const enToPtDict = Object.create(null);

  Object.keys(rawDict).forEach((ptKey) => {
    const enVal = rawDict[ptKey];
    const normPt = ptKey.replace(/\s+/g, ' ').trim();
    normDict[normPt] = enVal;
    const normEn = String(enVal).replace(/\s+/g, ' ').trim();
    if (!enToPtDict[normEn]) {
      enToPtDict[normEn] = ptKey;
    }
  });

  // Dynamic interpolated string patterns (PT -> EN and EN -> PT)
  const PT_TO_EN_PATTERNS = [
    [/^(\d+)\s+de\s+(\d+)\s+respondidas\s+•\s+Acertos:\s+(\d+)$/, (m) => `${m[1]} of ${m[2]} answered • Correct: ${m[3]}`],
    [/^Pontuação Final:\s+(\d+)\s+em\s+(\d+)\s+Acertos\s+\((\d+)%\)$/, (m) => `Final Score: ${m[1]} of ${m[2]} Correct (${m[3]}%)`],
    [/^Passo\s+(\d+)\s+de\s+(\d+)$/, (m) => `Step ${m[1]} of ${m[2]}`],
    [/^Continuar para o Passo\s+(\d+)\s+➔$/, (m) => `Continue to Step ${m[1]} ➔`],
    [/^Confirmar Sintomas Selecionados\s*\((\d+)\)$/, (m) => `Confirm Selected Symptoms (${m[1]})`],
    [/^1 capítulo encontrado$/, () => '1 chapter found'],
    [/^(\d+)\s+capítulos encontrados$/, (m) => `${m[1]} chapters found`],
    [/^Aplicado às:\s*(.+)$/, (m) => `Applied at: ${m[1]}`],
    [/^Início dos Sintomas:\s*(.+?)\s*\(Transmitir ao 112 para Via Verde\)$/, (m) => `Symptom Onset: ${m[1]} (Report to 112 for Fast-Track)`],
    [/^Hora de início registada às\s+(.+?)\.\s+Ligue 112 de imediato e refira suspeita de AVC\.$/, (m) => `Onset time recorded at ${m[1]}. Call 112 immediately and report suspected stroke.`],
    [/^Atenção\.\s*O garrote está colocado há\s+(\d+)\s+minutos?\.\s*Nunca alivie o garrote\.$/, (m) => `Warning. The tourniquet has been on for ${m[1]} minute${m[1] === '1' ? '' : 's'}. Never loosen the tourniquet.`],
    [/^Prontidão da mala:\s*(.+)$/, (m) => `Kit readiness: ${m[1]}`],
    [/^Precisão:\s*(.+)$/, (m) => `Accuracy: ${m[1]}`],
    [/^(Junto a|Perto de|Zona de)\s+(.+)$/, (m) => `${m[1] === 'Junto a' ? 'Next to' : m[1] === 'Perto de' ? 'Near' : 'Area of'} ${m[2]}`],
    [/^✅\s+(\d+)\s+recursos guardados na memória do telemóvel\.$/, (m) => `✅ ${m[1]} resources saved in device memory.`],
    [/^Erro:\s*(.+?)\.\s*Em dúvida, ligue 112 imediatamente\.$/, (m) => `Error: ${m[1]}. When in doubt, call 112 immediately.`],
    [/^✅ Sucesso!\s+Foram guardados\s+(\d+)\s+recursos no teu telemóvel para consulta sem internet\.$/, (m) => `✅ Success! ${m[1]} resources saved on your phone for offline use.`]
  ];

  const EN_TO_PT_PATTERNS = [
    [/^(\d+)\s+of\s+(\d+)\s+answered\s+•\s+Correct:\s+(\d+)$/, (m) => `${m[1]} de ${m[2]} respondidas • Acertos: ${m[3]}`],
    [/^Final Score:\s+(\d+)\s+of\s+(\d+)\s+Correct\s+\((\d+)%\)$/, (m) => `Pontuação Final: ${m[1]} em ${m[2]} Acertos (${m[3]}%)`],
    [/^Step\s+(\d+)\s+of\s+(\d+)$/, (m) => `Passo ${m[1]} de ${m[2]}`],
    [/^Continue to Step\s+(\d+)\s+➔$/, (m) => `Continuar para o Passo ${m[1]} ➔`],
    [/^Confirm Selected Symptoms\s*\((\d+)\)$/, (m) => `Confirmar Sintomas Selecionados (${m[1]})`],
    [/^1 chapter found$/, () => '1 capítulo encontrado'],
    [/^(\d+)\s+chapters found$/, (m) => `${m[1]} capítulos encontrados`],
    [/^Applied at:\s*(.+)$/, (m) => `Aplicado às: ${m[1]}`],
    [/^Symptom Onset:\s*(.+?)\s*\(Report to 112 for Fast-Track\)$/, (m) => `Início dos Sintomas: ${m[1]} (Transmitir ao 112 para Via Verde)`],
    [/^Onset time recorded at\s+(.+?)\.\s+Call 112 immediately and report suspected stroke\.$/, (m) => `Hora de início registada às ${m[1]}. Ligue 112 de imediato e refira suspeita de AVC.`],
    [/^Warning\.\s*The tourniquet has been on for\s+(\d+)\s+minutes?\.\s*Never loosen the tourniquet\.$/, (m) => `Atenção. O garrote está colocado há ${m[1]} minutos. Nunca alivie o garrote.`],
    [/^Kit readiness:\s*(.+)$/, (m) => `Prontidão da mala: ${m[1]}`],
    [/^Accuracy:\s*(.+)$/, (m) => `Precisão: ${m[1]}`],
    [/^(Next to|Near|Area of)\s+(.+)$/, (m) => `${m[1] === 'Next to' ? 'Junto a' : m[1] === 'Near' ? 'Perto de' : 'Zona de'} ${m[2]}`],
    [/^✅\s+(\d+)\s+resources saved in device memory\.$/, (m) => `✅ ${m[1]} recursos guardados na memória do telemóvel.`],
    [/^Error:\s*(.+?)\.\s*When in doubt, call 112 immediately\.$/, (m) => `Erro: ${m[1]}. Em dúvida, ligue 112 imediatamente.`],
    [/^✅ Success!\s+(\d+)\s+resources saved on your phone for offline use\.$/, (m) => `✅ Sucesso! Foram guardados ${m[1]} recursos no teu telemóvel para consulta sem internet.`]
  ];

  const originalTextMap = new WeakMap();
  const originalAttrMap = new WeakMap();
  let observer = null;
  let onChangeCallbacks = [];

  function translateCore(core, dict, norm, patterns) {
    if (!core) return null;
    if (Object.prototype.hasOwnProperty.call(dict, core)) return dict[core];
    const normalized = core.replace(/\s+/g, ' ');
    if (Object.prototype.hasOwnProperty.call(norm, normalized)) return norm[normalized];

    // Quiz numbering / option prefixes ("1. ...", "A) ...")
    const prefMatch = normalized.match(/^(\d+\.\s+|[A-C]\)\s+)(.+)$/);
    if (prefMatch) {
      const inner = dict[prefMatch[2]] || norm[prefMatch[2]];
      if (inner) return prefMatch[1] + inner;
    }

    for (let i = 0; i < patterns.length; i++) {
      const m = normalized.match(patterns[i][0]);
      if (m) return patterns[i][1](m);
    }
    return null;
  }

  function preserveWhitespace(raw, translatedCore) {
    if (!translatedCore) return raw;
    const leadMatch = raw.match(/^\s*/);
    const trailMatch = raw.match(/\s*$/);
    const lead = leadMatch ? leadMatch[0] : '';
    const trail = trailMatch ? trailMatch[0] : '';
    return lead + translatedCore + trail;
  }

  function translateStringToEn(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return raw;
    const translated = translateCore(raw.trim(), rawDict, normDict, PT_TO_EN_PATTERNS);
    return translated ? preserveWhitespace(raw, translated) : raw;
  }

  function translateStringToPt(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return raw;
    const translated = translateCore(raw.trim(), enToPtDict, enToPtDict, EN_TO_PT_PATTERNS);
    return translated ? preserveWhitespace(raw, translated) : raw;
  }

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    return !!el.closest('[translate="no"], .notranslate');
  }

  function applyToTextNode(node, targetLang) {
    if (!node || !node.parentElement || shouldSkipElement(node.parentElement)) return;
    const current = node.nodeValue;
    if (!current || !current.trim()) return;

    if (targetLang === 'en') {
      const candidateEn = translateStringToEn(current);
      if (candidateEn !== current) {
        originalTextMap.set(node, current);
        node.nodeValue = candidateEn;
      } else if (!originalTextMap.has(node)) {
        // Store reverse PT if node already rendered in EN via JS
        const revPt = translateStringToPt(current);
        originalTextMap.set(node, revPt !== current ? revPt : current);
      }
    } else {
      const origPt = originalTextMap.get(node);
      if (origPt !== undefined && origPt !== current) {
        node.nodeValue = origPt;
      } else {
        const revPt = translateStringToPt(current);
        if (revPt !== current) node.nodeValue = revPt;
      }
    }
  }

  function applyToAttributes(el, targetLang) {
    if (shouldSkipElement(el)) return;
    let map = originalAttrMap.get(el);

    for (let i = 0; i < ATTRS_TO_TRANSLATE.length; i++) {
      const attr = ATTRS_TO_TRANSLATE[i];
      if (!el.hasAttribute(attr)) continue;
      const val = el.getAttribute(attr);
      if (!val || !val.trim()) continue;

      if (targetLang === 'en') {
        const enVal = translateStringToEn(val);
        if (enVal !== val) {
          if (!map) {
            map = new Map();
            originalAttrMap.set(el, map);
          }
          if (!map.has(attr)) map.set(attr, val);
          el.setAttribute(attr, enVal);
        } else if (map && !map.has(attr)) {
          const revPt = translateStringToPt(val);
          map.set(attr, revPt !== val ? revPt : val);
        }
      } else {
        const orig = map ? map.get(attr) : undefined;
        if (orig !== undefined && orig !== val) {
          el.setAttribute(attr, orig);
        } else {
          const revPt = translateStringToPt(val);
          if (revPt !== val) el.setAttribute(attr, revPt);
        }
      }
    }
  }

  function walkSubtree(root, targetLang) {
    if (!root) return;
    if (root.nodeType === 3) {
      applyToTextNode(root, targetLang);
      return;
    }
    if (root.nodeType !== 1 || shouldSkipElement(root)) return;

    applyToAttributes(root, targetLang);
    const elements = root.querySelectorAll('*');
    for (let i = 0; i < elements.length; i++) {
      applyToAttributes(elements[i], targetLang);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      applyToTextNode(node, targetLang);
    }
  }

  function updateToggleButtonAndMeta(lang) {
    const htmlEl = document.documentElement;
    if (htmlEl) htmlEl.lang = lang === 'en' ? 'en' : 'pt-PT';

    const ptTitle = 'Cuidar em Emergência - Guia Prático de Primeiros Socorros e Apoio à Decisão';
    const enTitle = 'Care in Emergency - Practical First Aid & Decision Support Guide';
    document.title = lang === 'en' ? enTitle : ptTitle;

    const btn = document.getElementById('btn-toggle-lang');
    if (btn) {
      const flagSpan = btn.querySelector('span[aria-hidden="true"]');
      const labelSpan = btn.querySelector('.lang-btn-label');
      if (flagSpan) flagSpan.textContent = lang === 'en' ? '🇵🇹' : '🌐';
      if (labelSpan) {
        labelSpan.textContent = lang === 'en' ? 'PT' : 'EN';
      } else {
        btn.textContent = lang === 'en' ? '🇵🇹 PT' : '🌐 EN';
      }
      btn.setAttribute('title', lang === 'en' ? 'Mudar idioma para Português (PT)' : 'Translate app to English (EN)');
      btn.setAttribute('aria-label', lang === 'en' ? 'Switch language to Portuguese' : 'Switch language to English');
    }
  }

  function withPausedObserver(fn) {
    if (observer) observer.disconnect();
    try {
      fn();
    } finally {
      startObserver();
    }
  }

  function handleMutations(mutations) {
    if (global.AppLang !== 'en') return;
    withPausedObserver(() => {
      for (let i = 0; i < mutations.length; i++) {
        const mut = mutations[i];
        if (mut.type === 'characterData') {
          applyToTextNode(mut.target, 'en');
        } else if (mut.type === 'attributes') {
          applyToAttributes(mut.target, 'en');
        } else if (mut.type === 'childList') {
          for (let j = 0; j < mut.addedNodes.length; j++) {
            walkSubtree(mut.addedNodes[j], 'en');
          }
        }
      }
    });
  }

  function startObserver() {
    if (!document.body || typeof MutationObserver === 'undefined') return;
    if (!observer) {
      observer = new MutationObserver(handleMutations);
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS_TO_TRANSLATE
    });
  }

  const I18nManager = {
    getLang() {
      return global.AppLang || 'pt';
    },

    translateString(ptStr) {
      return global.AppLang === 'en' ? translateStringToEn(ptStr) : ptStr;
    },

    setLanguage(lang, notify = true) {
      const normalized = lang === 'en' ? 'en' : 'pt';
      global.AppLang = normalized;
      try {
        localStorage.setItem(STORAGE_KEY, normalized);
      } catch (e) {}

      withPausedObserver(() => {
        if (document.body) {
          walkSubtree(document.body, normalized);
        }
        updateToggleButtonAndMeta(normalized);
      });

      if (notify) {
        onChangeCallbacks.forEach((cb) => {
          try {
            cb(normalized);
          } catch (e) {}
        });
      }
    },

    toggleLanguage() {
      this.setLanguage(global.AppLang === 'en' ? 'pt' : 'en', true);
    },

    onChange(cb) {
      if (typeof cb === 'function') onChangeCallbacks.push(cb);
    },

    init() {
      withPausedObserver(() => {
        if (global.AppLang === 'en' && document.body) {
          walkSubtree(document.body, 'en');
        }
        updateToggleButtonAndMeta(global.AppLang);
      });
    }
  };

  global.I18nManager = I18nManager;
  global.t = function (ptStr, enFallback) {
    if (global.AppLang !== 'en') return ptStr;
    if (typeof enFallback === 'string') return enFallback;
    return translateStringToEn(ptStr);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18nManager.init());
  } else {
    I18nManager.init();
  }
})(window);
