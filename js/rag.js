// MOTOR RAG (RETRIEVAL-AUGMENTED GENERATION) - BASEADO NOS MANUAIS DE PRIMEIROS SOCORROS & TAS (HUGO FONTE)
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

    const EN_SYNONYMS = {
      burn: 'queimadura', burns: 'queimadura', blister: 'bolha', blisters: 'bolha', scald: 'queimadura',
      choking: 'asfixia engasgamento', choke: 'asfixia engasgamento', airway: 'via aerea', heimlich: 'heimlich',
      bleeding: 'hemorragia sangue', blood: 'sangue', tourniquet: 'garrote torniquete', cut: 'ferida corte', amputation: 'amputacao',
      stroke: 'avc trombolise', slurred: 'fala', droop: 'face',
      cardiac: 'paragem cardiaca', arrest: 'paragem', cpr: 'sbv compressoes', unconscious: 'inconsciente', fainted: 'desmaio', breathing: 'respiracao',
      seizure: 'convulsao epilepsia', epilepsy: 'epilepsia', convulsion: 'convulsao', fits: 'convulsao',
      allergy: 'anafilaxia alergia', allergic: 'anafilaxia alergia', anaphylaxis: 'anafilaxia', epipen: 'adrenalina epipen', swelling: 'inchaco edema', sting: 'picada',
      chest: 'toracica peito', heart: 'enfarte peito', attack: 'enfarte',
      fever: 'febre', baby: 'lactente bebe', infant: 'lactente bebe', child: 'crianca', croup: 'laringite crupe', rash: 'petequias manchas', spots: 'petequias manchas',
      fracture: 'fratura', broken: 'fratura', sprain: 'entorse', spine: 'tvm coluna', spinal: 'tvm coluna', neck: 'pescoco', head: 'cranio cabeca',
      poison: 'intoxicacao envenenamento', poisoned: 'intoxicacao', bleach: 'lixivia', swallowed: 'ingestao', hypoglycemia: 'hipoglicemia', diabetes: 'diabetes',
      heatstroke: 'golpe calor', hypothermia: 'hipotermia', drowning: 'afogamento', asthma: 'asma', shortness: 'dispneia falta ar',
      labor: 'parto', childbirth: 'parto', delivery: 'parto', pregnancy: 'gravida'
    };

    let normQuery = this.normalize(queryText);
    let queryTokens = normQuery.split(/\s+/).filter(t => t.length > 2);
    const expanded = [];
    for (const token of queryTokens) {
      if (EN_SYNONYMS[token]) {
        const syn = EN_SYNONYMS[token];
        normQuery += ' ' + syn;
        syn.split(/\s+/).forEach(s => expanded.push(s));
      }
    }
    if (expanded.length) {
      queryTokens = queryTokens.concat(expanded);
    }

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
    const isEn = typeof window !== 'undefined' && window.AppLang === 'en';
    if (isEn) {
      return `${baseSystemInstruction}

==================================================
OFFICIAL CLINICAL REFERENCE DOCUMENT:
${matchedEntry.source}
TOPIC: ${matchedEntry.title}
==================================================
OFFICIAL MANUAL EXCERPT (PORTUGUESE):
\"\"\"
${matchedEntry.excerpt}
\"\"\"
==================================================
CLINICAL RIGOR RULES:
1. Answer the described situation strictly based on the rules, red flags, and actions in the official excerpt above.
2. NEVER assume trauma mechanisms (such as hitting the head, falling, or an accident) that the victim did not explicitly state.
3. At the start of Block 1 (DIAGNOSIS & SEVERITY), include the source citation: [Source: ${matchedEntry.source}].
4. For moderate or mild conditions (no imminent threat to life), the primary referral in Portugal is the SNS 24 Health Line (808 24 24 24). Reserve 112 STRICTLY for life-threatening emergencies.
5. Be fast, direct, and surgical. Answer in English.`;
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
4. Para situações de gravidade moderada ou ligeira (sem risco de vida iminente), o encaminhamento de eleição em Portugal é a Linha SNS 24 (808 24 24 24). Reserva o 112 EXCLUSIVAMENTE para risco vital ou emergência médica comprovada.
5. Sê rápido, direto e cirúrgico.`;
  },

  // Resposta de emergência de recurso (Fallback) se a API da Google falhar ou estiver sobrecarregada
  generateOfflineProtocolResponse(matchedEntry) {
    const isEn = typeof window !== 'undefined' && window.AppLang === 'en';
    const criticalIds = ['sbv', 'ova', 'avc', 'dor_toracica', 'tce', 'anafilaxia', 'tvm', 'trauma_toracico_abdominal', 'amputacao_esmagamento', 'eap_insuficiencia_cardiaca', 'parto_iminente', 'pediatria_lactente'];

    if (isEn) {
      if (!matchedEntry) {
        return `1. 🩺 DIAGNOSIS & SEVERITY:
[Initial Basic Triage • INEM / SNS 24 Protocol]
Classification: **🟡 MODERATE URGENCY** for in-person vital signs assessment.

2. 🟢 IMMEDIATE ACTION (WHAT TO DO):
• Ensure scene and victim safety;
• Keep the victim comfortable with an open, clear airway;
• Continuously monitor breathing and consciousness.

3. ⛔ CRITICAL PROHIBITIONS (WHAT NEVER TO DO):
• Never leave an unconscious victim unattended;
• Never give food or liquids in the acute phase;
• Avoid sudden spine/neck movement if trauma or a fall is suspected.

4. 📞 RECOMMENDED REFERRAL:
• If there is no imminent threat to life, contact the **SNS 24 Line (808 24 24 24)** for clinical triage and healthcare center referral.
• Call **112** immediately ONLY if the victim loses consciousness, has severe breathing difficulty, or chest pain.`;
      }

      const isCrit = criticalIds.includes(matchedEntry.id);
      const sevLabel = isCrit ? '🔴 CRITICAL EMERGENCY' : '🟡 MODERATE URGENCY';
      const referral = isCrit
        ? `🚨 **CALL 112 IMMEDIATELY (EMERGENCY)!**\nClinical or traumatic situation with imminent life threat per the EMT / INEM Manual. Call 112 on speakerphone while providing first aid.`
        : `• Stable clinical situation (no immediate life-threatening criteria). Contact **SNS 24 Line (808 24 24 24)** for medical advice and Health Center referral.\n• Call **112** urgently ONLY if red flags appear: loss of consciousness, severe breathing difficulty, crushing chest pain, or active bleeding.`;
      const title = (typeof window.t === 'function') ? window.t(matchedEntry.title) : matchedEntry.title;

      return `1. 🩺 DIAGNOSIS & SEVERITY:
[Source: ${matchedEntry.source}]
Classification: **${sevLabel}** for **${title}**.

2. 🟢 IMMEDIATE ACTION (MANUAL GUIDELINES):
• Place the victim at rest in a neutral, comfortable position;
• Assess and keep the airway clear while continuously monitoring breathing;
• If trauma or a fall is suspected, stabilize head and spine without sudden movement.

3. ⛔ CRITICAL PROHIBITIONS:
• Never give food, water, or oral medication during the acute phase;
• Do not let the victim fall asleep unmonitored during the first minutes;
• Do not shake or move the victim if unconscious (protect and monitor breathing).

4. 📞 RECOMMENDED REFERRAL:
${referral}`;
    }

    if (!matchedEntry) {
      return `1. 🩺 DIAGNÓSTICO E GRAVIDADE:
[Triagem Básica Inicial • Protocolo INEM / SNS 24]
Classificação: **🟡 URGÊNCIA MODERADA** para avaliação presencial das funções vitais.

2. 🟢 AÇÃO IMEDIATA (O QUE FAZER):
• Garanta a segurança do local e da vítima;
• Mantenha a vítima em posição confortável e a via aérea permeável;
• Vigie a respiração e o estado de consciência continuamente.

3. ⛔ PROIBIÇÕES CRÍTICAS (O QUE NUNCA FAZER):
• Nunca abandone uma vítima com perda de sentidos;
• Nunca dê comida ou líquidos na fase aguda;
• Não faça movimentos bruscos na coluna se houver suspeita de trauma ou queda.

4. 📞 ENCAMINHAMENTO RECOMENDADO:
• Caso não haja risco de vida iminente, contacte a **Linha SNS 24 (808 24 24 24)** para triagem clínica e encaminhamento para o centro de saúde.
• Ligue **112** imediatamente APENAS se a vítima apresentar perda de consciência, dificuldade respiratória grave ou dores no peito.`;
    }

    let encaminhamento = `• Situação clínica estável (sem critérios de emergência vital imediata). Contacte a **Linha SNS 24 (808 24 24 24)** para aconselhamento clínico e encaminhamento para o Centro de Saúde.\n• Ligar **112** de emergência APENAS se surgirem sinais de alarme: perda de consciência, dificuldade respiratória grave, dor opressiva no peito ou hemorragia ativa.`;
    let gravidadeLabel = '🟡 URGÊNCIA MODERADA';

    if (criticalIds.includes(matchedEntry.id)) {
      gravidadeLabel = '🔴 EMERGÊNCIA CRÍTICA';
      encaminhamento = `🚨 **LIGAR 112 DE IMEDIATO (INEM)!**\nSituação clínica ou traumática com risco vital eminente segundo o manual de TAS / INEM. Ligue 112 em alta-voz enquanto presta os primeiros socorros.`;
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

4. 📞 ENCAMINHAMENTO RECOMENDADO:
${encaminhamento}`;
  }
};
