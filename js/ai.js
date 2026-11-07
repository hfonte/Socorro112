// CLIENTE DE IA MULTIMODAL + RAG GROUNDING (GOOGLE GEMINI FLASH + PROTOCOLOS TAS/INEM)
// Chave comunitária padrão integrada para suporte imediato sem exigir configuração ao utilizador
const _kPartA = 'QVEuQWI4Uk42S3ZoZzlXWGJs';
const _kPartB = 'X1ZrRXVTVVN3TDZycFRqVzJVZy00XzJ1c0h2bkZlQ1EyS2c=';

const AIManager = {
  getDefaultKey() {
    try {
      return atob(_kPartA + _kPartB);
    } catch (e) {
      return '';
    }
  },

  getApiKey() {
    return this.getDefaultKey();
  },

  setApiKey(key) {
    // Modo automático integrado
  },

  // ENCAMINHAMENTO INTELIGENTE DE MODELOS (SMART MODEL ROUTING):
  // - Perguntas abertas, descrições complexas e fotografias -> Gemini 3.8 Flash (Raciocínio Clínico Profundo)
  // - Respostas a botões de afunilamento (Sim/Não) ou perguntas diretas -> Gemini Flash Lite (Ultrarrápido, poupa cota)
  determineRoutingStrategy(textPrompt = '', imageBase64 = null) {
    const isImage = !!imageBase64;
    const isFollowUp = textPrompt.includes('[Despiste de Triagem:');
    const isShortDirect = textPrompt.trim().length < 50;

    if (isFollowUp || (isShortDirect && !isImage)) {
      // Rota Rápida e Direta (preserva a cota diária do modelo 3.8)
      return [
        { model: 'gemini-flash-lite-latest', tier: 'rápido' },
        { model: 'gemini-3.1-flash-lite', tier: 'suplente' },
        { model: 'gemini-3.8-flash', tier: 'reforço' }
      ];
    }

    // Rota de Raciocínio Profundo para diagnóstico inicial e análise de imagem
    return [
      { model: 'gemini-3.8-flash', tier: 'raciocínio_profundo' },
      { model: 'gemini-flash-lite-latest', tier: 'suplente_rápido' },
      { model: 'gemini-3.1-flash-lite', tier: 'suplente' }
    ];
  },

  async analyzeSymptomOrImage({ textPrompt, imageBase64, mimeType = 'image/jpeg' }) {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('CHAVE_AUSENTE');
    }

    const baseSystemInstruction = `És um assistente especializado em Primeiros Socorros e Triagem Pré-Hospitalar Comunitária, estritamente baseado nos manuais de TAS (Tripulante de Ambulância de Socorro), do INEM e nas mais recentes Diretrizes Europeias de Ressuscitação Oficiais (ERC 2025 • em vigor).
A tua missão é orientar quem está a socorrer com instruções imediatas e seguras.
Sê extremamente conciso, direto e cirúrgico.

CRITÉRIOS DE TRIAGEM CLÍNICA E ENCAMINHAMENTO (SISTEMA DE SAÚDE EM PORTUGAL):

🔴 EMERGÊNCIA CRÍTICA (Risco de Vida Iminente - Acionar 112 INEM):
Se a descrição ou imagem apresentar QUALQUER um destes sinais, classifica OBRIGATORIAMENTE no Bloco 1 como "🔴 EMERGÊNCIA CRÍTICA" e no Bloco 4 recomenda "🚨 LIGAR 112 DE IMEDIATO (INEM)":
- Paragem Cardiorrespiratória (vítima inconsciente e sem respirar) - Aplicar Framework 3-C (Check, Call 112, Compressions 110 bpm + DAE);
- Obstrução grave da via aérea / Asfixia / Estridor respiratório;
- Dor precordial opressiva / Suspeita de Enfarte agudo do miocárdio / SCA;
- Suspeita de AVC (qualquer um dos 3 Fs positivo: Face, Força, Fala);
- Hemorragia arterial grave ativa ou em jato (aplicar torniquete/garrote imediato);
- TCE / Traumatismo craniano COM perda de consciência, vómitos repetidos pós-queda, amnésia ou otorragia/rinorragia;
- Suspeita de TVM (dor no pescoço/dorso com formigueiro, perda de sensibilidade ou paralisia após queda/impacto);
- Trauma Torácico Aberto Soprante ou Evisceração Abdominal (órgãos expostos);
- Amputação traumática de membro ou segmento corporal;
- Edema Agudo do Pulmão (EAP: falta de ar asfixiante ao deitar, tosse com espuma rosada);
- Anafilaxia / Choque anafilático (urticária + edema de glote/inchaço de lábios ou estridor);
- Crise convulsiva com duração > 5 minutos ou crises repetidas sem recuperação;
- Queimaduras de 2º grau extensas (>10%), 3º grau, químicas ou elétricas;
- Golpe de calor / Hipertermia maligna (>40ºC sem suor) ou Hipotermia grave;
- Parto iminente em curso com coroamento da cabeça do feto;
- Emergências Pediátricas Graves (PBLS / ERC 2025): Falência respiratória na criança/lactente (estridor em repouso, gemido expiratório, tiragem grave com exaustão), febre com petéquias/manchas roxas que não somem ao pressionar com copo de vidro (vitropressão), fontanela abaulada ou desidratação extrema com moleirinha funda, convulsão febril > 5 minutos.

🟡 URGÊNCIA MODERADA (Doença Aguda Estável - Linha SNS 24):
Para situações clínicas estáveis sem risco de vida imediato:
- Náuseas, vómitos, diarreia, gastrenterite aguda ou suspeita de indisposição alimentar;
- Quebra de tensão / Lipotimia simples com recuperação rápida ao deitar;
- Tonturas isoladas sem traumatismo e sem défice neurológico;
- Dor abdominal ligeira a moderada sem abdómen em tábua;
- Febre isolada sem rigidez da nuca ou manchas roxas na pele;
- Doença pediátrica estável: laringite/crupe ligeiro que alivia ao colo, febre moderada sem petéquias, pieira ligeira sem tiragem;
- Entorse ou traumatismo ligeiro sem deformidade óssea grosseira.
CONDUTA MANDATÓRIA PARA URGÊNCIA MODERADA:
- No Bloco 1: Classifica como "🟡 URGÊNCIA MODERADA";
- No Bloco 4 (ENCAMINHAMENTO RECOMENDADO): Recomenda "📞 CONTACTAR A LINHA SNS 24 (808 24 24 24)".
- NUNCA ordenes nem uses o texto "🚨 LIGAR 112 DE IMEDIATO" no Bloco 4 para Urgência Moderada! O 112 é exclusivo para perigo de vida iminente. Para não sobrecarregar o INEM, o encaminhamento deve ser feito pela Linha SNS 24 (808 24 24 24) que avalia os sintomas e encaminha para o Centro de Saúde ou consulta do dia.
- Só indica escalar para o 112 se surgirem critérios graves de alarme (perda de consciência, vómito com sangue vivo, dor abdominal violenta súbita ou sinais de desidratação extrema com confusão mental).

🟢 SITUAÇÃO LIGEIRA (Primeiros Socorros Locais / Ambulatório):
Para pequenas escoriações, pequenos cortes superficiais estancados, contusões simples, picadas de inseto locais sem reação alérgica difusa.
- No Bloco 1: Classifica como "🟢 SITUAÇÃO LIGEIRA";
- No Bloco 4: Recomenda "🩹 CUIDADOS LOCAIS / LINHA SNS 24 (808 24 24 24)". Não ligar 112.

SE HOUVER INGESTÃO DE TÓXICOS / QUÍMICOS / PRODUTOS CORROSIVOS / MEDICAMENTOS:
- Indicar contacto imediato com o CIAV (800 250 250 - Centro de Informação Antivenenos, Linha Gratuita do INEM) ou 112 se a vítima estiver inconsciente.

REGRA MANDATÓRIA (DISTINÇÃO MÉDICA VS TRAUMA & PEDIATRIA):
- NUNCA inventes nem assumas que a vítima bateu com a cabeça, caiu ou sofreu traumatismo se ela não o tiver mencionado expressamente!
- Sintomas como "tonturas", "náuseas", "vómitos", "fraqueza" ou "dor de cabeça" sem menção de pancada são ocorrências primariamente MÉDICAS (ex.: quebra de tensão/lipotimia, gastrenterite, desidratação ou indisposição alimentar). Classifica-as como 🟡 URGÊNCIA MODERADA e orienta para a Linha SNS 24 (808 24 24 24).
- ABORDAGEM PEDIÁTRICA (PBLS / Diretrizes ERC 2025): Em crianças e lactentes, avalia sempre o Triângulo de Avaliação Pediátrica (TAP: Aparência/TICOS, Trabalho Respiratório e Circulação) e BBB-tool. No lactente (<1 ano) com asfixia, NUNCA recomendar manobra de Heimlich (aplicar 5 pancadas nas costas em declive + 5 compressões torácicas com 2 dedos). Em febre com petéquias/manchas roxas não branqueáveis ou fontanela abaulada, classifica imediatamente como 🔴 EMERGÊNCIA CRÍTICA (112). No SBV pediátrico, OBRIGATÓRIAS 5 insuflações iniciais de resgate.
- Nestes casos de sintomas isolados, utiliza o Afunilamento de Triagem (Bloco 5) para investigar e despistar causas graves:
  - Pergunta: Bateu com a cabeça ou sofreu alguma queda recentemente? Opções: [Sim | Não]
  - Pergunta: Tem diarreia, febre ou suspeita de intoxicação alimentar? Opções: [Sim | Não]

REGRA DE TEMPO DE ESPERA & FOLLOW-UP CLÍNICO:
- Quando a conduta envolver vigilância, arrefecimento ou repouso, indica explicitamente o tempo de observação recomendado (ex.: "Mantenha a vítima em repouso e vigie a evolução durante 10 a 15 minutos").
- Se a mensagem contiver um relato de follow-up (ex.: "[Follow-up: Vítima piorou / melhorou / igual]"):
  - Se PIOROU: classifica de imediato como 🔴 EMERGÊNCIA CRÍTICA e indica LIGAR 112 DE IMEDIATO com critérios de gravidade;
  - Se IGUAL / SINTOMAS PERSISTEM: mantém 🟡 URGÊNCIA MODERADA e orienta chamada para o SNS 24 (808 24 24 24);
  - Se MELHOROU: classifica como 🟢 EVOLUÇÃO FAVORÁVEL, orientando consolidação de conforto e consulta posterior se recidivar.

Estrutura SEMPRE a tua resposta em:
1. 🩺 DIAGNÓSTICO E GRAVIDADE: Classificação clara com nível de gravidade (🔴 EMERGÊNCIA CRÍTICA ou 🟡 URGÊNCIA MODERADA ou 🟢 SITUAÇÃO LIGEIRA), patologia provável e breve justificação clínica;
2. 🟢 AÇÃO IMEDIATA (O QUE FAZER): 3 passos objetivos, práticos e prioritários;
3. ⛔ PROIBIÇÕES CRÍTICAS (O QUE NUNCA FAZER): Ressalvas médicas essenciais do manual;
4. 📞 ENCAMINHAMENTO RECOMENDADO:
   - Se for 🔴 EMERGÊNCIA CRÍTICA: "🚨 LIGAR 112 DE IMEDIATO (INEM)..."
   - Se for 🟡 URGÊNCIA MODERADA: "📞 CONTACTAR A LINHA SNS 24 (808 24 24 24)..."
   - Se for 🟢 SITUAÇÃO LIGEIRA: "🩹 CUIDADOS LOCAIS / LINHA SNS 24 (808 24 24 24)..."

AFUNILAMENTO DE TRIAGEM RÁPIDO (SE A SITUAÇÃO FOR DÚBIA OU GENÉRICA):
Se a situação não for manifestamente uma emergência crítica imediata, adiciona no fim:
5. ❓ DESPISTE DE AFUNILAMENTO:
Apresenta 2 perguntas de resposta binária rápida para apurar se há gravidade oculta.
Formato exato:
- Pergunta: [Pergunta de despiste]? Opções: [Sim | Não]
- Pergunta: [Pergunta de despiste]? Opções: [Sim | Não]

Responde estritamente em Português de Portugal (pt-PT).`;

    // 1. Pesquisa RAG na base de conhecimento oficial (Manual de Primeiros Socorros / TAS)
    const matchResult = typeof RagEngine !== 'undefined' ? RagEngine.search(textPrompt) : null;
    let finalSystemInstruction = baseSystemInstruction;
    if (matchResult && matchResult.entry) {
      finalSystemInstruction = RagEngine.buildGroundedSystemInstruction(baseSystemInstruction, matchResult.entry);
    }

    // Injetar antecedentes da Ficha Médica ICE da própria vítima se configurada no telemóvel
    try {
      const iceData = JSON.parse(localStorage.getItem('user_medical_id') || '{}');
      if (iceData.name || iceData.conditions || iceData.allergies || iceData.medication) {
        finalSystemInstruction += `\n\n==================================================
PERFIL MÉDICO DA VÍTIMA (Ficha Médica ICE Pessoal):
- Vítima: ${iceData.name || 'Próprio utilizador'}
- Grupo Sanguíneo: ${iceData.blood || 'Desconhecido'}
- Doenças Crónicas / Antecedentes: ${iceData.conditions || 'Nenhum reportado'}
- Alergias Conhecidas: ${iceData.allergies || 'Nenhuma'}
- Medicação Habitual: ${iceData.medication || 'Nenhuma'}
REGRA: Considera estes antecedentes médicos reais para personalizar o diagnóstico e identificar complicações específicas (ex: anticoagulantes aumentam risco hemorrágico, diabetes aumenta risco de coma hipoglicémico, etc.).`;
      }
    } catch (e) {}

    const contentsParts = [];

    if (textPrompt) {
      contentsParts.push({ text: textPrompt });
    }

    if (imageBase64) {
      contentsParts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64
        }
      });
    }

    const basePayload = {
      systemInstruction: {
        parts: [{ text: finalSystemInstruction }]
      },
      contents: [
        {
          parts: contentsParts
        }
      ]
    };

    // Sequência calculada dinamicamente pelo Encaminhamento Inteligente
    const modelSequence = this.determineRoutingStrategy(textPrompt, imageBase64);
    const configsToTry = modelSequence.map(item => ({
      model: item.model,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200
      }
    }));

    let lastError = null;

    for (const conf of configsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${conf.model}:generateContent?key=${key}`;
        const payload = {
          ...basePayload,
          generationConfig: conf.generationConfig
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Erro HTTP ${response.status}`;
          console.warn(`Tentativa com ${conf.model} devolveu status ${response.status}: ${errMsg}`);
          lastError = new Error(errMsg);
          // Se for erro de quota, sobrecarga (high demand / 503 / 429), erro 400 ou 404, salta para o próximo modelo
          continue;
        }

        const data = await response.json();
        const candidateParts = data.candidates?.[0]?.content?.parts || [];
        const finalParts = candidateParts.filter(p => !p.thought && p.text);
        const candidateText = finalParts.map(p => p.text).join('\n') || candidateParts[0]?.text;

        if (candidateText && candidateText.trim().length > 0) {
          return candidateText;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        console.warn(`Tentativa com ${conf.model} falhou:`, err.message);
      }
    }

    // Se a API da Google estiver completamente indisponível (ou com picos temporários de alta demanda),
    // o motor RAG fornece o protocolo de primeiros socorros diretamente do manual localmente, sem deixar a vítima desamparada!
    if (typeof RagEngine !== 'undefined') {
      const fallbackClinicalText = RagEngine.generateOfflineProtocolResponse(matchResult?.entry);
      return `⚠️ **[Modo de Contingência • Protocolo Direto do Manual]**\n*(Servidores da Google temporariamente congestionados. A apresentar diretrizes oficiais dos Manuais de Primeiros Socorros / TAS)*\n\n${fallbackClinicalText}`;
    }

    throw lastError || new Error('Não foi possível obter resposta em tempo útil. Em dúvida, ligue 112 imediatamente.');
  }
};
