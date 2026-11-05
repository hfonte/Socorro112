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

  async analyzeSymptomOrImage({ textPrompt, imageBase64, mimeType = 'image/jpeg' }) {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('CHAVE_AUSENTE');
    }

    const baseSystemInstruction = `És um assistente especializado em Primeiros Socorros e Triagem Pré-Hospitalar Comunitária, estritamente baseado nos manuais de TAS (Tripulante de Ambulância de Socorro), do INEM e do Conselho Europeu de Ressuscitação (ERC 2025).
A tua missão é orientar quem está a socorrer com instruções imediatas e seguras.
Sê extremamente conciso, direto e cirúrgico.

CRITÉRIOS MANDATÓRIOS DE GRAVIDADE (LIGAR 112 IMEDIATAMENTE):
Se a descrição ou imagem apresentar QUALQUER um destes sinais, deves classificar como EMERGÊNCIA CRÍTICA e o Bloco 4 DEVE ser obrigatoriamente "🚨 LIGAR 112 DE IMEDIATO":
- TCE / Traumatismo na cabeça COM perda de consciência (desmaio, amnésia, síncope, mesmo de poucos segundos), sonolência excessiva, vómitos, visão turva ou sangue/líquido no ouvido ou nariz;
- Hemorragia arterial ativa ou em jato;
- Dificuldade respiratória aguda ou asfixia;
- Suspeita de AVC (qualquer um dos 3 Fs positivo: Face, Força, Fala);
- Dor forte ou aperto no peito com irradiação;
- Crise convulsiva com duração superior a 5 minutos ou vítima que não recupera os sentidos;
- Queimaduras de 2º grau extensas ou 3º grau;
- Ingestão de tóxicos ou químicos corrosivos.

Estrutura SEMPRE a tua resposta em:
1. 🩺 DIAGNÓSTICO E GRAVIDADE: Classificação clara com nível de gravidade (🔴 EMERGÊNCIA CRÍTICA ou 🟡 URGÊNCIA MODERADA ou 🟢 SITUAÇÃO LIGEIRA);
2. 🟢 AÇÃO IMEDIATA (O QUE FAZER): 3 passos objetivos, práticos e prioritários;
3. ⛔ PROIBIÇÕES CRÍTICAS (O QUE NUNCA FAZER): Ressalvas médicas essenciais do manual;
4. 📞 CONDUTA 112: Se tiver critérios de gravidade, indica expressamente "🚨 LIGAR 112 DE IMEDIATO" e o que dizer ao operador.

AFUNILAMENTO DE TRIAGEM RÁPIDO (SE A SITUAÇÃO FOR DÚBIA OU GENÉRICA):
Se a situação não for manifestamente uma emergência crítica imediata, adiciona no fim:
5. ❓ DESPISTE DE AFUNILAMENTO:
Apresenta 2 perguntas de resposta binária rápida para apurar se há gravidade oculta.
Formato exato:
- Pergunta: [Pergunta de despiste]? Opções: [Sim | Não]
- Pergunta: [Pergunta de despiste]? Opções: [Sim | Não]

Responde estritamente em Português de Portugal (pt-PT).`;

    // 1. Pesquisa RAG na base de conhecimento oficial (Manuais UFCD 9988 / TAS)
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

    // Configurações em cascata para garantir fiabilidade máxima:
    // 1. gemini-3.8-flash (modelo de referência atual) com limite de 1200 tokens (rápido e completo)
    // 2. gemini-3.8-flash com thinking desligado (se suportado pelo endpoint)
    // 3. gemini-2.5-flash como alternativa
    const configsToTry = [
      {
        model: 'gemini-3.8-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200
        }
      },
      {
        model: 'gemini-3.8-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
          thinkingConfig: { thinkingBudget: 0 }
        }
      },
      {
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200
        }
      }
    ];

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
      return `⚠️ **[Modo de Contingência • Protocolo Direto do Manual]**\n*(Servidores da Google temporariamente congestionados. A apresentar diretrizes oficiais dos teus Manuais de TAS/UFCD 9988)*\n\n${fallbackClinicalText}`;
    }

    throw lastError || new Error('Não foi possível obter resposta em tempo útil. Em dúvida, ligue 112 imediatamente.');
  }
};
