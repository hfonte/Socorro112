// MOTOR RAG (RETRIEVAL-AUGMENTED GENERATION) - BASEADO NOS MANUAIS UFCD 9988 / TAS (HUGO FONTE)
const RagEngine = {
  // Normalizar texto para correspondência semântica e por palavras-chave
  normalize(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^\w\s]/g, ' ')
      .trim();
  },

  // Pesquisar na base de conhecimento oficial o módulo mais relevante
  search(queryText) {
    if (!queryText || typeof CLINICAL_KNOWLEDGE_BASE === 'undefined') {
      return null;
    }

    const normQuery = this.normalize(queryText);
    const queryTokens = normQuery.split(/\s+/).filter(t => t.length > 2);

    let bestMatch = null;
    let highestScore = 0;

    for (const entry of CLINICAL_KNOWLEDGE_BASE) {
      let score = 0;

      // Correspondência com título
      const normTitle = this.normalize(entry.title);
      const titleTokens = normTitle.split(/\s+/);
      for (const token of queryTokens) {
        if (titleTokens.includes(token)) {
          score += 5;
        }
      }

      // Correspondência com palavras-chave clínicas do manual
      for (const kw of entry.keywords) {
        const normKw = this.normalize(kw);
        if (normQuery.includes(normKw)) {
          score += 12;
        } else {
          const kwTokens = normKw.split(/\s+/);
          for (const token of queryTokens) {
            if (token === normKw) {
              score += 6;
            } else if (token.length >= 4 && kwTokens.includes(token)) {
              score += 2;
            }
          }
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = entry;
      }
    }

    // Só devolve correspondência se tiver score mínimo relevante
    return highestScore >= 5 ? { entry: bestMatch, score: highestScore } : null;
  },

  // Construir o contexto fundamentado para injetar no Gemini
  buildGroundedSystemInstruction(baseSystemInstruction, matchedEntry) {
    if (!matchedEntry) {
      return baseSystemInstruction;
    }

    return `${baseSystemInstruction}

==================================================
DOCUMENTO CLÍNICO OFICIAL DE REFERÊNCIA:
${matchedEntry.source}
TEMA: ${matchedEntry.title}
==================================================
EXCERTO OFICIAL DO MANUAL:
\"\"\"
${matchedEntry.excerpt}
\"\"\"
==================================================
REGRA DE RIGOR CLÍNICO:
1. Responde à situação descrita fundamentando-te nas regras, sinais de alarme e atuações descritas no excerto oficial acima.
2. NUNCA assumas mecanismos de trauma (como pancada na cabeça, queda ou acidente) que a vítima não tenha mencionado explicitamente.
3. No início do Bloco 1 (DIAGNÓSTICO E GRAVIDADE), inclui obrigatoriamente a citação da fonte: [Fonte: ${matchedEntry.source}].
4. Sê rápido, direto e cirúrgico.`;
  },

  // Resposta de emergência de recurso (Fallback) se a API da Google falhar ou estiver sobrecarregada
  generateOfflineProtocolResponse(matchedEntry) {
    if (!matchedEntry) {
      return `1. 🩺 DIAGNÓSTICO E GRAVIDADE:
[Triagem Básica Inicial • Protocolo INEM]
Situação que requer avaliação presencial das funções vitais.

2. 🟢 AÇÃO IMEDIATA (O QUE FAZER):
• Garanta a segurança do local e da vítima;
• Mantenha a vítima em posição confortável e a via aérea permeável;
• Vigie a respiração e o estado de consciência continuamente.

3. ⛔ PROIBIÇÕES CRÍTICAS (O QUE NUNCA FAZER):
• Nunca abandone uma vítima com perda de sentidos;
• Nunca dê comida ou líquidos na fase aguda;
• Não faça movimentos bruscos na coluna se houver suspeita de trauma ou queda.

4. 📞 CONDUTA 112:
• Ligue 112 imediatamente caso a vítima apresente prostração, dor intensa ou perda de consciência.`;
    }

    let conduta112 = '• Ligue 112 se houver alteração do estado de consciência, desmaio, vómitos, dores intensas ou hemorragia ativa.';
    let gravidadeLabel = '🟡 URGÊNCIA MODERADA';

    const criticalIds = ['sbv', 'ova', 'avc', 'dor_toracica', 'tce', 'anafilaxia', 'tvm', 'trauma_toracico_abdominal', 'amputacao_esmagamento', 'eap_insuficiencia_cardiaca', 'parto_iminente'];
    if (criticalIds.includes(matchedEntry.id)) {
      gravidadeLabel = '🔴 EMERGÊNCIA CRÍTICA';
      conduta112 = `🚨 **LIGAR 112 DE IMEDIATO!**\nSituação clínica ou traumática com risco iminente de agravamento vital segundo o manual de TAS / INEM. Ligue 112 em alta-voz enquanto presta os primeiros socorros.`;
    }

    return `1. 🩺 DIAGNÓSTICO E GRAVIDADE:
[Fonte: ${matchedEntry.source}]
Classificação: **${gravidadeLabel}** para **${matchedEntry.title}**.

2. 🟢 AÇÃO IMEDIATA (DIRETRIZES DO MANUAL):
• Posicione a vítima em repouso e posição de conforto neutra;
• Avalie e mantenha a via aérea permeável e vigilância respiratória constante;
• Em suspeita de traumatismo ou queda, estabilize a cabeça e coluna sem movimentos bruscos.

3. ⛔ PROIBIÇÕES CRÍTICAS DO MANUAL:
• Nunca administrar alimentos, água ou medicação oral na fase aguda;
• Não permitir que a vítima adormeça sem vigilância nos primeiros minutos;
• Não sacudir nem mexer na vítima se estiver inconsciente (proteger e vigiar respiração).

4. 📞 CONDUTA 112:
${conduta112}`;
  }
};
