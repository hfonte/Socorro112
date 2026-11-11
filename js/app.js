// LÓGICA PRINCIPAL DA APLICAÇÃO CUIDAR EM EMERGÊNCIA & GUIA PRÁTICO DE PRIMEIROS SOCORROS (ERC 2025)
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const AppState = {
    currentScreen: 'screen-emergency',
    isEmergencyMode: true,
    isAdult: true,
    ratioMode: '30_2',
    sbvActive: false,
    beats: 0,
    cycles: 0,
    secondsElapsed: 0,
    timerInterval: null,
    tourniquetStartTime: null,
    tourniquetInterval: null,
    burnTimerSeconds: 900,
    burnInterval: null,
    strokeOnsetTime: null,
    seizureSeconds: 0,
    seizureInterval: null
  };

  // INICIALIZAR GEOLOCALIZAÇÃO
  GeoManager.init((loc) => {
    updateGeoUI(loc);
  });

  let currentCabulaIncident = 'geral';

  function updateCabulaScript(incidentKey = currentCabulaIncident) {
    currentCabulaIncident = incidentKey;
    const script = GeoManager.getCoduSpeechScript(incidentKey);
    document.querySelectorAll('.geo-codu-script').forEach(el => {
      el.textContent = script;
    });
  }

  function setCabulaIncident(incidentKey) {
    currentCabulaIncident = incidentKey;
    document.querySelectorAll('.btn-cabula-chip').forEach(b => {
      if (b.dataset.incident === incidentKey) {
        b.classList.add('active', 'bg-amber-500', 'text-slate-950', 'font-bold');
        b.classList.remove('bg-slate-800', 'text-slate-300');
      } else {
        b.classList.remove('active', 'bg-amber-500', 'text-slate-950', 'font-bold');
        b.classList.add('bg-slate-800', 'text-slate-300');
      }
    });
    updateCabulaScript(incidentKey);
  }

  function updateGeoUI(loc) {
    document.querySelectorAll('.geo-address-display').forEach(el => el.textContent = loc.address);
    document.querySelectorAll('.geo-coords-display').forEach(el => el.textContent = `${loc.lat || '--'}, ${loc.lon || '--'}`);
    document.querySelectorAll('.geo-landmark-display').forEach(el => el.textContent = loc.landmark);
    updateCabulaScript();

    // Atualizar links para Google Maps centrado nas coordenadas
    if (loc.lat && loc.lon) {
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=empresas+ou+lojas&center=${loc.lat},${loc.lon}`;
      const btnGmaps = document.getElementById('btn-open-gmaps');
      const modalGmaps = document.getElementById('modal-gmaps-link');
      if (btnGmaps) btnGmaps.href = gmapsUrl;
      if (modalGmaps) modalGmaps.href = gmapsUrl;
    }
  }

  // NAVEGAÇÃO DE ECRÃS (COM GESTÃO AUTOMÁTICA DE WAKE LOCK EM EMERGÊNCIA)
  function navigateTo(screenId) {
    document.querySelectorAll('.screen-view').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      AppState.currentScreen = screenId;
    }

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === screenId);
    });

    if (screenId === 'screen-sbv') setCabulaIncident('inconsciente');
    else if (screenId === 'screen-ova') setCabulaIncident('engasgamento');
    else if (screenId === 'screen-trauma') setCabulaIncident('hemorragia');

    // Registo de ecrã no Google Analytics
    if (typeof gtag === 'function') {
      try {
        gtag('event', 'screen_view', {
          app_name: 'CuidarEmEmergencia',
          screen_name: screenId
        });
      } catch (_) {}
    }

    // Se estiver num ecrã crítico de socorro, manter o ecrã ativo sem desligar
    const emergencyScreens = ['screen-emergency', 'screen-sbv', 'screen-ova', 'screen-trauma', 'screen-pediatria'];
    if (emergencyScreens.includes(screenId)) {
      if (typeof WakeLockManager !== 'undefined') {
        WakeLockManager.acquire();
      }
    } else {
      if (typeof WakeLockManager !== 'undefined' && (!AudioManager || !AudioManager.metroInterval)) {
        WakeLockManager.release();
      }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  window.navigateTo = navigateTo;

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.nav);
    });
  });

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.target);
    });
  });

  // SELETOR DE MODO SUPERIOR (EMERGÊNCIA vs FORMAÇÃO)
  const tabEmergency = document.getElementById('tab-mode-emergency');
  const tabLearning = document.getElementById('tab-mode-learning');

  if (tabEmergency && tabLearning) {
    tabEmergency.addEventListener('click', () => {
      AppState.isEmergencyMode = true;
      tabEmergency.classList.add('active', 'emergency-mode');
      tabLearning.classList.remove('active', 'learning-mode');
      navigateTo('screen-emergency');
    });

    tabLearning.addEventListener('click', () => {
      AppState.isEmergencyMode = false;
      tabLearning.classList.add('active', 'learning-mode');
      tabEmergency.classList.remove('active', 'emergency-mode');
      navigateTo('screen-learning-hub');
    });
  }

  // ========================================================
  // ACCORDIONS E AUTOESTUDO DO MODO FORMAÇÃO
  // ========================================================
  // Garantir que a página da formação inicia com todos os módulos minimizados
  document.querySelectorAll('#screen-learning-hub .chapter-accordion').forEach(ch => {
    ch.classList.remove('open');
  });

  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.closest('.chapter-accordion');
      if (!parent) return;
      const wasOpen = parent.classList.contains('open');
      parent.classList.toggle('open', !wasOpen);
    });
  });

  // ========================================================
  // QUIZ DINÂMICO DE AUTOAVALIAÇÃO COM POOL DE QUESTÕES
  // ========================================================
  const QUIZ_BANK = [
    {
      question: "Qual é a profundidade e o rácio de compressões torácicas no SBV do adulto segundo o ERC/INEM?",
      options: [
        { text: "5 a 6 cm de profundidade com rácio de 30:2 (ou contínuas a 100-120 bpm).", isCorrect: true },
        { text: "3 a 4 cm de profundidade com rácio de 15:2.", isCorrect: false },
        { text: "Pelo menos 7 a 8 cm de profundidade contínua.", isCorrect: false }
      ],
      explanation: "No adulto a profundidade recomendada é estritamente de 5 a 6 cm, mantendo o rácio de 30 compressões para 2 ventilações."
    },
    {
      question: "Qual é a frequência (cadência) recomendada para as compressões torácicas no SBV?",
      options: [
        { text: "100 a 120 compressões por minuto.", isCorrect: true },
        { text: "60 a 80 compressões por minuto.", isCorrect: false },
        { text: "Mais de 140 compressões por minuto.", isCorrect: false }
      ],
      explanation: "O ritmo ideal é entre 100 e 120 compressões por minuto, garantindo perfusão coronária e cerebral adequada."
    },
    {
      question: "Ao realizar o VOS (Ver, Ouvir e Sentir), a vítima apresenta respiração agónica lenta e ruidosa (gasping). Qual é a conduta correta?",
      options: [
        { text: "O gasping é sinal inequívoco de PCR e exige início imediato de compressões torácicas.", isCorrect: true },
        { text: "Considerar respiração normal e colocar a vítima deitada em repouso.", isCorrect: false },
        { text: "Aguardar 1 minuto para ver se a respiração regulariza antes de intervir.", isCorrect: false }
      ],
      explanation: "O gasping (respiração agónica) não é respiração eficaz; é sinal cardinal de paragem cardíaca e não deve atrasar o SBV."
    },
    {
      question: "Numa ocorrência com dois socorristas a realizar SBV, com que frequência devem trocar de posições nas compressões?",
      options: [
        { text: "A cada 2 minutos (cerca de 5 ciclos de 30:2) para prevenir a fadiga muscular.", isCorrect: true },
        { text: "Apenas quando o primeiro socorrista pedir para parar por exaustão física.", isCorrect: false },
        { text: "A cada 10 minutos para manter a estabilidade do ritmo.", isCorrect: false }
      ],
      explanation: "A fadiga muscular instala-se aos 2 minutos e reduz a profundidade das compressões mesmo sem o socorrista se aperceber."
    },
    {
      question: "No Suporte Básico de Vida pediátrico (criança ou lactente), qual é a primeira ação ventilatória antes das compressões?",
      options: [
        { text: "Aplicar 5 insuflações iniciais de resgate, pois a paragem tem etiologia quase sempre hipóxica.", isCorrect: true },
        { text: "Iniciar de imediato com 50 compressões torácicas sem ventilar.", isCorrect: false },
        { text: "Disparar o choque com DAE antes de qualquer intervenção manual.", isCorrect: false }
      ],
      explanation: "Nas crianças a PCR é predominantemente provocada por insuficiência respiratória/hipóxia, exigindo 5 insuflações de resgate imediatas."
    },
    {
      question: "Como deve ser efetuada a compressão torácica e a posição da cabeça num lactente (< 1 ano)?",
      options: [
        { text: "Cabeça em posição neutra e compressão com 2 dedos no terço inferior do esterno (~4 cm).", isCorrect: true },
        { text: "Extensão máxima da cabeça e compressão com as duas mãos entrelaçadas.", isCorrect: false },
        { text: "Flexão forçada do pescoço sobre o peito e compressão abdominal.", isCorrect: false }
      ],
      explanation: "No bebé a hiperextensão obstrui a via aérea (deve ficar em posição neutra) e comprime-se cerca de 4 cm com 2 dedos ou técnica dos dois polegares."
    },
    {
      question: "Uma pessoa engasga-se com comida, tosse vigorosamente e fala com voz rouca. Qual deve ser a sua conduta?",
      options: [
        { text: "Apenas encorajar a continuar a tossir com força e vigiar, sendo proibido bater nas costas.", isCorrect: true },
        { text: "Aplicar imediatamente 5 pancadas com força entre as omoplatas.", isCorrect: false },
        { text: "Realizar de imediato 5 compressões de Heimlich no abdómen.", isCorrect: false }
      ],
      explanation: "Enquanto a tosse for eficaz, qualquer pancada nas costas pode desalojar o objeto e provocar uma obstrução total gravíssima."
    },
    {
      question: "Perante uma obstrução grave da via aérea no adulto consciente (não fala nem tosse, mãos ao pescoço), qual a sequência?",
      options: [
        { text: "Até 5 pancadas interescapulares (tronco inclinado à frente) alternadas com até 5 compressões de Heimlich.", isCorrect: true },
        { text: "30 compressões torácicas seguidas de 2 insuflações forçadas.", isCorrect: false },
        { text: "Deitar a vítima de costas e comprimir o pescoço.", isCorrect: false }
      ],
      explanation: "A sequência oficial para OVA grave consciente é alternar 5 pancadas interescapulares com 5 compressões de Heimlich."
    },
    {
      question: "Em que vítimas a manobra de Heimlich (compressões abdominais) está contraindicada, devendo usar compressões torácicas?",
      options: [
        { text: "Lactentes (< 1 ano), grávidas em fase avançada e obesos mórbidos.", isCorrect: true },
        { text: "Adultos com mais de 65 anos de idade.", isCorrect: false },
        { text: "Vítimas com tosse ligeira ou pigarro.", isCorrect: false }
      ],
      explanation: "Em bebés, grávidas e obesos as compressões abdominais causam graves lesões em órgãos internos, substituindo-se por compressões torácicas."
    },
    {
      question: "Se uma vítima com obstrução da via aérea cair inconsciente durante as manobras, qual é a conduta imediata?",
      options: [
        { text: "Amparar ao solo, ligar 112 e iniciar de imediato 30 compressões torácicas de SBV.", isCorrect: true },
        { text: "Introduzir os dedos às cegas na garganta para tentar puxar o corpo estranho.", isCorrect: false },
        { text: "Virar a vítima de cabeça para baixo e sacudi-la pelas pernas.", isCorrect: false }
      ],
      explanation: "A passagem à inconsciência ativa imediatamente o SBV: 30 compressões criam pressão intratorácica que ajuda a expelir o objeto."
    },
    {
      question: "Após colocar um garrote num membro com hemorragia arterial exsanguinante que não cedeu à pressão direta, qual é a regra?",
      options: [
        { text: "Registar a hora da colocação e NUNCA aliviar o garrote até aos cuidados médicos hospitalares.", isCorrect: true },
        { text: "Afrouxar o garrote a cada 10 minutos para irrigar a extremidade.", isCorrect: false },
        { text: "Retirar o garrote passados 15 minutos e substituir por compressa solta.", isCorrect: false }
      ],
      explanation: "O garrote uma vez aplicado nunca deve ser aliviado no pré-hospitalar, pois a reabertura liberta toxinas celulares e desencadeia choque."
    },
    {
      question: "Qual é o método prioritário de primeira linha para estancar uma hemorragia externa abundante?",
      options: [
        { text: "Compressão manual direta com compressas esterilizadas durante pelo menos 10 minutos.", isCorrect: true },
        { text: "Aplicação imediata de garrote em qualquer tipo de corte ou ferida.", isCorrect: false },
        { text: "Lavar a ferida com álcool e deixar sangrar para limpar impurezas.", isCorrect: false }
      ],
      explanation: "A compressão manual direta e contínua com compressas limpas é o método de 1ª linha mais eficaz para hemostase."
    },
    {
      question: "Numa queimadura de 2º grau com bolhas líquidas (flictenas), qual é a conduta prioritária inicial?",
      options: [
        { text: "Arrefecer com água corrente tépida (15°C-20°C) durante 15 a 20 minutos e nunca furar bolhas.", isCorrect: true },
        { text: "Rebentar as bolhas com agulha e aplicar pomada gorda ou manteiga.", isCorrect: false },
        { text: "Aplicar gelo diretamente sobre a queimadura para adormecer a dor.", isCorrect: false }
      ],
      explanation: "O arrefecimento prolongado com água tépida para a progressão do calor; as bolhas intactas protegem contra infeções graves."
    },
    {
      question: "O que está estritamente PROIBIDO na abordagem a uma vítima com queimadura térmica?",
      options: [
        { text: "Gelo direto, rebentar bolhas, arrancar roupas coladas e aplicar manteiga, azeite ou pasta de dentes.", isCorrect: true },
        { text: "Retirar pulseiras e anéis antes do aparecimento do edema.", isCorrect: false },
        { text: "Cobrir a lesão com compressas esterilizadas humedecidas em soro.", isCorrect: false }
      ],
      explanation: "Gelo direto causa necrose isquémica acrescida e mezinhas caseiras aumentam exponencialmente o risco de infeção grave."
    },
    {
      question: "Quais são os 3 sinais pesquisados na Escala de Cincinnati (3 «F») para suspeita de AVC?",
      options: [
        { text: "Face (boca ao lado), Força (queda de um braço estendido) e Fala (discurso enrolado/incompreensível).", isCorrect: true },
        { text: "Febre, Frio e Fome súbita.", isCorrect: false },
        { text: "Falta de ar, Feridas na boca e Fraqueza nos dois pés em simultâneo.", isCorrect: false }
      ],
      explanation: "A tríade Face, Força e Fala tem elevada sensibilidade para identificar AVC agudo e ativar a Via Verde."
    },
    {
      question: "Perante uma vítima com um dos sinais do teste dos 3 «F» positivo, qual é a atuação imediata recomendada?",
      options: [
        { text: "Ligar 112 ativando a Via Verde do AVC, registar a hora de início e não dar nada pela boca.", isCorrect: true },
        { text: "Dar um copo de água com açúcar e um comprimido para a tensão.", isCorrect: false },
        { text: "Mandar a pessoa dormir e esperar algumas horas para ver se melhora.", isCorrect: false }
      ],
      explanation: "A janela de trombólise hospitalar é de apenas 4,5 horas. Nunca dar ingestão oral pelo risco de broncoaspiração fatal."
    },
    {
      question: "Durante uma crise convulsiva tónico-clónica generalizada, o que NUNCA deve ser feito?",
      options: [
        { text: "Meter panos, dedos ou colheres na boca da vítima ou tentar segurar os membros com força.", isCorrect: true },
        { text: "Proteger a cabeça da vítima colocando um casaco macio por baixo.", isCorrect: false },
        { text: "Cronometrar a duração exata da crise convulsiva.", isCorrect: false }
      ],
      explanation: "A língua nunca se engole; colocar objetos na boca causa fraturas dentárias e lesões graves nos dedos do socorrista."
    },
    {
      question: "Em que situação está indicada a colocação da vítima em Posição Lateral de Segurança (PLS)?",
      options: [
        { text: "Vítima inconsciente mas que respira normalmente e sem suspeita de trauma na coluna.", isCorrect: true },
        { text: "Vítima em paragem cardiorrespiratória (sem respiração).", isCorrect: false },
        { text: "Vítima com suspeita de fratura da bacia ou do fémur.", isCorrect: false }
      ],
      explanation: "A PLS garante a permeabilidade da via aérea e previne asfixia por vómito em vítimas inconscientes que respiram."
    },
    {
      question: "Uma pessoa diabética com hipoglicemia (< 60 mg/dL) está consciente e engole perfeitamente. O que fazer?",
      options: [
        { text: "Administrar água com 2 a 3 pacotes de açúcar bem dissolvidos ou sumo açucarado em pequenos goles.", isCorrect: true },
        { text: "Injetar uma dose extra de insulina de imediato.", isCorrect: false },
        { text: "Fazer a pessoa correr ou fazer exercício físico vigoroso.", isCorrect: false }
      ],
      explanation: "Na vítima consciente, hidratos de carbono de absorção rápida (açúcar na água ou sumo) corrigem rapidamente a glicemia."
    },
    {
      question: "Numa intoxicação acidental por ingestão de produto químico de limpeza (lixívia), qual é a regra de ouro?",
      options: [
        { text: "Contactar de imediato o CIAV (800 250 250) ou 112, nunca provocar o vómito e nunca dar leite ou azeite.", isCorrect: true },
        { text: "Provocar o vómito imediatamente enfiando os dedos na garganta.", isCorrect: false },
        { text: "Fazer beber um litro de leite gordo para neutralizar o cáustico.", isCorrect: false }
      ],
      explanation: "Provocar vómito com cáusticos queima novamente o esófago e o leite acelera a absorção de químicos lipossolúveis."
    },
    {
      question: "Qual é a posição adequada para uma vítima com dispneia aguda (falta de ar intensa) sem trauma?",
      options: [
        { text: "Posição de Fowler (sentada ou semi-sentada com tronco a 45°-90° e apoio lombar), nunca deitada na horizontal.", isCorrect: true },
        { text: "Deitada de costas com as pernas mais altas que a cabeça (Trendelenburg).", isCorrect: false },
        { text: "Deitada de bruços sobre o chão frio.", isCorrect: false }
      ],
      explanation: "A posição sentada/semi-sentada reduz o retorno venoso, alivia a congestão pulmonar e melhora a excursão do diafragma."
    },
    {
      question: "Qual é a sequência cronológica correta dos princípios gerais do socorrismo no Protocolo P.A.S.?",
      options: [
        { text: "P - Prevenir/Proteger (segurança do cenário e EPI), A - Alertar (112) e S - Socorrer.", isCorrect: true },
        { text: "Socorrer primeiro, Alertar depois e Prevenir no fim.", isCorrect: false },
        { text: "Alertar 112, Socorrer a correr e só depois verificar perigos no local.", isCorrect: false }
      ],
      explanation: "A segurança do socorrista e do cenário (P) antecede sempre o alerta (A) e as manobras de socorro direto (S)."
    },
    {
      question: "Perante um lactente (< 1 ano) com asfixia grave (tosse ineficaz), qual é a conduta correta de desobstrução (Diretrizes ERC 2025)?",
      options: [
        { text: "5 pancadas interescapulares em plano declive alternadas com 5 compressões torácicas; a manobra de Heimlich está estritamente proibida.", isCorrect: true },
        { text: "Manobra de Heimlich imediata com compressões abdominais violentas.", isCorrect: false },
        { text: "Colocar o dedo em gancho às cegas na garganta para tentar puxar o objeto.", isCorrect: false }
      ],
      explanation: "No lactente, compressões abdominais de Heimlich causam rotura hepática e visceral grave. A sequência oficial é 5 pancadas nas costas + 5 compressões torácicas com 2 dedos."
    },
    {
      question: "No Triângulo de Avaliação Pediátrica (TAP), quais são os 3 lados avaliados em 30 a 60 segundos sem tocar na criança?",
      options: [
        { text: "Aparência (Mnemónica TICOS), Trabalho Respiratório e Circulação Cutânea.", isCorrect: true },
        { text: "Alimentação, Peso e Altura.", isCorrect: false },
        { text: "Temperatura, Reflexos e Pressão Arterial.", isCorrect: false }
      ],
      explanation: "O TAP é uma ferramenta de impressão geral rápida (30-60 seg) baseada na Aparência (SNC), Trabalho Respiratório e Circulação Cutânea."
    },
    {
      question: "No Suporte Básico de Vida (SBV) Pediátrico segundo as diretrizes oficiais ERC 2025, qual é o primeiro passo obrigatório após confirmar a ausência de respiração?",
      options: [
        { text: "Realizar obrigatoriamente 5 insuflações iniciais de resgate antes das compressões torácicas.", isCorrect: true },
        { text: "Iniciar imediatamente 30 compressões torácicas sem ventilações.", isCorrect: false },
        { text: "Aplicar imediatamente um choque com o DAE antes de qualquer manobra.", isCorrect: false }
      ],
      explanation: "Nas crianças e lactentes, a paragem é primordialmente hipóxica (respiratória); 5 insuflações de resgate fornecem oxigenação crítica imediata."
    }
  ];

  let currentQuizState = {
    selectedQuestions: [],
    answeredCount: 0,
    score: 0,
    total: 5
  };

  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function initDynamicQuiz() {
    const container = document.getElementById('quiz-dynamic-container');
    const scoreBadge = document.getElementById('quiz-score-badge');
    const summaryBox = document.getElementById('quiz-summary-box');
    if (!container) return;

    // Reset state
    const shuffledBank = shuffleArray(QUIZ_BANK);
    currentQuizState.total = 5;
    currentQuizState.selectedQuestions = shuffledBank.slice(0, currentQuizState.total);
    currentQuizState.answeredCount = 0;
    currentQuizState.score = 0;

    if (scoreBadge) {
      scoreBadge.textContent = `0 de ${currentQuizState.total} respondidas • Acertos: 0`;
      scoreBadge.className = 'text-[11px] text-sky-400 font-semibold';
    }
    if (summaryBox) summaryBox.classList.add('hidden');

    container.innerHTML = '';

    currentQuizState.selectedQuestions.forEach((qObj, qIndex) => {
      const card = document.createElement('div');
      card.className = 'quiz-card';

      const questionTitle = document.createElement('div');
      questionTitle.className = 'quiz-question';
      questionTitle.textContent = `${qIndex + 1}. ${qObj.question}`;
      card.appendChild(questionTitle);

      const shuffledOptions = shuffleArray(qObj.options);
      shuffledOptions.forEach((opt, optIndex) => {
        const letter = String.fromCharCode(65 + optIndex);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option-btn';
        btn.textContent = `${letter}) ${opt.text}`;
        btn.addEventListener('click', () => {
          handleQuizAnswer(btn, card, opt.isCorrect, qObj.explanation);
        });
        card.appendChild(btn);
      });

      const feedback = document.createElement('div');
      feedback.className = 'quiz-feedback hidden';
      card.appendChild(feedback);

      container.appendChild(card);
    });
  }

  function handleQuizAnswer(selectedBtn, card, isCorrect, explanation) {
    const allBtns = card.querySelectorAll('.quiz-option-btn');
    const feedbackBox = card.querySelector('.quiz-feedback');
    if (!allBtns.length || !feedbackBox) return;

    allBtns.forEach(btn => {
      btn.disabled = true;
    });

    if (isCorrect) {
      selectedBtn.classList.add('correct');
      feedbackBox.innerHTML = `<strong>✔ Resposta Correta!</strong> ${explanation}`;
      feedbackBox.className = 'quiz-feedback bg-emerald-950/80 border border-emerald-500 text-emerald-200';
      currentQuizState.score++;
    } else {
      selectedBtn.classList.add('wrong');
      feedbackBox.innerHTML = `<strong>❌ Incorreto.</strong> ${explanation}`;
      feedbackBox.className = 'quiz-feedback bg-red-950/80 border border-red-500 text-red-200';
    }
    feedbackBox.classList.remove('hidden');

    currentQuizState.answeredCount++;
    const scoreBadge = document.getElementById('quiz-score-badge');
    if (scoreBadge) {
      scoreBadge.textContent = `${currentQuizState.answeredCount} de ${currentQuizState.total} respondidas • Acertos: ${currentQuizState.score}`;
    }

    if (currentQuizState.answeredCount >= currentQuizState.total) {
      showQuizSummary();
    }
  }

  function showQuizSummary() {
    const summaryBox = document.getElementById('quiz-summary-box');
    const summaryScore = document.getElementById('quiz-summary-score');
    const summaryMsg = document.getElementById('quiz-summary-msg');
    if (!summaryBox || !summaryScore || !summaryMsg) return;

    const { score, total } = currentQuizState;
    summaryScore.textContent = `Pontuação Final: ${score} em ${total} Acertos (${Math.round((score / total) * 100)}%)`;

    if (score === total) {
      summaryBox.className = 'mt-4 p-4 rounded-xl text-center border bg-emerald-950/80 border-emerald-500 text-emerald-200';
      summaryMsg.textContent = '🏆 Desempenho Impecável! Domina com precisão os algoritmos e procedimentos de socorrismo.';
    } else if (score >= 4) {
      summaryBox.className = 'mt-4 p-4 rounded-xl text-center border bg-sky-950/80 border-sky-500 text-sky-200';
      summaryMsg.textContent = '👏 Excelente resultado! Demonstra sólida preparação técnica nos protocolos essenciais.';
    } else if (score >= 3) {
      summaryBox.className = 'mt-4 p-4 rounded-xl text-center border bg-amber-950/80 border-amber-500 text-amber-200';
      summaryMsg.textContent = '👍 Bom esforço! Recomendamos a releitura dos pontos errados no manual de autoestudo.';
    } else {
      summaryBox.className = 'mt-4 p-4 rounded-xl text-center border bg-red-950/80 border-red-500 text-red-200';
      summaryMsg.textContent = '⚠️ Sugerimos rever com atenção os capítulos de SBV, OVA e Hemorragias antes de repetir.';
    }

    summaryBox.classList.remove('hidden');
  }

  window.checkQuizAnswer = handleQuizAnswer;

  const btnReloadQuiz = document.getElementById('btn-reload-quiz');
  if (btnReloadQuiz) {
    btnReloadQuiz.addEventListener('click', initDynamicQuiz);
  }

  const btnSummaryRestart = document.getElementById('btn-summary-restart');
  if (btnSummaryRestart) {
    btnSummaryRestart.addEventListener('click', initDynamicQuiz);
  }

  // Inicializar quiz dinâmico
  initDynamicQuiz();

  // ========================================================
  // MÓDULO 1: SBV & DAE (ADULTO VS PEDIÁTRICO APRIMORADO)
  // ========================================================
  const btnStartSBV = document.getElementById('btn-sbv-start');
  const btnPauseSBV = document.getElementById('btn-sbv-pause');
  const btnResetSBV = document.getElementById('btn-sbv-reset');
  const labelBeats = document.getElementById('sbv-beats-count');
  const labelCycles = document.getElementById('sbv-cycles-count');
  const labelTime = document.getElementById('sbv-time-count');
  const alertRotation = document.getElementById('sbv-rotation-alert');

  const btnSelectAdult = document.getElementById('pedia-select-adult');
  const btnSelectChild = document.getElementById('pedia-select-child');
  const pediaBanner = document.getElementById('pedia-active-banner');
  const sbvInstructionBox = document.getElementById('sbv-dynamic-instructions');
  const sbvCaptionStep4 = document.getElementById('sbv-step4-caption');

  function setPediatricMode(isPediatric) {
    AppState.isAdult = !isPediatric;
    btnSelectAdult.classList.toggle('active', !isPediatric);
    btnSelectChild.classList.toggle('active', isPediatric);
    btnSelectChild.classList.toggle('is-pedia', isPediatric);
    
    if (pediaBanner) pediaBanner.classList.toggle('hidden', !isPediatric);

    if (isPediatric) {
      if (sbvInstructionBox) {
        sbvInstructionBox.innerHTML = `
          <div class="p-3 bg-emerald-950/70 border-2 border-emerald-500 rounded-xl mb-3">
            <span class="text-xs uppercase font-black text-emerald-400 block mb-1">🚨 PROTOCOLO PEDIÁTRICO (CRIANÇAS E BEBÉS):</span>
            <p class="large-instruction-text text-yellow-300 mb-2">1. INICIE COM 5 INSUFLAÇÕES DE RESGATE SUAVES!</p>
            <p class="text-xs text-slate-200 leading-relaxed">
              No paciente pediátrico a causa é quase sempre <strong>respiratória</strong> (asfixia/falta de oxigénio). Se a criança não reagir às 5 insuflações, inicie de imediato compressões.
            </p>
          </div>
          <div class="space-y-2 text-xs">
            <div class="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
              <strong class="text-emerald-300 block text-sm">CRIANÇA (1 ano até puberdade):</strong>
              <p class="text-slate-200 mt-0.5">Comprima com <strong>1 mão</strong> (ou 2 se necessário) na metade inferior do esterno. Afunde cerca de <strong>4 a 5 cm</strong>. Rácio: <strong>15 compressões : 2 insuflações</strong>.</p>
            </div>
            <div class="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
              <strong class="text-emerald-300 block text-sm">LACTENTE / BEBÉ (&lt; 1 ano):</strong>
              <p class="text-slate-200 mt-0.5">Cabeça em <strong>posição neutra</strong> (não estender o pescoço!). Comprima com <strong>2 dedos</strong> (ou dois polegares abraçando o peito) no terço inferior do esterno. Afunde cerca de <strong>4 cm</strong>. Rácio: <strong>15:2</strong>.</p>
            </div>
          </div>
        `;
      }
      if (sbvCaptionStep4) sbvCaptionStep4.textContent = 'Compressão Pediátrica: 1 mão (criança) ou 2 dedos (bebé), 15:2';
      AudioManager.speak('Modo pediátrico ativado. Inicie com cinco insuflações de resgate. Siga o rácio de quinze compressões para duas insuflações.');
    } else {
      if (sbvInstructionBox) {
        sbvInstructionBox.innerHTML = `
          <div class="p-3 bg-slate-900 border border-slate-700 rounded-xl mb-3 text-xs">
            <span class="text-xs uppercase font-bold text-slate-400 block mb-1">PROTOCOLO ADULTO (ERC / INEM):</span>
            <p class="large-instruction-text text-white mb-1">Compressões Torácicas Contínuas a 110 bpm</p>
            <p class="text-slate-300">Profundidade de 5 a 6 cm no centro do esterno com descompressão torácica completa. Rácio de 30:2 ou compressões contínuas se leigo sem máscara.</p>
          </div>
        `;
      }
      if (sbvCaptionStep4) sbvCaptionStep4.textContent = '4. Compressões no centro do peito: 5 a 6 cm de profundidade';
    }
  }

  if (btnSelectAdult && btnSelectChild) {
    btnSelectAdult.addEventListener('click', () => setPediatricMode(false));
    btnSelectChild.addEventListener('click', () => setPediatricMode(true));
  }

  const btnMode30_2 = document.getElementById('btn-mode-30-2');
  const btnModeContinuous = document.getElementById('btn-mode-continuous');
  const sbvVentilationBanner = document.getElementById('sbv-ventilation-banner');
  const sbvVentilationText = document.getElementById('sbv-ventilation-text');
  const sbvVentilationProgress = document.getElementById('sbv-ventilation-progress');

  function setSBVRatioMode(mode) {
    AppState.ratioMode = mode;
    const cycleSize = AppState.isAdult ? 30 : 15;
    if (mode === '30_2') {
      if (btnMode30_2) {
        btnMode30_2.className = 'py-1.5 px-2 rounded-lg bg-yellow-400 text-slate-950 font-bold transition flex items-center justify-center gap-1 shadow cursor-pointer';
      }
      if (btnModeContinuous) {
        btnModeContinuous.className = 'py-1.5 px-2 rounded-lg bg-transparent text-slate-400 hover:text-white transition flex items-center justify-center gap-1 cursor-pointer';
      }
      if (labelBeats && !AppState.sbvActive) {
        labelBeats.textContent = `0/${cycleSize}`;
      }
    } else {
      if (btnModeContinuous) {
        btnModeContinuous.className = 'py-1.5 px-2 rounded-lg bg-yellow-400 text-slate-950 font-bold transition flex items-center justify-center gap-1 shadow cursor-pointer';
      }
      if (btnMode30_2) {
        btnMode30_2.className = 'py-1.5 px-2 rounded-lg bg-transparent text-slate-400 hover:text-white transition flex items-center justify-center gap-1 cursor-pointer';
      }
      if (labelBeats && !AppState.sbvActive) {
        labelBeats.textContent = '0';
      }
    }
  }

  if (btnMode30_2) btnMode30_2.addEventListener('click', () => setSBVRatioMode('30_2'));
  if (btnModeContinuous) btnModeContinuous.addEventListener('click', () => setSBVRatioMode('continuous'));

  window.onBeatTick = () => {
    AppState.beats++;
    const cycleSize = AppState.isAdult ? 30 : 15;
    const currentInCycle = ((AppState.beats - 1) % cycleSize) + 1;

    if (labelBeats) {
      if (AppState.ratioMode === '30_2') {
        labelBeats.textContent = `${currentInCycle}/${cycleSize}`;
      } else {
        labelBeats.textContent = AppState.beats;
      }
    }

    let isThirty = false;
    if (AppState.beats % cycleSize === 0) {
      AppState.cycles++;
      if (labelCycles) labelCycles.textContent = AppState.cycles;
      isThirty = true;

      // Se estiver em modo 30:2, aciona o protocolo sonoro e visual de insuflações
      if (AppState.ratioMode === '30_2') {
        if (sbvVentilationBanner) {
          sbvVentilationBanner.classList.remove('hidden');
          if (sbvVentilationText) sbvVentilationText.textContent = '🫁 1ª Insuflação... (1 segundo)';
          if (sbvVentilationProgress) sbvVentilationProgress.style.width = '30%';
        }

        AudioManager.triggerVentilation(
          (step) => {
            if (step === 1) {
              if (sbvVentilationText) sbvVentilationText.textContent = '🫁 1ª Insuflação (1 segundo)';
              if (sbvVentilationProgress) sbvVentilationProgress.style.width = '50%';
            } else if (step === 2) {
              if (sbvVentilationText) sbvVentilationText.textContent = '🫁 2ª Insuflação (1 segundo)';
              if (sbvVentilationProgress) sbvVentilationProgress.style.width = '85%';
            } else if (step === 3) {
              if (sbvVentilationText) sbvVentilationText.textContent = '⚡ A retomar compressões!';
              if (sbvVentilationProgress) sbvVentilationProgress.style.width = '100%';
            }
          },
          () => {
            // Retoma automática das compressões
            if (sbvVentilationBanner) sbvVentilationBanner.classList.add('hidden');
            if (labelBeats) labelBeats.textContent = `0/${cycleSize}`;
          }
        );
      }
    }
    return { isThirty };
  };

  function startSBV() {
    AudioManager.initContext();
    AppState.sbvActive = true;
    AudioManager.bpm = 110;
    AudioManager.startMetronome();

    if (btnStartSBV) btnStartSBV.classList.add('hidden');
    if (btnPauseSBV) btnPauseSBV.classList.remove('hidden');

    if (!AppState.timerInterval) {
      AppState.timerInterval = setInterval(() => {
        AppState.secondsElapsed++;
        const mm = String(Math.floor(AppState.secondsElapsed / 60)).padStart(2, '0');
        const ss = String(AppState.secondsElapsed % 60).padStart(2, '0');
        if (labelTime) labelTime.textContent = `${mm}:${ss}`;

        if (AppState.secondsElapsed > 0 && AppState.secondsElapsed % 120 === 0) {
          if (alertRotation) alertRotation.classList.remove('hidden');
          AudioManager.speak('Dois minutos decorridos. Se tiver apoio, troque de reanimador agora sem interromper as compressões.');
        }
      }, 1000);
    }
  }

  function pauseSBV() {
    AppState.sbvActive = false;
    AudioManager.stopMetronome();
    AudioManager.cancelVentilation();
    if (sbvVentilationBanner) sbvVentilationBanner.classList.add('hidden');
    if (btnStartSBV) btnStartSBV.classList.remove('hidden');
    if (btnPauseSBV) btnPauseSBV.classList.add('hidden');
    if (AppState.timerInterval) {
      clearInterval(AppState.timerInterval);
      AppState.timerInterval = null;
    }
  }

  function resetSBV() {
    pauseSBV();
    AppState.beats = 0;
    AppState.cycles = 0;
    AppState.secondsElapsed = 0;
    const cycleSize = AppState.isAdult ? 30 : 15;
    if (labelBeats) labelBeats.textContent = (AppState.ratioMode === '30_2') ? `0/${cycleSize}` : '0';
    if (labelCycles) labelCycles.textContent = '0';
    if (labelTime) labelTime.textContent = '00:00';
    if (alertRotation) alertRotation.classList.add('hidden');
  }

  if (btnStartSBV) btnStartSBV.addEventListener('click', startSBV);
  if (btnPauseSBV) btnPauseSBV.addEventListener('click', pauseSBV);
  if (btnResetSBV) btnResetSBV.addEventListener('click', resetSBV);

  const btnTriggerPCR = document.getElementById('trigger-pcr-now');
  if (btnTriggerPCR) {
    btnTriggerPCR.addEventListener('click', () => {
      AudioManager.initContext();
      navigateTo('screen-sbv');
      startSBV();
    });
  }

  window.dismissRotationAlert = () => {
    if (alertRotation) alertRotation.classList.add('hidden');
  };

  // ========================================================
  // MÓDULO 2: TRAUMA & HEMORRAGIAS
  // ========================================================
  const btnStartTourniquet = document.getElementById('btn-tourniquet-start');
  const displayTourniquet = document.getElementById('tourniquet-timer-val');
  const labelTourniquetApplied = document.getElementById('tourniquet-time-applied');

  if (btnStartTourniquet) {
    btnStartTourniquet.addEventListener('click', () => {
      if (!AppState.tourniquetStartTime) {
        AppState.tourniquetStartTime = new Date();
        const timeStr = AppState.tourniquetStartTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        if (labelTourniquetApplied) labelTourniquetApplied.textContent = `Aplicado às: ${timeStr}`;
        btnStartTourniquet.textContent = '⏹ Parar / Registar Hora Final';
        btnStartTourniquet.classList.replace('bg-amber-600', 'bg-red-700');

        let elapsedMinutes = 0;
        AppState.tourniquetInterval = setInterval(() => {
          elapsedMinutes++;
          if (displayTourniquet) displayTourniquet.textContent = `${elapsedMinutes} min`;
          if (elapsedMinutes % 30 === 0) {
            AudioManager.speak(`Atenção. O garrote está colocado há ${elapsedMinutes} minutos. Nunca alivie o garrote.`);
          }
        }, 60000);

        AudioManager.speak('Garrote aplicado. Hora registada. Nunca alivie o garrote até à chegada do socorro.');
      } else {
        clearInterval(AppState.tourniquetInterval);
        AppState.tourniquetStartTime = null;
        btnStartTourniquet.textContent = '⏱ Registar Aplicação de Garrote';
        btnStartTourniquet.classList.replace('bg-red-700', 'bg-amber-600');
      }
    });
  }

  // QUEIMADURAS (15 MINUTOS DE ÁGUA TÉPIDA)
  const btnStartBurn = document.getElementById('btn-burn-timer');
  const displayBurn = document.getElementById('burn-timer-val');

  if (btnStartBurn) {
    btnStartBurn.addEventListener('click', () => {
      if (!AppState.burnInterval) {
        btnStartBurn.textContent = '⏹ Parar Arrefecimento';
        AppState.burnInterval = setInterval(() => {
          AppState.burnTimerSeconds--;
          const mm = String(Math.floor(AppState.burnTimerSeconds / 60)).padStart(2, '0');
          const ss = String(AppState.burnTimerSeconds % 60).padStart(2, '0');
          if (displayBurn) displayBurn.textContent = `${mm}:${ss}`;

          if (AppState.burnTimerSeconds <= 0) {
            clearInterval(AppState.burnInterval);
            AppState.burnInterval = null;
            AudioManager.speak('15 minutos concluídos. Cubra a queimadura com compressas esterilizadas húmidas e proteja contra a hipotermia.');
          }
        }, 1000);
        AudioManager.speak('Inicie o arrefecimento contínuo com água corrente tépida durante 15 minutos.');
      } else {
        clearInterval(AppState.burnInterval);
        AppState.burnInterval = null;
        btnStartBurn.textContent = '▶ Iniciar 15 Min de Água Corrente';
      }
    });
  }

  // ========================================================
  // MÓDULO 3: AVC & CONVULSÕES
  // ========================================================
  const btnStrokeNow = document.getElementById('btn-stroke-mark-time');
  const labelStrokeTime = document.getElementById('stroke-onset-display');

  if (btnStrokeNow) {
    btnStrokeNow.addEventListener('click', () => {
      AppState.strokeOnsetTime = new Date();
      const str = AppState.strokeOnsetTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      if (labelStrokeTime) labelStrokeTime.textContent = `Início dos Sintomas: ${str} (Transmitir ao 112 para Via Verde)`;
      AudioManager.speak(`Hora de início registada às ${str}. Ligue 112 de imediato e refira suspeita de AVC.`);
    });
  }

  const btnSeizure = document.getElementById('btn-seizure-timer');
  const displaySeizure = document.getElementById('seizure-timer-val');

  if (btnSeizure) {
    btnSeizure.addEventListener('click', () => {
      if (!AppState.seizureInterval) {
        AppState.seizureSeconds = 0;
        btnSeizure.textContent = '⏹ Fim da Crise / Vítima Parou';
        AppState.seizureInterval = setInterval(() => {
          AppState.seizureSeconds++;
          const mm = String(Math.floor(AppState.seizureSeconds / 60)).padStart(2, '0');
          const ss = String(AppState.seizureSeconds % 60).padStart(2, '0');
          if (displaySeizure) displaySeizure.textContent = `${mm}:${ss}`;
        }, 1000);
        AudioManager.speak('A cronometrar crise. Proteja a cabeça e nunca coloque nada na boca.');
      } else {
        clearInterval(AppState.seizureInterval);
        AppState.seizureInterval = null;
        btnSeizure.textContent = '▶ Iniciar Contagem da Crise';
        AudioManager.speak('Crise terminada. Coloque a vítima em Posição Lateral de Segurança e mantenha a via aérea limpa.');
      }
    });
  }

  // ========================================================
  // MÓDULO 4: ASSISTENTE IA (GEMINI VISION)
  // ========================================================
  const aiFileInput = document.getElementById('ai-file-input');
  const aiTextPrompt = document.getElementById('ai-text-prompt');
  const btnAskAI = document.getElementById('btn-ask-ai');
  const aiResponseBox = document.getElementById('ai-response-box');
  const aiLoading = document.getElementById('ai-loading');
  const imgPreview = document.getElementById('ai-img-preview');
  const aiImgWrapper = document.getElementById('ai-img-wrapper');
  const btnRemoveAiImg = document.getElementById('btn-remove-ai-img');
  const btnClearAI = document.getElementById('btn-clear-ai');
  const btnClearResults = document.getElementById('btn-clear-ai-results');

  let currentImageBase64 = null;

  if (aiFileInput) {
    aiFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const fullDataUrl = event.target.result;
          currentImageBase64 = fullDataUrl.split(',')[1];
          if (imgPreview) {
            imgPreview.src = fullDataUrl;
          }
          if (aiImgWrapper) {
            aiImgWrapper.classList.remove('hidden');
          } else if (imgPreview) {
            imgPreview.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (btnRemoveAiImg) {
    btnRemoveAiImg.addEventListener('click', () => {
      currentImageBase64 = null;
      if (aiFileInput) aiFileInput.value = '';
      if (imgPreview) imgPreview.src = '';
      if (aiImgWrapper) {
        aiImgWrapper.classList.add('hidden');
      } else if (imgPreview) {
        imgPreview.classList.add('hidden');
      }
    });
  }

  function escapeTriageHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatAIMarkdown(rawText) {
    if (!rawText) return '';
    const lines = rawText.split('\n');
    let formattedHtml = '';
    let inList = false;

    lines.forEach(line => {
      let clean = line.trim();
      if (!clean) {
        if (inList) { formattedHtml += '</ul>'; inList = false; }
        return;
      }

      if (clean.includes('Modo de Contingência')) {
        formattedHtml += `<div class="p-2 mb-2 bg-amber-950/60 border border-amber-500 rounded-lg text-amber-300 text-xs font-semibold leading-relaxed">${clean.replace(/\*\*/g, '')}</div>`;
        return;
      }

      if (/^[1-5]\.\s+.*(DESPISTE|AFUNILAMENTO)/i.test(clean)) {
        if (inList) { formattedHtml += '</ul>'; inList = false; }
        clean = clean.replace(/\*\*/g, '');
        formattedHtml += `<div class="mt-3 mb-1 text-purple-400 font-black text-sm flex items-center gap-1.5 border-b border-purple-800/60 pb-1">❓ Afunilamento de Triagem (Sinais de Gravidade):</div>`;
        return;
      }

      if (/^[1-4]\.\s+.*DIAGNÓSTICO/i.test(clean)) {
        if (inList) { formattedHtml += '</ul>'; inList = false; }
        clean = clean.replace(/\*\*/g, '');
        formattedHtml += `<div class="mt-3 mb-1 text-sky-400 font-black text-sm flex items-center gap-1.5 border-b border-sky-800/60 pb-1">${clean}</div>`;
        return;
      }
      if (/^[1-4]\.\s+.*AÇÃO IMEDIATA/i.test(clean)) {
        if (inList) { formattedHtml += '</ul>'; inList = false; }
        clean = clean.replace(/\*\*/g, '');
        formattedHtml += `<div class="mt-3 mb-1 text-emerald-400 font-black text-sm flex items-center gap-1.5 border-b border-emerald-800/60 pb-1">${clean}</div>`;
        return;
      }
      if (/^[1-4]\.\s+.*PROIBIÇÕES/i.test(clean)) {
        if (inList) { formattedHtml += '</ul>'; inList = false; }
        clean = clean.replace(/\*\*/g, '');
        formattedHtml += `<div class="mt-3 mb-1 text-red-400 font-black text-sm flex items-center gap-1.5 border-b border-red-800/60 pb-1">${clean}</div>`;
        return;
      }
      if (/^[1-4]\.\s+.*(CONDUTA|ENCAMINHAMENTO)/i.test(clean)) {
        if (inList) { formattedHtml += '</ul>'; inList = false; }
        clean = clean.replace(/\*\*/g, '');
        formattedHtml += `<div class="mt-3 mb-1 text-amber-400 font-black text-sm flex items-center gap-1.5 border-b border-amber-800/60 pb-1">${clean}</div>`;
        return;
      }

      // Afunilamento de Triagem: Perguntas Atómicas Sim/Não ou Múltipla Escolha Discriminada de Sintomas
      const cleanNoBold = clean.replace(/\*\*/g, '');
      const hasOptions = /Opções:\s*\[(.*?)\]/i.test(cleanNoBold) || (/\[(.*?)\]/.test(cleanNoBold) && cleanNoBold.includes('|'));

      if (hasOptions) {
        if (inList) { formattedHtml += '</ul>'; inList = false; }

        let questionText = '';
        let options = [];

        const opcMatch = cleanNoBold.match(/Opções:\s*\[(.*?)\]/i);
        if (opcMatch) {
          options = opcMatch[1].split('|').map(s => s.trim()).filter(Boolean);
          questionText = cleanNoBold.substring(0, opcMatch.index)
            .replace(/^[-*•]?\s*(Pergunta:\s*)?/i, '')
            .trim();
        } else {
          const bracketMatch = cleanNoBold.match(/\[(.*?)\]/);
          if (bracketMatch && bracketMatch[1].includes('|')) {
            options = bracketMatch[1].split('|').map(s => s.trim()).filter(Boolean);
            questionText = cleanNoBold.replace(bracketMatch[0], '')
              .replace(/^[-*•]?\s*(Pergunta:\s*)?/i, '')
              .replace(/Opções:?/i, '')
              .trim();
          }
        }

        questionText = questionText.replace(/^[:\-\s]+/, '').trim();
        if (!questionText) questionText = 'Identifique os sinais ou sintomas da vítima:';

        // Modalidade A: Pergunta atómica binária Sim / Não
        const isBinarySimNao = options.length === 2 &&
          options.some(o => /^sim$/i.test(o)) &&
          options.some(o => /^não$|^nao$/i.test(o));

        const triageGroupId = 'triage-grp-' + Math.random().toString(36).substring(2, 9);

        if (isBinarySimNao) {
          formattedHtml += `
            <div class="my-2.5 p-3 bg-slate-900/90 border border-amber-500/40 rounded-xl shadow-sm">
              <div class="flex items-start gap-1.5 mb-2">
                <span class="text-amber-400 text-xs">❓</span>
                <p class="text-xs text-yellow-200 font-semibold leading-snug">${escapeTriageHtml(questionText)}</p>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="triage-quick-chip flex-1 py-2 px-3 bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-600 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95" data-resp="Sim (Confirma: ${escapeTriageHtml(questionText)})">
                  <span>✅</span> Sim
                </button>
                <button type="button" class="triage-quick-chip flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95" data-resp="Não (Nega: ${escapeTriageHtml(questionText)})">
                  <span>❌</span> Não
                </button>
              </div>
            </div>
          `;
          return;
        }

        // Modalidade B: Seleção discriminada de sintomas e sinais simultâneos
        let chipsHtml = '';
        options.forEach(opt => {
          const isNone = /nenhum|nenhuma|nada|não sei|nenhum destes|nenhum dos anteriores/i.test(opt);
          if (isNone) {
            chipsHtml += `
              <button type="button" 
                class="triage-none-chip w-full text-left py-2 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600/70 rounded-lg text-xs font-semibold transition flex items-center justify-between active:scale-[0.99]"
                data-resp="Nenhum destes sinais (Nega todos os sintomas de: ${escapeTriageHtml(questionText)})">
                <span class="flex items-center gap-2"><span>⚪</span> ${escapeTriageHtml(opt)}</span>
                <span class="text-[10px] bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Toque rápido</span>
              </button>
            `;
          } else {
            chipsHtml += `
              <button type="button" 
                class="triage-symptom-chip w-full text-left py-2 px-3 bg-slate-950/70 hover:bg-slate-800/80 text-slate-200 border border-slate-700 rounded-lg text-xs transition flex items-center gap-2.5 active:scale-[0.99]"
                data-val="${escapeTriageHtml(opt)}">
                <span class="chip-check w-4 h-4 rounded border border-slate-600 bg-slate-900 flex items-center justify-center text-[10px] text-transparent font-black shrink-0 transition">✓</span>
                <span class="chip-label flex-1 font-medium leading-snug">${escapeTriageHtml(opt)}</span>
              </button>
            `;
          }
        });

        formattedHtml += `
          <div id="${triageGroupId}" class="triage-multiselect-group my-3 p-3 bg-slate-900/90 border border-amber-500/50 rounded-xl shadow-md" data-question="${escapeTriageHtml(questionText)}">
            <div class="flex items-start gap-2 mb-2">
              <span class="text-amber-400 text-sm">📋</span>
              <div>
                <p class="text-xs text-yellow-200 font-bold leading-snug">${escapeTriageHtml(questionText)}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Pode selecionar um ou vários sintomas simultâneos, ou tocar em "Nenhum":</p>
              </div>
            </div>
            <div class="space-y-1.5 my-2">
              ${chipsHtml}
            </div>
            <div class="mt-2 pt-2 border-t border-slate-800 flex items-center justify-end">
              <button type="button" 
                class="btn-confirm-symptoms w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black transition disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-1.5 shadow-md" disabled>
                <span>Confirmar Sintomas Selecionados</span>
                <span class="font-mono">➔</span>
              </button>
            </div>
          </div>
        `;
        return;
      }

      let parsedLine = clean.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
      parsedLine = parsedLine.replace(/\*([^\*]+)\*/g, '<em class="text-slate-200">$1</em>');
      parsedLine = parsedLine.replace(/\[Fonte:\s*([^\]]+)\]/gi, '<span class="bg-sky-950/90 text-sky-300 border border-sky-500/70 text-[10px] font-mono px-2 py-0.5 rounded-full inline-block my-0.5 shadow-sm">📖 Fonte: $1</span>');

      if (parsedLine.startsWith('- ') || parsedLine.startsWith('• ') || parsedLine.startsWith('* ')) {
        if (!inList) {
          formattedHtml += '<ul class="space-y-1 my-1 pl-4 list-disc text-slate-300 text-xs">';
          inList = true;
        }
        formattedHtml += `<li>${parsedLine.substring(2)}</li>`;
      } else {
        if (inList) { formattedHtml += '</ul>'; inList = false; }
        formattedHtml += `<p class="text-xs text-slate-200 my-1 leading-relaxed">${parsedLine}</p>`;
      }
    });

    if (inList) formattedHtml += '</ul>';

    // Raciocínio Clínico de Triagem: Selecionar o canal e botão de contacto correto (112 vs SNS 24 vs CIAV)
    const diagMatch = rawText.match(/1\.\s+.*?DIAGNÓSTICO.*?(?:\n|$)(.*?)(?:\n2\.|$)/is);
    const diagSection = diagMatch ? diagMatch[0] : rawText.substring(0, 350);

    const isCritical = (/🔴|EMERGÊNCIA CRÍTICA/i.test(diagSection)) && !(/URGÊNCIA MODERADA|SITUAÇÃO LIGEIRA/i.test(diagSection));
    const isModerateOrMild = (/🟡|URGÊNCIA MODERADA|🟢|SITUAÇÃO LIGEIRA/i.test(diagSection)) || (/SNS 24|Saúde 24|808\s*24\s*24\s*24/i.test(rawText));
    const mentionsCIAV = /CIAV|800\s*250\s*250|antivenenos/i.test(rawText);

    if (isCritical) {
      formattedHtml += `
        <div class="mt-4 pt-3 border-t border-red-500/40">
          <a href="tel:112" class="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-center text-sm rounded-xl shadow-lg shadow-red-900/60 flex items-center justify-center gap-2 animate-pulse">
            <span>🚨</span> LIGAR 112 AGORA (Emergência Médica INEM)
          </a>
        </div>
      `;
    } else if (isModerateOrMild) {
      formattedHtml += `
        <div class="mt-4 pt-3 border-t border-emerald-500/40 space-y-2">
          <div class="p-2.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-emerald-200 text-xs flex items-start gap-2">
            <span class="text-base">🟢</span>
            <div>
              <strong class="text-emerald-300 block mb-0.5">Sem Critérios de Emergência Vital (112):</strong>
              Para preservar os meios de socorro do INEM, a triagem não urgente e encaminhamento médico são efetuados pela <strong>Linha SNS 24 (808 24 24 24)</strong>.
            </div>
          </div>
          <a href="tel:808242424" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-center text-sm rounded-xl shadow-lg shadow-emerald-900/60 flex items-center justify-center gap-2">
            <span>📞</span> LIGAR LINHA SNS 24 (808 24 24 24)
          </a>
        </div>
      `;
    }

    if (mentionsCIAV) {
      formattedHtml += `
        <div class="mt-2">
          <a href="tel:800250250" class="w-full py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-bold text-center text-xs rounded-xl shadow-md flex items-center justify-center gap-2">
            <span>🧪</span> LIGAR CIAV (800 250 250 - Antivenenos)
          </a>
        </div>
      `;
    }

    // ACOMPANHAMENTO CLÍNICO & FOLLOW-UP (TEMPORIZADOR + REAVALIAÇÃO DE SINTOMAS)
    const suggestsWaiting = /(aguard|esper|repous|vigia|monitoriz|repouso|minutos|min\b)/i.test(rawText) || isModerateOrMild;

    if (suggestsWaiting && !isCritical) {
      let defaultMins = 10;
      if (/15\s*(minutos|min)/i.test(rawText)) defaultMins = 15;
      else if (/20\s*(minutos|min)/i.test(rawText)) defaultMins = 20;
      else if (/5\s*(minutos|min)/i.test(rawText)) defaultMins = 5;

      formattedHtml += `
        <div class="mt-4 p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/50 rounded-2xl shadow-lg" id="triage-followup-card">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">⏱️</span>
              <div>
                <strong class="text-xs text-white block font-bold">Acompanhamento &amp; Reavaliação Clínica</strong>
                <p class="text-[11px] text-indigo-200">Recomendado aguardar e vigiar a evolução dos sintomas.</p>
              </div>
            </div>
            <span class="text-[10px] text-indigo-300 font-bold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-700/60" id="followup-badge">Em Espera</span>
          </div>

          <!-- CONTROLOS DO TEMPORIZADOR -->
          <div id="followup-timer-section" class="my-2.5 p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-center">
            <div class="text-[11px] text-slate-400 mb-1">Tempo de Observação &amp; Repouso:</div>
            <div class="text-3xl font-black font-mono text-yellow-400 mb-2 tracking-wider" id="followup-timer-display" data-seconds="${defaultMins * 60}">
              ${String(defaultMins).padStart(2, '0')}:00
            </div>
            
            <div class="flex items-center justify-center gap-2">
              <button type="button" id="btn-start-followup-timer" class="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow cursor-pointer transition">
                <span>▶️</span> <span id="label-start-timer">Iniciar Temporizador</span>
              </button>
              <button type="button" id="btn-skip-to-reassess" class="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 cursor-pointer transition">
                <span>⏩</span> Reavaliar Já
              </button>
            </div>

            <!-- PRESETS DE TEMPO -->
            <div class="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              <span>Duração:</span>
              <button type="button" class="btn-time-preset px-2 py-0.5 rounded ${defaultMins === 5 ? 'bg-sky-950 text-sky-200 border border-sky-600' : 'bg-slate-900 text-sky-300 border border-slate-700'}" data-mins="5">5 min</button>
              <button type="button" class="btn-time-preset px-2 py-0.5 rounded ${defaultMins === 10 ? 'bg-sky-950 text-sky-200 border border-sky-600' : 'bg-slate-900 text-sky-300 border border-slate-700'}" data-mins="10">10 min</button>
              <button type="button" class="btn-time-preset px-2 py-0.5 rounded ${defaultMins === 15 ? 'bg-sky-950 text-sky-200 border border-sky-600' : 'bg-slate-900 text-sky-300 border border-slate-700'}" data-mins="15">15 min</button>
              <button type="button" class="btn-time-preset px-2 py-0.5 rounded ${defaultMins === 20 ? 'bg-sky-950 text-sky-200 border border-sky-600' : 'bg-slate-900 text-sky-300 border border-slate-700'}" data-mins="20">20 min</button>
            </div>
          </div>

          <!-- QUESTIONÁRIO DE REAVALIAÇÃO CLÍNICA -->
          <div id="followup-questionnaire" class="hidden my-2 p-3 bg-slate-950 border border-indigo-500/70 rounded-xl space-y-2">
            <div class="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
              <span>🔔</span> <span>Reavaliação dos Sintomas: Como se encontra a vítima?</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              Decorrido o período de observação e repouso, indique a evolução dos sintomas:
            </p>

            <div class="space-y-1.5">
              <button type="button" class="btn-followup-option w-full py-2 px-2.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/60 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition" data-outcome="improved">
                <span>🟢 Melhorou visivelmente (sintomas aliviaram / respiração calma)</span>
                <span class="text-xs">➔</span>
              </button>
              
              <button type="button" class="btn-followup-option w-full py-2 px-2.5 bg-yellow-950/60 hover:bg-yellow-900 text-yellow-200 border border-yellow-600/60 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition" data-outcome="unchanged">
                <span>🟡 Mantém-se igual (sintomas persistem sem qualquer alívio)</span>
                <span class="text-xs">➔</span>
              </button>

              <button type="button" class="btn-followup-option w-full py-2 px-2.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-600 rounded-xl text-left text-xs font-bold flex items-center justify-between cursor-pointer transition" data-outcome="worsened">
                <span>🔴 Piorou / Novos sinais (prostração, dor forte, falta de ar, desmaio)</span>
                <span class="text-xs">➔</span>
              </button>
            </div>

            <!-- RESPOSTA E CONDUTA DO FOLLOW-UP -->
            <div id="followup-outcome-display" class="hidden mt-3"></div>
          </div>
        </div>
      `;
    }

    return formattedHtml;
  }

  // Função para apagar/limpar a interação e os resultados da IA
  function clearAIInteraction() {
    // 1. Limpar prompt de texto
    if (aiTextPrompt) aiTextPrompt.value = '';

    // 2. Limpar fotografia carregada
    currentImageBase64 = null;
    if (aiFileInput) aiFileInput.value = '';
    if (imgPreview) imgPreview.src = '';
    if (aiImgWrapper) {
      aiImgWrapper.classList.add('hidden');
    } else if (imgPreview) {
      imgPreview.classList.add('hidden');
    }

    // 3. Parar gravação de voz se estiver ativa
    const btnStopVoice = document.getElementById('btn-stop-voice');
    const voiceIndicator = document.getElementById('voice-recording-indicator');
    if (btnStopVoice && voiceIndicator && !voiceIndicator.classList.contains('hidden')) {
      btnStopVoice.click();
    }

    // 4. Cancelar temporizador de follow-up se estiver a correr
    if (followupTimerInterval) {
      clearInterval(followupTimerInterval);
      followupTimerInterval = null;
    }

    // 5. Ocultar estado de loading
    if (aiLoading) aiLoading.classList.add('hidden');

    // 6. Restaurar botão de análise
    if (btnAskAI) {
      btnAskAI.disabled = false;
      btnAskAI.classList.remove('opacity-50', 'pointer-events-none');
      btnAskAI.innerHTML = '<span>🔍</span> <span>Analisar com Diretrizes</span>';
    }

    // 7. Resetar caixa de resposta para o estado inicial
    if (aiResponseBox) {
      aiResponseBox.innerHTML = '<span class="text-slate-500 italic">A análise segura da IA e os passos imediatos serão apresentados aqui.</span>';
    }

    // 8. Ocultar botão secundário de limpar resultados e caixas de partilha
    if (btnClearResults) btnClearResults.classList.add('hidden');

    const aiShareBox = document.getElementById('ai-share-box');
    if (aiShareBox) aiShareBox.classList.add('hidden');

    const modalShareIce = document.getElementById('modal-share-ice');
    if (modalShareIce) modalShareIce.classList.add('hidden');
  }

  if (btnClearAI) {
    btnClearAI.addEventListener('click', clearAIInteraction);
  }

  if (btnClearResults) {
    btnClearResults.addEventListener('click', clearAIInteraction);
  }

  if (btnAskAI) {
    btnAskAI.addEventListener('click', async () => {
      const text = aiTextPrompt.value.trim();
      if (!text && !currentImageBase64) {
        alert('Tire uma foto ou descreva a situação por texto.');
        return;
      }

      if (!AIManager.getApiKey()) {
        alert('Para usar a IA, insira a sua chave gratuita do Google AI Studio.');
        return;
      }

      if (aiLoading) aiLoading.classList.remove('hidden');
      if (btnAskAI) {
        btnAskAI.disabled = true;
        btnAskAI.classList.add('opacity-50', 'pointer-events-none');
        btnAskAI.innerHTML = '<span>⏳</span> <span>A contactar triagem...</span>';
      }
      if (aiResponseBox) {
        aiResponseBox.innerHTML = '<span class="text-yellow-400/80 italic animate-pulse">A analisar com rapidez máxima...</span>';
      }

      try {
        const resultMarkdown = await AIManager.analyzeSymptomOrImage({
          textPrompt: text || 'Analise a imagem e indique as medidas prioritárias de primeiros socorros segundo os protocolos do INEM.',
          imageBase64: currentImageBase64
        });

        if (aiResponseBox) {
          aiResponseBox.innerHTML = formatAIMarkdown(resultMarkdown);
          const aiShareBox = document.getElementById('ai-share-box');
          if (aiShareBox) aiShareBox.classList.remove('hidden');

          if (btnClearResults) btnClearResults.classList.remove('hidden');

          // Inicializar listeners de afunilamento de triagem (chips atómicos e multi-seleção de sintomas)
          initTriageDespisteListeners();

          // Inicializar temporizador e questionário de follow-up
          initFollowupTimerListeners();
        }
      } catch (err) {
        if (aiResponseBox) {
          aiResponseBox.innerHTML = `<span class="text-red-400 font-bold">Erro: ${err.message}. Em dúvida, ligue 112 imediatamente.</span>`;
          if (btnClearResults) btnClearResults.classList.remove('hidden');
        }
      } finally {
        if (aiLoading) aiLoading.classList.add('hidden');
        if (btnAskAI) {
          btnAskAI.disabled = false;
          btnAskAI.classList.remove('opacity-50', 'pointer-events-none');
          btnAskAI.innerHTML = '<span>🔍</span> <span>Analisar com Diretrizes</span>';
        }
      }
    });
  }

  // ========================================================
  // AFUNILAMENTO DE TRIAGEM CLÍNICO (CHIPS ATÓMICOS E MULTI-SINTOMAS)
  // ========================================================
  function initTriageDespisteListeners() {
    if (!aiResponseBox) return;

    // 1. Respostas atómicas binárias rápidas (Sim / Não)
    aiResponseBox.querySelectorAll('.triage-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const resp = chip.dataset.resp;
        aiTextPrompt.value += `\n[Despiste de Triagem: ${resp}]`;
        if (btnAskAI) btnAskAI.click();
      });
    });

    // 2. Exclusão rápida imediata ("Nenhum destes")
    aiResponseBox.querySelectorAll('.triage-none-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const resp = chip.dataset.resp;
        aiTextPrompt.value += `\n[Despiste de Triagem: ${resp}]`;
        if (btnAskAI) btnAskAI.click();
      });
    });

    // 3. Seleção de sintomas com suporte a múltiplos sinais simultâneos
    aiResponseBox.querySelectorAll('.triage-symptom-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const isSelected = chip.classList.toggle('is-selected');
        const checkIcon = chip.querySelector('.chip-check');

        if (isSelected) {
          chip.classList.remove('bg-slate-950/70', 'border-slate-700', 'text-slate-200');
          chip.classList.add('bg-amber-950/60', 'border-amber-400', 'text-amber-200');
          if (checkIcon) {
            checkIcon.classList.remove('bg-slate-900', 'border-slate-600', 'text-transparent');
            checkIcon.classList.add('bg-amber-500', 'border-amber-400', 'text-slate-950');
          }
        } else {
          chip.classList.remove('bg-amber-950/60', 'border-amber-400', 'text-amber-200');
          chip.classList.add('bg-slate-950/70', 'border-slate-700', 'text-slate-200');
          if (checkIcon) {
            checkIcon.classList.remove('bg-amber-500', 'border-amber-400', 'text-slate-950');
            checkIcon.classList.add('bg-slate-900', 'border-slate-600', 'text-transparent');
          }
        }

        // Atualizar estado e contador do botão Confirmar
        const groupEl = chip.closest('.triage-multiselect-group');
        if (groupEl) {
          const selectedChips = groupEl.querySelectorAll('.triage-symptom-chip.is-selected');
          const count = selectedChips.length;
          const confirmBtn = groupEl.querySelector('.btn-confirm-symptoms');
          if (confirmBtn) {
            if (count > 0) {
              confirmBtn.disabled = false;
              confirmBtn.innerHTML = `<span>Confirmar Sintomas Selecionados (${count})</span> <span class="font-mono">➔</span>`;
            } else {
              confirmBtn.disabled = true;
              confirmBtn.innerHTML = `<span>Confirmar Sintomas Selecionados</span> <span class="font-mono">➔</span>`;
            }
          }
        }
      });
    });

    // 4. Submissão dos sintomas simultâneos selecionados
    aiResponseBox.querySelectorAll('.btn-confirm-symptoms').forEach(btn => {
      btn.addEventListener('click', () => {
        const groupEl = btn.closest('.triage-multiselect-group');
        if (!groupEl) return;
        const selectedChips = groupEl.querySelectorAll('.triage-symptom-chip.is-selected');
        if (!selectedChips.length) return;

        const symptoms = Array.from(selectedChips).map(c => c.dataset.val.trim());
        const question = groupEl.dataset.question || 'sintomas avaliados';
        const symptomStr = symptoms.join(' + ');

        aiTextPrompt.value += `\n[Despiste de Triagem: Vítima confirma presença simultânea de: ${symptomStr} (em resposta a: ${question})]`;
        if (btnAskAI) btnAskAI.click();
      });
    });
  }

  // ========================================================
  // LÓGICA DE FOLLOW-UP COM TEMPORIZADOR E REAVALIAÇÃO
  // ========================================================
  let followupTimerInterval = null;
  let followupRemainingSeconds = 600;
  let followupTimerRunning = false;

  function initFollowupTimerListeners() {
    const card = document.getElementById('triage-followup-card');
    if (!card) return;

    const display = document.getElementById('followup-timer-display');
    const btnStart = document.getElementById('btn-start-followup-timer');
    const btnSkip = document.getElementById('btn-skip-to-reassess');
    const badge = document.getElementById('followup-badge');
    const questionnaire = document.getElementById('followup-questionnaire');
    const outcomeDisplay = document.getElementById('followup-outcome-display');
    const presetBtns = card.querySelectorAll('.btn-time-preset');
    const outcomeBtns = card.querySelectorAll('.btn-followup-option');

    if (display) {
      followupRemainingSeconds = parseInt(display.dataset.seconds, 10) || 600;
    }
    followupTimerRunning = false;
    if (followupTimerInterval) {
      clearInterval(followupTimerInterval);
      followupTimerInterval = null;
    }

    function updateDisplay() {
      if (!display) return;
      const mins = Math.floor(followupRemainingSeconds / 60);
      const secs = followupRemainingSeconds % 60;
      display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function finishTimer() {
      if (followupTimerInterval) {
        clearInterval(followupTimerInterval);
        followupTimerInterval = null;
      }
      followupTimerRunning = false;
      if (display) display.textContent = '00:00';
      if (btnStart) {
        btnStart.innerHTML = '<span>✅</span> Concluído';
        btnStart.classList.replace('bg-emerald-600', 'bg-slate-700');
        btnStart.disabled = true;
      }
      if (badge) {
        badge.textContent = '🔔 Reavaliar';
        badge.className = 'text-[10px] text-amber-300 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-600 animate-pulse';
      }
      if (questionnaire) {
        questionnaire.classList.remove('hidden');
        questionnaire.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      if (typeof AudioManager !== 'undefined' && AudioManager.playChime) {
        AudioManager.playChime();
        AudioManager.speak('Tempo de observação concluído. Por favor reavalie os sintomas da vítima.');
      }
    }

    presetBtns.forEach(pBtn => {
      pBtn.addEventListener('click', () => {
        if (followupTimerRunning) return;
        presetBtns.forEach(b => {
          b.classList.remove('bg-sky-950', 'text-sky-200', 'border-sky-600');
          b.classList.add('bg-slate-900', 'text-sky-300', 'border-slate-700');
        });
        pBtn.classList.remove('bg-slate-900', 'text-sky-300', 'border-slate-700');
        pBtn.classList.add('bg-sky-950', 'text-sky-200', 'border-sky-600');

        const m = parseInt(pBtn.dataset.mins, 10) || 10;
        followupRemainingSeconds = m * 60;
        updateDisplay();
      });
    });

    if (btnStart) {
      btnStart.addEventListener('click', () => {
        if (!followupTimerRunning) {
          followupTimerRunning = true;
          btnStart.innerHTML = '<span>⏸️</span> Pausar';
          btnStart.classList.replace('bg-emerald-600', 'bg-amber-600');
          if (badge) {
            badge.textContent = '⏱️ Em Contagem';
            badge.className = 'text-[10px] text-sky-300 font-bold bg-sky-950 px-2 py-0.5 rounded border border-sky-600';
          }
          followupTimerInterval = setInterval(() => {
            if (followupRemainingSeconds > 0) {
              followupRemainingSeconds--;
              updateDisplay();
            } else {
              finishTimer();
            }
          }, 1000);
        } else {
          followupTimerRunning = false;
          if (followupTimerInterval) clearInterval(followupTimerInterval);
          btnStart.innerHTML = '<span>▶️</span> Retomar';
          btnStart.classList.replace('bg-amber-600', 'bg-emerald-600');
          if (badge) badge.textContent = 'Pausa';
        }
      });
    }

    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        finishTimer();
      });
    }

    outcomeBtns.forEach(oBtn => {
      oBtn.addEventListener('click', () => {
        const outcome = oBtn.dataset.outcome;
        outcomeBtns.forEach(b => b.classList.remove('ring-2', 'ring-white'));
        oBtn.classList.add('ring-2', 'ring-white');

        if (!outcomeDisplay) return;
        outcomeDisplay.classList.remove('hidden');

        if (outcome === 'worsened') {
          if (typeof AudioManager !== 'undefined' && AudioManager.playAlarmTone) {
            AudioManager.playAlarmTone();
          }
          outcomeDisplay.innerHTML = `
            <div class="p-3 bg-red-950 border border-red-500 rounded-xl text-red-200 space-y-2">
              <strong class="text-white text-sm block font-black flex items-center gap-1.5">
                <span>🚨</span> AGRAVAMENTO CLÍNICO: LIGAR 112 DE IMEDIATO!
              </strong>
              <p class="text-[11px] leading-relaxed">
                A ausência de resposta ao repouso e o surgimento de novos sintomas indicam que a situação <strong>já não é segura para manter em casa</strong>.
              </p>
              <div class="p-2 bg-slate-950 border border-red-600/70 rounded-lg text-[11px] text-yellow-300">
                <strong>Cábula ao 112:</strong> «Vítima em agravamento clínico progressivo após observação inicial de sintomas, apresentando piora acentuada / novos sinais de alarme.»
              </div>
              <a href="tel:112" class="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-center text-sm rounded-xl shadow-lg shadow-red-900/60 flex items-center justify-center gap-2 mt-2 animate-pulse">
                <span>🚨</span> LIGAR 112 AGORA (Emergência INEM)
              </a>
              <button type="button" class="btn-ask-ai-followup w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-yellow-300 text-[11px] rounded-lg border border-yellow-600/50 flex items-center justify-center gap-1.5 cursor-pointer">
                <span>🤖</span> Reavaliar Sintomas Pormenorizados com a IA
              </button>
            </div>
          `;
        } else if (outcome === 'unchanged') {
          outcomeDisplay.innerHTML = `
            <div class="p-3 bg-amber-950/80 border border-amber-600/70 rounded-xl text-amber-200 space-y-2">
              <strong class="text-yellow-300 text-sm block font-bold flex items-center gap-1.5">
                <span>📞</span> Sintomas Persistentes: Contactar Linha SNS 24 (808 24 24 24)
              </strong>
              <p class="text-[11px] leading-relaxed">
                Os sintomas mantêm-se inalterados após o período de repouso. É necessária <strong>triagem telefónica profissional por um enfermeiro do SNS 24</strong> para encaminhamento adequado para Centro de Saúde ou consulta.
              </p>
              <a href="tel:808242424" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-center text-sm rounded-xl shadow-lg shadow-emerald-900/60 flex items-center justify-center gap-2 mt-2">
                <span>📞</span> LIGAR LINHA SNS 24 (808 24 24 24)
              </a>
              <button type="button" class="btn-ask-ai-followup w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-yellow-300 text-[11px] rounded-lg border border-yellow-600/50 flex items-center justify-center gap-1.5 cursor-pointer">
                <span>🤖</span> Reavaliar Sintomas com a IA
              </button>
            </div>
          `;
        } else if (outcome === 'improved') {
          outcomeDisplay.innerHTML = `
            <div class="p-3 bg-emerald-950/80 border border-emerald-600/70 rounded-xl text-emerald-200 space-y-2">
              <strong class="text-emerald-300 text-sm block font-bold flex items-center gap-1.5">
                <span>🟢</span> Evolução Favorável Registada
              </strong>
              <p class="text-[11px] leading-relaxed">
                A redução ou alívio dos sintomas é um indicador clínico positivo. Mantenha a vítima em repouso confortável, com hidratação oral fracionada se tolerada.
              </p>
              <p class="text-[10px] text-slate-300 italic">
                Nota de segurança: Se os sintomas reaparecerem nas próximas horas ou se surgir nova fraqueza, contacte a Linha SNS 24 (808 24 24 24).
              </p>
              <button type="button" class="btn-ask-ai-followup w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-300 text-[11px] rounded-lg border border-emerald-600/50 flex items-center justify-center gap-1.5 cursor-pointer">
                <span>🤖</span> Atualizar a Triagem com a IA
              </button>
            </div>
          `;
        }

        const btnFollowupAI = outcomeDisplay.querySelector('.btn-ask-ai-followup');
        if (btnFollowupAI) {
          btnFollowupAI.addEventListener('click', () => {
            const outcomeLabels = {
              improved: 'Vítima melhorou visivelmente dos sintomas após repouso',
              unchanged: 'Sintomas mantêm-se iguais sem melhorias após período de espera',
              worsened: 'Vítima piorou e surgiram novos sinais de alarme após o período de espera'
            };
            if (aiTextPrompt) {
              aiTextPrompt.value += `\n[Follow-up de Triagem: ${outcomeLabels[outcome]}]`;
              if (btnAskAI) btnAskAI.click();
            }
          });
        }

        outcomeDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  // GESTÃO DO DISCLAIMER MÉDICO E MODAL FORMAL DE TERMOS LEGAIS (RGPD / MDR)
  const disclaimerBanner = document.getElementById('app-legal-disclaimer');
  const btnDismissDisclaimer = document.getElementById('btn-dismiss-disclaimer');
  const btnShowDisclaimer = document.getElementById('btn-show-disclaimer');
  const modalLegalTerms = document.getElementById('modal-legal-terms');
  const btnCloseLegalModal = document.getElementById('btn-close-legal-modal');
  const btnAcceptLegalTerms = document.getElementById('btn-accept-legal-terms');
  const btnOpenLegalModalFromBanner = document.getElementById('btn-open-legal-modal-from-banner');

  function openLegalModal() {
    if (modalLegalTerms) {
      modalLegalTerms.classList.remove('hidden');
    }
  }

  function closeLegalModal() {
    if (modalLegalTerms) {
      modalLegalTerms.classList.add('hidden');
    }
  }

  if (btnCloseLegalModal) {
    btnCloseLegalModal.addEventListener('click', closeLegalModal);
  }

  if (btnAcceptLegalTerms) {
    btnAcceptLegalTerms.addEventListener('click', () => {
      try {
        localStorage.setItem('legal_terms_accepted', 'true');
        sessionStorage.setItem('disclaimer_closed', 'true');
      } catch (_) {}
      closeLegalModal();
      if (disclaimerBanner) disclaimerBanner.classList.add('hidden');
    });
  }

  if (btnOpenLegalModalFromBanner) {
    btnOpenLegalModalFromBanner.addEventListener('click', (e) => {
      e.preventDefault();
      openLegalModal();
    });
  }

  if (modalLegalTerms) {
    modalLegalTerms.addEventListener('click', (e) => {
      if (e.target === modalLegalTerms) closeLegalModal();
    });
  }

  if (btnDismissDisclaimer && disclaimerBanner) {
    btnDismissDisclaimer.addEventListener('click', () => {
      disclaimerBanner.classList.add('hidden');
      sessionStorage.setItem('disclaimer_closed', 'true');
    });
    if (sessionStorage.getItem('disclaimer_closed') === 'true' || localStorage.getItem('legal_terms_accepted') === 'true') {
      disclaimerBanner.classList.add('hidden');
    }
  }

  if (btnShowDisclaimer) {
    btnShowDisclaimer.addEventListener('click', (e) => {
      e.preventDefault();
      openLegalModal();
    });
  }

  // ========================================================
  // MÓDULO: FICHA CLÍNICA & CONTACTOS DE EMERGÊNCIA (ICE)
  // ========================================================
  function getMedicalId() {
    try {
      return JSON.parse(localStorage.getItem('user_medical_id') || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveMedicalId(data) {
    try {
      localStorage.setItem('user_medical_id', JSON.stringify(data));
    } catch (_) {}
    updateMedicalIdUI();
  }

  function updateMedicalIdUI() {
    const data = getMedicalId();
    const summaryCard = document.getElementById('ice-summary-card');
    const headerStatus = document.getElementById('header-ice-status');
    const aiShareName = document.getElementById('ai-share-contact-name');

    if (data && (data.name || data.contactPhone)) {
      if (summaryCard) summaryCard.classList.remove('hidden');
      if (headerStatus) headerStatus.textContent = data.contactName ? `${data.contactName}` : 'Configurado';
      if (aiShareName) aiShareName.textContent = data.contactName ? data.contactName : (data.contactPhone || 'Definido');

      const elName = document.getElementById('ice-summary-name');
      const elBlood = document.getElementById('ice-summary-blood');
      const elAllergies = document.getElementById('ice-summary-allergies');
      const elConditions = document.getElementById('ice-summary-conditions');
      const elMeds = document.getElementById('ice-summary-meds');
      const elContact = document.getElementById('ice-summary-contact');

      if (elName) elName.textContent = data.name ? `${data.name} ${data.age ? '(' + data.age + ')' : ''}` : 'Pessoa / Familiar Registado';
      if (elBlood) elBlood.textContent = data.blood || 'Desconhecido';
      if (elAllergies) elAllergies.textContent = data.allergies || 'Nenhuma declarada';
      if (elConditions) elConditions.textContent = data.conditions || 'Nenhum declarado';
      if (elMeds) elMeds.textContent = data.medication || 'Nenhuma declarada';
      if (elContact) elContact.textContent = data.contactName ? `${data.contactName} (${data.contactPhone})` : (data.contactPhone || 'Não configurado');

      const inName = document.getElementById('input-ice-name');
      const inAge = document.getElementById('input-ice-age');
      const selBlood = document.getElementById('select-ice-blood');
      const inAllergies = document.getElementById('input-ice-allergies');
      const inConditions = document.getElementById('input-ice-conditions');
      const inMeds = document.getElementById('input-ice-meds');
      const inContactName = document.getElementById('input-ice-contact-name');
      const inContactPhone = document.getElementById('input-ice-contact-phone');

      if (inName && !inName.value) inName.value = data.name || '';
      if (inAge && !inAge.value) inAge.value = data.age || '';
      if (selBlood && data.blood) selBlood.value = data.blood;
      if (inAllergies && !inAllergies.value) inAllergies.value = data.allergies || '';
      if (inConditions && !inConditions.value) inConditions.value = data.conditions || '';
      if (inMeds && !inMeds.value) inMeds.value = data.medication || '';
      if (inContactName && !inContactName.value) inContactName.value = data.contactName || '';
      if (inContactPhone && !inContactPhone.value) inContactPhone.value = data.contactPhone || '';
    } else {
      if (summaryCard) summaryCard.classList.add('hidden');
      if (headerStatus) headerStatus.textContent = 'Alergias & Contactos';
      if (aiShareName) aiShareName.textContent = 'Não configurado';
    }
  }

  const formMedicalId = document.getElementById('form-medical-id');
  if (formMedicalId) {
    formMedicalId.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById('input-ice-name')?.value.trim() || '',
        age: document.getElementById('input-ice-age')?.value.trim() || '',
        blood: document.getElementById('select-ice-blood')?.value || 'Desconhecido',
        allergies: document.getElementById('input-ice-allergies')?.value.trim() || '',
        conditions: document.getElementById('input-ice-conditions')?.value.trim() || '',
        medication: document.getElementById('input-ice-meds')?.value.trim() || '',
        contactName: document.getElementById('input-ice-contact-name')?.value.trim() || '',
        contactPhone: document.getElementById('input-ice-contact-phone')?.value.trim() || ''
      };
      saveMedicalId(data);
      alert('Ficha Clínica ICE guardada com sucesso no telemóvel!');
      navigateTo('screen-emergency');
    });
  }

  // Notificação e Partilha de Ponto de Situação com Familiar (ICE) por SMS e WhatsApp com GPS
  function shareClinicalUpdateWithICE(mode = 'info') {
    const ice = getMedicalId();
    if (!ice.contactPhone) {
      alert('Para alertar o seu contacto de emergência, preencha primeiro o número na Ficha Clínica ICE.');
      navigateTo('screen-medical-id');
      return;
    }

    const aiText = document.getElementById('ai-response-box')?.innerText || '';
    let diagSummary = 'Ponto de situação clínica e primeiros socorros prestados.';
    const diagMatch = aiText.match(/DIAGNÓSTICO E GRAVIDADE:?([^\n\r]+)/i);
    if (diagMatch && diagMatch[1]) {
      diagSummary = diagMatch[1].replace(/\[Fonte:[^\]]+\]/gi, '').trim();
    }

    // Obter localização instantaneamente
    const loc = GeoManager.currentLocation;
    const lat = loc.lat || (typeof localStorage !== 'undefined' ? localStorage.getItem('cached_gps_lat') : null);
    const lon = loc.lon || (typeof localStorage !== 'undefined' ? localStorage.getItem('cached_gps_lon') : null);
    const address = (loc.address && !loc.address.includes('A obter') && !loc.address.includes('não suportado'))
      ? loc.address
      : (typeof localStorage !== 'undefined' ? (localStorage.getItem('cached_gps_address') || '') : '');

    let locLine = '';
    const refClean = loc.landmark && !loc.landmark.includes('A calcular') ? ` (Junto a ${loc.landmark.replace(/^Junto a /i, '')})` : '';
    if (lat && lon) {
      const latShort = Number(lat).toFixed(4);
      const lonShort = Number(lon).toFixed(4);
      const mapPinUrl = `https://maps.google.com/?q=${latShort},${lonShort}`;
      const addressShort = address ? `\n📍 Local: ${address}${refClean}` : '';
      locLine = `${addressShort}\n🗺️ Mapa: ${mapPinUrl}`;
    } else if (address) {
      locLine = `\n📍 Local: ${address}${refClean}`;
    }

    const patientName = ice.name || 'Eu';
    const contactName = ice.contactName || 'Familiar';
    let messageBody = '';

    if (mode === 'urgent') {
      messageBody = `🚨 ALERTA DE EMERGÊNCIA (Cuidar em Emergência): Situação urgente com ${patientName}.\n- Estado: ${diagSummary}${locLine}\n- Pedido 112 em curso. Por favor vem ter comigo ou liga-me.`;
    } else if (mode === 'direct') {
      messageBody = `🚨 PONTO DE SITUAÇÃO (Cuidar em Emergência): Mensagem de socorro para ${contactName}.\n- Situação com: ${patientName}${locLine}\nEncontro-me a prestar assistência. Por favor liga-me ou vem ter a esta localização.`;
    } else {
      messageBody = `Olá ${contactName}, ponto de situação via Cuidar em Emergência:\n- Avaliação: ${diagSummary}${locLine}\nEncontro-me estável a vigiar sintomas. Contactarei se precisar.`;
    }

    const rawPhone = ice.contactPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    const cleanDigits = rawPhone.replace(/\+/g, '');
    let waPhone = cleanDigits;
    if (cleanDigits.length === 9 && cleanDigits.startsWith('9')) {
      waPhone = '351' + cleanDigits;
    }

    const encoded = encodeURIComponent(messageBody);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const smsSeparator = isIOS ? '&' : '?';
    const smsUrl = `sms:${rawPhone}${smsSeparator}body=${encoded}`;
    const waUrl = `https://wa.me/${waPhone}?text=${encoded}`;

    // Atualizar elementos do modal de envio
    const modal = document.getElementById('modal-share-ice');
    const modalContact = document.getElementById('share-modal-contact');
    const modalPreview = document.getElementById('share-modal-preview');
    const linkSms = document.getElementById('share-modal-sms-link');
    const linkWa = document.getElementById('share-modal-wa-link');

    if (modalContact) modalContact.textContent = ice.contactName ? `${ice.contactName} (${rawPhone})` : rawPhone;
    if (modalPreview) modalPreview.textContent = messageBody;
    if (linkSms) linkSms.href = smsUrl;
    if (linkWa) linkWa.href = waUrl;

    if (modal) {
      modal.classList.remove('hidden');
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = smsUrl;
    }
  }

  const btnCloseShareModal = document.getElementById('btn-close-share-modal');
  if (btnCloseShareModal) {
    btnCloseShareModal.addEventListener('click', () => {
      document.getElementById('modal-share-ice')?.classList.add('hidden');
    });
  }

  const btnCopyShareMsg = document.getElementById('btn-copy-share-msg');
  if (btnCopyShareMsg) {
    btnCopyShareMsg.addEventListener('click', async () => {
      const textToCopy = document.getElementById('share-modal-preview')?.textContent || '';
      try {
        await navigator.clipboard.writeText(textToCopy);
        const copyLabel = document.getElementById('btn-copy-label');
        if (copyLabel) {
          copyLabel.textContent = 'Mensagem Copiada! ✅';
          setTimeout(() => { copyLabel.textContent = 'Copiar Mensagem'; }, 2500);
        }
      } catch (_) {
        alert('Mensagem pronta a colar na sua aplicação de mensagens.');
      }
    });
  }

  const btnShareInfo = document.getElementById('btn-share-info');
  const btnShareUrgent = document.getElementById('btn-share-urgent');
  const btnIceNotifyDirect = document.getElementById('btn-ice-notify-direct');

  if (btnShareInfo) {
    btnShareInfo.addEventListener('click', () => shareClinicalUpdateWithICE('info'));
  }
  if (btnShareUrgent) {
    btnShareUrgent.addEventListener('click', () => shareClinicalUpdateWithICE('urgent'));
  }
  if (btnIceNotifyDirect) {
    btnIceNotifyDirect.addEventListener('click', () => shareClinicalUpdateWithICE('direct'));
  }

  updateMedicalIdUI();


  // SELETOR INTERATIVO DE IDADES PEDIÁTRICAS
  const pedChips = document.querySelectorAll('.pediatric-chip');
  const pedVitalsData = {
    lactente: {
      fc: '100 - 150 bpm',
      fr: '30 - 50 cpm',
      pas: '> 70 mmHg (PAS)',
      notes: '• <strong>Particularidades do Lactente (&lt;1 ano):</strong> Cabeça occipital volumosa (colocar toalha dobrada sob os ombros para manter eixo neutro da cabeça sem fletir o pescoço); via aérea afunilada em funil (região subglótica é o ponto mais estreito); respiração quase exclusivamente diafragmática.'
    },
    pequena: {
      fc: '90 - 130 bpm',
      fr: '24 - 40 cpm',
      pas: '[70 + (2 × idade)] mmHg',
      notes: '• <strong>Particularidades de 1 a 5 anos:</strong> Tórax muito complacente e elástico (fraturas de costela raras, mas contusões pulmonares internas frequentes sem sinais externos); estômago com esvaziamento mais lento; suscetibilidade a convulsões febris.'
    },
    escolar: {
      fc: '70 - 110 bpm',
      fr: '18 - 30 cpm',
      pas: '> 80 - 90 mmHg (PAS)',
      notes: '• <strong>Particularidades de 6 a 12 anos:</strong> Via aérea com anatomia similar à do adulto; capacidade de cooperação na escala de dor e no exame físico; vigilância de traumatismos desportivos e crises de asma aguda.'
    },
    adolescente: {
      fc: '60 - 100 bpm',
      fr: '12 - 20 cpm',
      pas: '> 90 mmHg (PAS)',
      notes: '• <strong>Particularidades de &gt;12 anos:</strong> Parâmetros fisiológicos idênticos aos do adulto; atuar segundo o protocolo de suporte de vida do adulto; despistar acidentes de viação/mota, consumo de substâncias ou traumatismos de alta energia.'
    }
  };

  pedChips.forEach(chip => {
    chip.addEventListener('click', () => {
      pedChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const ageKey = chip.dataset.age;
      const data = pedVitalsData[ageKey];
      if (data) {
        const elFc = document.getElementById('ped-vitals-fc');
        const elFr = document.getElementById('ped-vitals-fr');
        const elPas = document.getElementById('ped-vitals-pas');
        const elNotes = document.getElementById('ped-vitals-notes');

        if (elFc) elFc.textContent = data.fc;
        if (elFr) elFr.textContent = data.fr;
        if (elPas) elPas.textContent = data.pas;
        if (elNotes) elNotes.innerHTML = data.notes;
      }
    });
  });

  // ========================================================
  // GESTÃO DE ACESSO OFFLINE (GARANTIR CACHE EM SEGUNDO PLANO)
  // ========================================================
  const btnForceCache = document.getElementById('btn-force-cache');
  const offlineCacheStatus = document.getElementById('offline-cache-status');
  const badgeOfflineReady = document.getElementById('badge-offline-ready');
  const badgeOfflineText = document.getElementById('badge-offline-text');

  async function checkOfflineCacheStatus() {
    if (!('caches' in window)) {
      if (offlineCacheStatus) offlineCacheStatus.textContent = 'Modo offline não suportado neste navegador.';
      return;
    }
    try {
      const keys = await caches.keys();
      const currentCacheKey = keys.find(k => k.startsWith('cuidar-emergencia') || k.startsWith('protocolo-tas') || k.startsWith('socorro112'));
      if (currentCacheKey) {
        const cache = await caches.open(currentCacheKey);
        const cachedRequests = await cache.keys();
        if (offlineCacheStatus) {
          offlineCacheStatus.textContent = `✅ ${cachedRequests.length} recursos guardados na memória do telemóvel.`;
        }
        if (badgeOfflineReady) {
          badgeOfflineReady.className = 'text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1';
        }
        if (badgeOfflineText) badgeOfflineText.textContent = navigator.onLine ? 'Pronto' : 'Offline Ativo';
      } else {
        if (offlineCacheStatus) offlineCacheStatus.textContent = 'Toque em "Descarregar Info" para garantir acesso offline.';
      }
    } catch (e) {
      console.warn('Erro ao verificar cache offline:', e);
    }
  }

  // Verificar estado offline no arranque
  checkOfflineCacheStatus();

  window.addEventListener('online', () => {
    if (badgeOfflineReady) {
      badgeOfflineReady.className = 'text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1';
    }
    if (badgeOfflineText) badgeOfflineText.textContent = 'Pronto';
  });

  window.addEventListener('offline', () => {
    if (badgeOfflineReady) {
      badgeOfflineReady.className = 'text-[10px] bg-amber-950/80 text-amber-300 border border-amber-600/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1';
    }
    if (badgeOfflineText) badgeOfflineText.textContent = 'Offline Ativo';
  });

  if (btnForceCache) {
    btnForceCache.addEventListener('click', async () => {
      if (!('caches' in window)) {
        alert('O seu navegador não suporta a tecnologia de cache offline.');
        return;
      }
      btnForceCache.disabled = true;
      const originalHtml = btnForceCache.innerHTML;
      btnForceCache.innerHTML = `
        <span class="text-lg animate-spin">⏳</span>
        <div class="min-w-0">
          <strong class="text-white text-xs block font-bold truncate">A Descarregar...</strong>
          <span class="text-[10px] text-yellow-300 block truncate">A guardar no telemóvel</span>
        </div>
      `;

      try {
        const cacheName = 'cuidar-emergencia-v27';
        const cache = await caches.open(cacheName);
        
        const urlsToCache = [
          './',
          './index.html',
          './manifest.json',
          './css/styles.css?v=27',
          './js/app.js?v=27',
          './js/audio.js?v=27',
          './js/geo.js?v=27',
          './js/knowledge_base.js?v=27',
          './js/rag.js?v=27',
          './js/ai.js?v=27',
          'https://cdn.tailwindcss.com/3.4.17',
          './assets/images/estrela_da_vida.jpg',
          './assets/images/cadeia_sobrevivencia.png',
          './assets/images/sbv_consciencia.png',
          './assets/images/sbv_abertura_via_aerea.png',
          './assets/images/sbv_vos.png',
          './assets/images/sbv_pls.png',
          './assets/images/sbv_compressoes.png',
          './assets/images/sbv_insuflacoes.png',
          './assets/images/ova_pancadas.png',
          './assets/images/ova_heimlich.png',
          './assets/images/hemorragia_pressao_direta.jpg',
          './assets/images/hemorragia_garrote.jpg',
          './assets/images/hemorragia_elevacao.jpg',
          './assets/images/queimadura_1grau.jpg',
          './assets/images/queimadura_2grau.jpg',
          './assets/images/queimadura_3grau.jpg',
          './assets/images/avc_isquemico.png',
          './assets/images/avc_hemorragico.png'
        ];

        let successCount = 0;
        await Promise.allSettled(urlsToCache.map(async (url) => {
          try {
            await cache.add(url);
            successCount++;
          } catch (err) {
            console.warn('Falha pontual no pré-carregamento:', url, err);
          }
        }));

        if (navigator.storage && navigator.storage.persist) {
          try { await navigator.storage.persist(); } catch (e) {}
        }

        await checkOfflineCacheStatus();

        alert(`✅ Sucesso! Foram guardados ${successCount} recursos essenciais na memória local do seu dispositivo.\n\nA aplicação está 100% pronta para ser utilizada em zonas rurais, caves, montanha ou sem qualquer cobertura de rede móvel.`);
      } catch (err) {
        console.error('Erro ao forçar cache:', err);
        alert('Não foi possível concluir o descarregamento de todos os recursos. Verifique a ligação à internet e tente novamente.');
      } finally {
        btnForceCache.disabled = false;
        btnForceCache.innerHTML = originalHtml;
      }
    });
  }

  // ========================================================
  // MODAL DO GUIA RÁPIDO DE BOLSO (RESUMO IMPRIMÍVEL A4)
  // ========================================================
  const modalPocketGuide = document.getElementById('modal-pocket-guide');
  const btnPocketGuide = document.getElementById('btn-pocket-guide');
  const btnClosePocketGuide = document.getElementById('btn-close-pocket-guide');
  const btnDismissPocketGuide = document.getElementById('btn-dismiss-pocket-guide');
  const btnPrintPocketGuide = document.getElementById('btn-print-pocket-guide');
  const btnsOpenPocketGuideClass = document.querySelectorAll('.btn-open-pocket-guide');

  function openPocketGuide() {
    if (modalPocketGuide) modalPocketGuide.classList.remove('hidden');
  }

  function closePocketGuide() {
    if (modalPocketGuide) modalPocketGuide.classList.add('hidden');
  }

  if (btnPocketGuide) btnPocketGuide.addEventListener('click', openPocketGuide);
  btnsOpenPocketGuideClass.forEach(btn => btn.addEventListener('click', openPocketGuide));
  if (btnClosePocketGuide) btnClosePocketGuide.addEventListener('click', closePocketGuide);
  if (btnDismissPocketGuide) btnDismissPocketGuide.addEventListener('click', closePocketGuide);
  if (btnPrintPocketGuide) {
    btnPrintPocketGuide.addEventListener('click', () => {
      window.print();
    });
  }

  if (modalPocketGuide) {
    modalPocketGuide.addEventListener('click', (e) => {
      if (e.target === modalPocketGuide) closePocketGuide();
    });
  }

  // ========================================================
  // GESTÃO & EDIÇÃO DE PONTO DE REFERÊNCIA / EMPRESAS PRÓXIMAS
  // ========================================================
  const modalEditLandmark = document.getElementById('modal-edit-landmark');
  const btnEditLandmark = document.getElementById('btn-edit-landmark');
  const btnQuickEditRef = document.getElementById('btn-quick-edit-ref');
  const geoLandmarkLabel = document.getElementById('geo-landmark-label');
  const btnCloseEditLandmark = document.getElementById('btn-close-edit-landmark');
  const btnCancelLandmark = document.getElementById('btn-cancel-landmark');
  const btnSaveLandmark = document.getElementById('btn-save-landmark');
  const inputCustomLandmark = document.getElementById('input-custom-landmark');
  const boxNearbyPois = document.getElementById('box-nearby-pois');
  const listNearbyPois = document.getElementById('list-nearby-pois');

  function openEditLandmarkModal() {
    if (!modalEditLandmark) return;
    const currentRef = GeoManager.currentLocation.landmark;
    if (inputCustomLandmark) {
      inputCustomLandmark.value = (currentRef && !currentRef.includes('A calcular')) ? currentRef : '';
    }

    // Renderizar POIs / Empresas detetadas nas redondezas
    const pois = GeoManager.currentLocation.nearbyPOIs || [];
    if (boxNearbyPois && listNearbyPois) {
      if (pois.length > 0) {
        boxNearbyPois.classList.remove('hidden');
        listNearbyPois.innerHTML = pois.map(p => `
          <button type="button" class="w-full text-left py-1 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] text-sky-300 flex items-center justify-between cursor-pointer btn-pick-poi" data-name="${p.name}">
            <span>🏢 ${p.name}</span>
            <span class="text-[9px] text-slate-500">Escolher</span>
          </button>
        `).join('');

        listNearbyPois.querySelectorAll('.btn-pick-poi').forEach(btn => {
          btn.addEventListener('click', () => {
            if (inputCustomLandmark) {
              inputCustomLandmark.value = `Junto a ${btn.dataset.name}`;
            }
          });
        });
      } else {
        boxNearbyPois.classList.add('hidden');
      }
    }

    modalEditLandmark.classList.remove('hidden');
    if (inputCustomLandmark) inputCustomLandmark.focus();
  }

  function closeEditLandmarkModal() {
    if (modalEditLandmark) modalEditLandmark.classList.add('hidden');
  }

  if (btnEditLandmark) btnEditLandmark.addEventListener('click', openEditLandmarkModal);
  if (btnQuickEditRef) btnQuickEditRef.addEventListener('click', openEditLandmarkModal);
  if (geoLandmarkLabel) geoLandmarkLabel.addEventListener('click', openEditLandmarkModal);
  if (btnCloseEditLandmark) btnCloseEditLandmark.addEventListener('click', closeEditLandmarkModal);
  if (btnCancelLandmark) btnCancelLandmark.addEventListener('click', closeEditLandmarkModal);

  // Chips com prefixos rápidos
  document.querySelectorAll('.btn-ref-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prefix = chip.dataset.prefix || '';
      if (inputCustomLandmark) {
        inputCustomLandmark.value = prefix;
        inputCustomLandmark.focus();
      }
    });
  });

  if (btnSaveLandmark) {
    btnSaveLandmark.addEventListener('click', () => {
      const val = inputCustomLandmark ? inputCustomLandmark.value.trim() : '';
      if (val) {
        GeoManager.setCustomLandmark(val);
        updateGeoUI(GeoManager.currentLocation);
      }
      closeEditLandmarkModal();
    });
  }

  if (modalEditLandmark) {
    modalEditLandmark.addEventListener('click', (e) => {
      if (e.target === modalEditLandmark) closeEditLandmarkModal();
    });
  }

  // ========================================================
  // MODAL DE VÍDEOS DEMONSTRATIVOS (INEM OFICIAL)
  // ========================================================
  const modalVideoViewer = document.getElementById('modal-video-viewer');
  const modalVideoIframe = document.getElementById('modal-video-iframe');
  const modalVideoTitle = document.getElementById('modal-video-title');
  const modalVideoDesc = document.getElementById('modal-video-desc');
  const btnCloseVideoModal = document.getElementById('btn-close-video-modal');

  function openVideoModal(videoId, title, desc) {
    if (!modalVideoViewer || !modalVideoIframe) return;
    if (modalVideoTitle) modalVideoTitle.textContent = title || 'Vídeo Demonstrativo';
    if (modalVideoDesc) modalVideoDesc.textContent = desc || 'Demonstração técnica oficial do INEM (@INEMVIDEOS).';
    modalVideoIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    modalVideoViewer.classList.remove('hidden');
  }

  function closeVideoModal() {
    if (!modalVideoViewer || !modalVideoIframe) return;
    modalVideoIframe.src = '';
    modalVideoViewer.classList.add('hidden');
  }

  if (btnCloseVideoModal) {
    btnCloseVideoModal.addEventListener('click', closeVideoModal);
  }
  if (modalVideoViewer) {
    modalVideoViewer.addEventListener('click', (e) => {
      if (e.target === modalVideoViewer) closeVideoModal();
    });
  }

  document.querySelectorAll('.btn-open-video-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vid = btn.dataset.video;
      const title = btn.dataset.title || btn.textContent.trim();
      const desc = btn.dataset.desc || '';
      if (vid) openVideoModal(vid, title, desc);
    });
  });

  // ========================================================
  // SESSÃO DE EMERGÊNCIA & PASSAGEM DE TESTEMUNHO SBAR
  // ========================================================
  const emergencySession = {
    alertTimestamp: null,
    ambulanceArrivalTimestamp: null,
    lastDiagnosis: 'Emergência reportada',
    confirmedSymptoms: [],
    cprCyclesCompleted: 0
  };
  // ========================================================
  // CÁBULA DE RELATO AO 112 (MÉTODO SBAR SUBTIL EM TEXTO CORRIDO)
  // ========================================================
  function initCabulaSbar() {
    document.querySelectorAll('.btn-cabula-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const incident = btn.dataset.incident || 'geral';
        setCabulaIncident(incident);
      });
    });

    const btnCopyCabula = document.getElementById('btn-copy-cabula');
    const copyStatus = document.getElementById('copy-cabula-status');
    if (btnCopyCabula) {
      btnCopyCabula.addEventListener('click', async () => {
        const textToCopy = document.getElementById('geo-sbar-script')?.textContent?.trim() || '';
        if (!textToCopy) return;
        try {
          await navigator.clipboard.writeText(textToCopy);
          if (copyStatus) {
            copyStatus.classList.remove('hidden');
            setTimeout(() => copyStatus.classList.add('hidden'), 2200);
          }
        } catch (_) {
          // Fallback se clipboard estiver bloqueado
        }
      });
    }

    // Registar carimbo temporal de alerta ao ligar 112
    document.querySelectorAll('a[href="tel:112"]').forEach(link => {
      link.addEventListener('click', () => {
        if (!emergencySession.alertTimestamp) {
          emergencySession.alertTimestamp = new Date();
        }
      });
    });

    setCabulaIncident('geral');
  }

  // ========================================================
  // RECONHECIMENTO DE VOZ • MODO MÃOS LIVRES (SPEECH-TO-TEXT)
  // ========================================================
  function initHandsFreeVoice() {
    const btnVoice = document.getElementById('btn-voice-input');
    const voiceIndicator = document.getElementById('voice-recording-indicator');
    const btnStopVoice = document.getElementById('btn-stop-voice');
    const micIcon = document.getElementById('voice-mic-icon');
    const micLabel = document.getElementById('voice-mic-label');
    const promptInput = document.getElementById('ai-text-prompt');

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      if (btnVoice) {
        btnVoice.addEventListener('click', () => {
          alert('O reconhecimento de voz não é suportado pelo seu navegador atual. Por favor, utilize o teclado para descrever a situação.');
        });
      }
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = 'pt-PT';
    recognition.continuous = true;
    recognition.interimResults = false;
    let isListening = false;

    function startListening() {
      try {
        recognition.start();
        isListening = true;
        if (voiceIndicator) voiceIndicator.classList.remove('hidden');
        if (micIcon) micIcon.textContent = '🔴';
        if (micLabel) micLabel.textContent = 'A Ouvir...';
        if (btnVoice) {
          btnVoice.classList.add('bg-red-950', 'border-red-500', 'text-red-300');
          btnVoice.classList.remove('bg-slate-800', 'border-sky-500/50', 'text-sky-300');
        }
      } catch (e) {
        console.warn('Erro ao iniciar voz:', e);
      }
    }

    function stopListening() {
      try {
        recognition.stop();
      } catch (e) {}
      isListening = false;
      if (voiceIndicator) voiceIndicator.classList.add('hidden');
      if (micIcon) micIcon.textContent = '🎙️';
      if (micLabel) micLabel.textContent = 'Modo Mãos Livres';
      if (btnVoice) {
        btnVoice.classList.remove('bg-red-950', 'border-red-500', 'text-red-300');
        btnVoice.classList.add('bg-slate-800', 'border-sky-500/50', 'text-sky-300');
      }
    }

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' ';
        }
      }
      if (promptInput && transcript.trim()) {
        const current = promptInput.value.trim();
        promptInput.value = current ? `${current} ${transcript.trim()}` : transcript.trim();
      }
    };

    recognition.onerror = () => stopListening();
    recognition.onend = () => {
      if (isListening) stopListening();
    };

    if (btnVoice) {
      btnVoice.addEventListener('click', () => {
        if (isListening) stopListening();
        else startListening();
      });
    }

    if (btnStopVoice) {
      btnStopVoice.addEventListener('click', stopListening);
    }
  }

  // ========================================================
  // SIMULADOR INTERATIVO DE CASOS CLÍNICOS (MODO TREINO)
  // ========================================================
  const clinicalScenarios = {
    pcr_adulto: {
      title: "Paragem Cardiorrespiratória no Adulto",
      icon: "🫀",
      context: "Está no local de trabalho ou espaço público. Um homem de 55 anos cai inanimado e fica imóvel no chão.",
      steps: [
        {
          question: "Passo 1: Qual é a sua PRIMEIRA ação ao aproximar-se da vítima?",
          options: [
            { text: "Verificar a segurança do local e avaliar se a vítima responde (abanar ombros e chamar em voz firme).", correct: true, feedback: "Excelente! A segurança do socorrista é sempre a prioridade nº 1. Em seguida, testa-se a resposta da vítima." },
            { text: "Iniciar compressões torácicas no peito imediatamente.", correct: false, feedback: "Incorreto. Nunca se iniciam compressões sem antes avaliar a consciência e a respiração da vítima." },
            { text: "Dar um copo de água com açúcar para reanimar a pessoa.", correct: false, feedback: "PERIGO CRÍTICO: Nunca administrar líquidos a pessoas inconscientes pelo risco fatal de asfixia e aspiração pulmonar." }
          ]
        },
        {
          question: "Passo 2: A vítima não responde a estímulos. Como avalia a respiração?",
          options: [
            { text: "Abrir a via aérea (extensão da cabeça e elevação do queixo) e fazer o VOS (Ver, Ouvir e Sentir) até 10 segundos.", correct: true, feedback: "Correto! A extensão da cabeça afasta a língua da faringe. Observa-se a expansão torácica até 10 segundos." },
            { text: "Colocar um espelho ou telemóvel junto ao nariz para ver se embacia.", correct: false, feedback: "Incorreto. Métodos empíricos atrasam a reanimação. O protocolo ERC 2025 exige abertura da via aérea e VOS até 10s." },
            { text: "Assumir que está a respirar porque ouve alguns suspiros ruidosos e espaçados.", correct: false, feedback: "ERRO GRAVE: Respiração agónica (gasping) é um sinal inequívoco de PARAGEM CARDIORRESPIRATÓRIA e não respiração normal!" }
          ]
        },
        {
          question: "Passo 3: A vítima não respira (ou apenas apresenta gasping). O que faz a seguir?",
          options: [
            { text: "Ligar 112 de imediato (em alta-voz), pedir um DAE e iniciar compressões torácicas (30:2) a 110 bpm.", correct: true, feedback: "Perfeito! O alerta precoce com DAE e o início imediato de compressões a 110 bpm é a chave da sobrevivência segundo as diretrizes ERC 2025." },
            { text: "Fazer 5 minutos de massagem cardíaca antes de telefonar para o 112.", correct: false, feedback: "Incorreto. Sem meios diferenciados a caminho e sem DAE, as hipóteses diminuem 10% por minuto." },
            { text: "Colocar a vítima em Posição Lateral de Segurança (PLS).", correct: false, feedback: "ERRO FATAL: A PLS é exclusiva para vítimas que respiram normalmente. Vítima em PCR morre se for colocada em PLS!" }
          ]
        }
      ]
    },
    ova_adulto: {
      title: "Obstrução da Via Aérea (Engasgamento Adulto)",
      icon: "🗣️",
      context: "Durante uma refeição, uma pessoa engasga-se com comida. De repente para de falar e leva ambas as mãos ao pescoço.",
      steps: [
        {
          question: "Passo 1: A pessoa tosse com muita força e ainda consegue respirar ruidosamente. O que deve fazer?",
          options: [
            { text: "Encorajar a tosse e vigiar a vítima continuamente sem interferir nem bater nas costas.", correct: true, feedback: "Muito bem! Em obstrução ligeira com tosse eficaz, bater nas costas pode desviar o corpo estranho e transformá-lo em obstrução total." },
            { text: "Fazer de imediato a manobra de Heimlich.", correct: false, feedback: "Incorreto. A manobra de Heimlich está reservada para obstrução grave/total (tosse ineficaz ou ausente)." },
            { text: "Dar água ou miolo de pão para empurrar o objeto.", correct: false, feedback: "Perigo: Dar comida ou água agrava a obstrução das vias aéreas." }
          ]
        },
        {
          question: "Passo 2: A vítima deixa de conseguir tossir, não emite som e fica cianosada (lábios arroxeados). O que faz?",
          options: [
            { text: "Inclinar a vítima para a frente e aplicar até 5 pancadas interescapulares; se não resolver, aplicar até 5 compressões abdominais (Heimlich).", correct: true, feedback: "Excelente! Esta é a sequência padrão do ERC 2025: alternar ciclos de 5 pancadas com 5 compressões abdominais." },
            { text: "Tentar puxar o alimento às cegas introduzindo o dedo indicador profundamente na garganta.", correct: false, feedback: "ERRO: O varrimento digital às cegas é proibido porque empurra o corpo estranho mais fundo na laringe." }
          ]
        },
        {
          question: "Passo 3: Se durante as manobras a vítima perder os sentidos e colapsar, como deve atuar?",
          options: [
            { text: "Amparar a vítima até ao chão, ligar 112 (se ainda não tiver sido feito) e iniciar Suporte Básico de Vida (30 compressões torácicas).", correct: true, feedback: "Perfeito! Vítima inconsciente passa imediatamente a protocolo de SBV com compressões para tentar expelir o corpo estranho e manter fluxo cerebral." },
            { text: "Continuar a fazer compressões abdominais de Heimlich na vítima deitada.", correct: false, feedback: "Incorreto. Heimlich deitado foi abandonado pelas diretrizes internacionais em favor das compressões torácicas de SBV." }
          ]
        }
      ]
    },
    ova_pediatrico: {
      title: "Desobstrução no Bebé / Lactente (< 1 ano)",
      icon: "👶",
      context: "Um bebé de 8 meses engasga-se com comida/objeto, fica subitamente silencioso e com dificuldade respiratória extrema.",
      steps: [
        {
          question: "Passo 1: O bebé não tosse nem chora. Como posiciona o bebé para desengasgar?",
          options: [
            { text: "Deitá-lo de barriga para baixo sobre o antebraço, com a cabeça mais baixa que o tronco e a mandíbula apoiada, aplicando até 5 pancadas entre as omoplatas.", correct: true, feedback: "Correto! A gravidade e as pancadas interescapulares coordenadas ajudam a expulsar o objeto sem magoar o pescoço." },
            { text: "Fazer compressões abdominais de Heimlich como no adulto.", correct: false, feedback: "PROIBIÇÃO ABSOLUTA: Manobra de Heimlich em lactentes (<1 ano) causa rotura do fígado e baço devido à sua imaturidade anatómica!" },
            { text: "Segurar o bebé de cabeça para baixo pelos tornozelos e sacudir.", correct: false, feedback: "Perigo extremo: Risco de luxação articular, queda e hemorragia craniana por sacudidela." }
          ]
        },
        {
          question: "Passo 2: Após 5 pancadas interescapulares, o objeto não saiu. Qual o próximo passo?",
          options: [
            { text: "Virar o bebé para o outro antebraço de face para cima e aplicar até 5 compressões torácicas no terço inferior do esterno com 2 dedos.", correct: true, feedback: "Excelente! As compressões torácicas com 2 dedos no esterno aumentam a pressão intratorácica com segurança." },
            { text: "Dar goles de água com colher de chá.", correct: false, feedback: "Incorreto e perigoso: Inunda a via respiratória e causa paragem respiratória." }
          ]
        }
      ]
    },
    avc_idoso: {
      title: "Suspeita de AVC num Familiar Idoso",
      icon: "🧠",
      context: "Um familiar à mesa deixa cair o talher, apresenta fala arrastada e um olhar ausente.",
      steps: [
        {
          question: "Passo 1: Qual o algoritmo de despiste rápido que deve aplicar imediatamente?",
          options: [
            { text: "Regra dos 3 «F»: Pedir para sorrir (Face), levantar os dois braços (Força) e repetir uma frase (Fala).", correct: true, feedback: "Exato! É a escala pré-hospitalar de Cincinnati recomendada pelo INEM e DGS." },
            { text: "Pedir para caminhar em linha reta e fazer flexões.", correct: false, feedback: "Inadequado: Vítima com défice neurológico pode sofrer queda grave e traumatismo craniano." }
          ]
        },
        {
          question: "Passo 2: A boca está descaída e o braço esquerdo não sobe. Qual a conduta prioritária?",
          options: [
            { text: "Ligar 112 imediatamente, declarar suspeita de AVC (critério Via Verde) e registar a hora exata do início dos sintomas.", correct: true, feedback: "Perfeito! A janela terapêutica de trombólise é de apenas 4h30. A hora de início é o dado mais crítico para o hospital." },
            { text: "Deitar a pessoa na cama e esperar 2 horas para ver se passa.", correct: false, feedback: "ERRO CRÍTICO: 'Tempo é cérebro'. Cada minuto de atraso destrói milhões de neurónios irreversivelmente." },
            { text: "Dar um comprimido de aspirina ou medicação para a tensão.", correct: false, feedback: "PROIBIDO: Se for um AVC hemorrágico, a aspirina agrava a hemorragia intracraniana e pode ser fatal." }
          ]
        }
      ]
    },
    anafilaxia: {
      title: "Choque Anafilático (Reação Alérgica Grave)",
      icon: "🐝",
      context: "Num piquenique ou almoço, uma jovem de 24 anos é picada por uma vespa (ou ingere frutos secos). Passados 5 minutos, surge comichão intensa, urticária generalizada, inchaço visível nos lábios e respiração ruidosa (pieira/estridor).",
      steps: [
        {
          question: "Passo 1: Perante inchaço na face/língua e dificuldade respiratória rápida, qual a gravidade da situação?",
          options: [
            { text: "Emergência médica com risco de vida (Anafilaxia / Edema de Glote). Ligar 112 de imediato e procurar autoinjetor de adrenalina.", correct: true, feedback: "Correto! O edema da via aérea superior e broncoconstrição levam à asfixia se não tratados nos primeiros minutos." },
            { text: "Dar um chá morno com mel e colocar uma toalha húmida na cara.", correct: false, feedback: "Incorreto e perigoso: Não reverte o edema da glote e o chá pode ser aspirado para os pulmões." },
            { text: "Esperar 30 minutos para ver se o inchaço desaparece sozinho.", correct: false, feedback: "ERRO GRAVE: A anafilaxia progride em minutos para choque e paragem respiratória." }
          ]
        },
        {
          question: "Passo 2: A vítima tem na mala uma caneta autoinjetora de Adrenalina (Epipen). Como e onde a administra?",
          options: [
            { text: "Na face lateral externa da coxa, perpendicularmente (90º), pressionando 5 a 10 segundos até acionar o mecanismo.", correct: true, feedback: "Excelente! O vasto lateral da coxa tem excelente vascularização. Pode ser administrado mesmo através da roupa fina." },
            { text: "No abdómen, ao lado do umbigo, como se fosse insulina.", correct: false, feedback: "Incorreto. A adrenalina de emergência deve ser administrada estritamente no músculo da coxa para absorção ultrarrápida." },
            { text: "Nas veias do antebraço ou no peito perto do coração.", correct: false, feedback: "ERRO CRÍTICO: Risco de arritmia letal e necrose. Apenas no músculo da coxa." }
          ]
        },
        {
          question: "Passo 3: Após a administração da adrenalina e com o 112 acionado, como posiciona a vítima?",
          options: [
            { text: "Sentada ou deitada de costas com pernas ligeiramente elevadas se tiver tonturas; nunca levantar de pé bruscamente.", correct: true, feedback: "Perfeito! A hipotensão na anafilaxia pode causar paragem cardíaca súbita se a vítima for colocada de pé (síndrome do ventrículo vazio)." },
            { text: "Obrigar a vítima a andar para o sangue circular melhor.", correct: false, feedback: "PERIGO FATAL: Fazer a vítima andar em choque anafilático precipita colapso circulatório imediato." }
          ]
        }
      ]
    },
    hemorragia: {
      title: "Hemorragia Exsanguinante em Membro (Trauma Cortante)",
      icon: "🩸",
      context: "Um operador corta profundamente o antebraço com serra circular ou vidro. O sangue vermelho vivo jorra em jato contínuo (hemorragia arterial maciça).",
      steps: [
        {
          question: "Passo 1: Qual é a PRIMEIRA intervenção prioritária a realizar?",
          options: [
            { text: "Compressão direta firme e sustentada com compressa limpa ou a própria mão enluvada sobre o foco de sangramento.", correct: true, feedback: "Exato! A compressão direta oclui a luz do vaso e inicia a hemostase primária." },
            { text: "Lavar a ferida com bastante água e sabão antes de fazer qualquer pressão.", correct: false, feedback: "Incorreto: Numa hemorragia arterial em jato, lavar o corte remove os coágulos e atrasa a hemostase vital." },
            { text: "Dar um copo de água e tentar elevar o braço sem comprimir.", correct: false, feedback: "Incorreto. A elevação sem compressão direta é ineficaz para hemorragias arteriais graves." }
          ]
        },
        {
          question: "Passo 2: Após 3 minutos de compressão firme e sobreposição de pensos, o sangue continua a jorrar abundantemente através do tecido. Qual o passo seguinte?",
          options: [
            { text: "Aplicar imediatamente um torniquete comercial homologado (CAT) 5 a 7 cm acima da ferida no membro e rodar o molinete até estancar.", correct: true, feedback: "Excelente! Em hemorragias exsanguinantes de membros que não cedem à compressão direta, o torniquete salva vidas segundo o protocolo ERC/PHTLS." },
            { text: "Retirar todos os pensos ensopados e começar do zero com uma toalha seca.", correct: false, feedback: "ERRO CRÍTICO: Nunca retirar o primeiro penso, pois desfaz o coágulo embrionário que o corpo está a tentar formar." },
            { text: "Deixar sangrar um pouco para 'limpar as impurezas' da ferida.", correct: false, feedback: "Mito perigoso: Uma perda arterial de 1.5L de sangue leva ao choque hipovolémico irreversível em minutos." }
          ]
        },
        {
          question: "Passo 3: O sangramento estancou após apertar o torniquete. Qual o cuidado obrigatório agora?",
          options: [
            { text: "Registar a hora exata da colocação do torniquete e NUNCA o desapertar até à intervenção médica no hospital.", correct: true, feedback: "Perfeito! A hora é essencial para a viabilidade do membro e aliviar o torniquete liberta toxinas e reinicia o choque." },
            { text: "Desapertar o torniquete de 10 em 10 minutos para deixar o braço respirar.", correct: false, feedback: "ERRO HISTÓRICO PERIGOSO: Diretrizes internacionais baniram o alívio intermitente pelo risco de morte por hemorragia súbita." }
          ]
        }
      ]
    },
    convulsao: {
      title: "Crise Convulsiva / Epilepsia num Espaço Público",
      icon: "⚡",
      context: "Numa estação ou loja, uma pessoa cai subitamente desamparada, perde a consciência e inicia tremores musculares violentos e involuntários com salivação.",
      steps: [
        {
          question: "Passo 1: Qual é a sua prioridade durante a fase convulsiva com movimentos descoordenados?",
          options: [
            { text: "Afastar objetos cortantes/móveis em redor e proteger a cabeça com um casaco dobrado, cronometrando a crise.", correct: true, feedback: "Correto! O objetivo principal é prevenir traumatismos cranianos secundários enquanto a crise decorre." },
            { text: "Segurar com toda a força os braços e pernas da vítima para parar os tremores.", correct: false, feedback: "Incorreto: Tentar travar as contrações pode provocar fraturas ósseas e ruturas musculares graves." },
            { text: "Enfiar uma colher ou os dedos na boca da pessoa para 'não enrolar a língua'.", correct: false, feedback: "ERRO GRAVE E MITO: NUNCA colocar nada na boca. Provoca fratura de dentes, amputação dos dedos do socorrista e asfixia mecânica." }
          ]
        },
        {
          question: "Passo 2: Os tremores cessam passados 2 minutos. A vítima está inconsciente, sonolenta, mas respira ruidosamente. O que faz?",
          options: [
            { text: "Colocar em Posição Lateral de Segurança (PLS) para manter a via aérea aberta e deixar drenar a saliva.", correct: true, feedback: "Excelente! A PLS no período pós-crítico previne que a língua obstrua a garganta e evita a broncoaspiração de secreções." },
            { text: "Abanar a pessoa e dar estaladas na face para acordar mais depressa.", correct: false, feedback: "Inadequado: A sonolência (estado pós-ictal) é um processo fisiológico normal do cérebro a recuperar da crise." },
            { text: "Iniciar massagem cardíaca imediatamente.", correct: false, feedback: "Incorreto: Se a vítima está a respirar normalmente, nunca se iniciam compressões torácicas." }
          ]
        }
      ]
    }
  };

  let currentScenarioKey = 'pcr_adulto';
  let currentScenarioStep = 0;

  function renderClinicalScenario(key, stepIndex = 0) {
    const container = document.getElementById('sim-active-container');
    if (!container) return;

    const scenario = clinicalScenarios[key];
    if (!scenario) return;

    currentScenarioKey = key;
    currentScenarioStep = stepIndex;

    // Atualizar botões de seleção
    document.querySelectorAll('.btn-scenario-select').forEach(b => {
      if (b.dataset.scenario === key) {
        b.classList.add('active', 'border-purple-500');
        b.classList.remove('border-slate-700');
      } else {
        b.classList.remove('active', 'border-purple-500');
        b.classList.add('border-slate-700');
      }
    });

    const isFinished = stepIndex >= scenario.steps.length;
    if (isFinished) {
      container.innerHTML = `
        <div class="text-center py-4 space-y-2">
          <span class="text-4xl block">🏅</span>
          <h4 class="text-sm font-black text-white">Cenário Concluído com Sucesso!</h4>
          <p class="text-xs text-emerald-300">
            Demonstrou rigor e prontidão nas decisões prioritárias segundo as Diretrizes Europeias de Ressuscitação ERC 2025.
          </p>
          <div class="pt-2 flex items-center justify-center gap-2">
            <button type="button" class="btn-restart-scenario py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer">
              🔄 Repetir Cenário
            </button>
          </div>
        </div>
      `;
      container.querySelector('.btn-restart-scenario')?.addEventListener('click', () => {
        renderClinicalScenario(key, 0);
      });
      return;
    }

    const step = scenario.steps[stepIndex];
    const totalSteps = scenario.steps.length;

    let optionsHtml = '';
    step.options.forEach((opt, idx) => {
      optionsHtml += `
        <button type="button" class="btn-scenario-opt w-full text-left p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs transition flex items-start gap-2.5 cursor-pointer" data-idx="${idx}">
          <span class="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-300 shrink-0 mt-0.5">${String.fromCharCode(65 + idx)}</span>
          <span class="text-slate-200 leading-snug flex-1">${opt.text}</span>
        </button>
      `;
    });

    container.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <div class="flex items-center gap-2">
          <span class="text-xl">${scenario.icon}</span>
          <div>
            <h4 class="text-xs font-black text-white">${scenario.title}</h4>
            <span class="text-[10px] text-purple-300">Passo ${stepIndex + 1} de ${totalSteps}</span>
          </div>
        </div>
        <span class="text-[10px] bg-purple-950 text-purple-300 border border-purple-600/40 px-2 py-0.5 rounded font-mono font-bold">Modo Treino</span>
      </div>

      <div class="p-2 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-300 italic">
        «${scenario.context}»
      </div>

      <p class="text-xs text-yellow-200 font-bold leading-snug pt-1">${step.question}</p>

      <div class="space-y-1.5" id="sim-options-list">
        ${optionsHtml}
      </div>

      <div id="sim-feedback-box" class="hidden p-3 rounded-xl text-xs leading-relaxed">
        <!-- Preenchido ao responder -->
      </div>
    `;

    // Event listeners para as opções
    const optButtons = container.querySelectorAll('.btn-scenario-opt');
    const feedbackBox = container.querySelector('#sim-feedback-box');

    optButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const chosen = step.options[idx];

        optButtons.forEach(b => {
          b.disabled = true;
          b.classList.add('pointer-events-none');
        });

        if (chosen.correct) {
          btn.classList.remove('bg-slate-900', 'border-slate-800');
          btn.classList.add('bg-emerald-950/80', 'border-emerald-500', 'text-emerald-200');
          feedbackBox.className = 'p-3 rounded-xl text-xs leading-relaxed bg-emerald-950/80 border border-emerald-500 text-emerald-200';
          feedbackBox.innerHTML = `
            <div class="flex items-start gap-2">
              <span class="text-lg">✅</span>
              <div class="space-y-1">
                <strong>Decisão Correta:</strong>
                <p>${chosen.feedback}</p>
                <div class="pt-2">
                  <button type="button" id="btn-next-sim-step" class="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow">
                    Continuar para o Passo ${stepIndex + 2} ➔
                  </button>
                </div>
              </div>
            </div>
          `;
          feedbackBox.classList.remove('hidden');
          container.querySelector('#btn-next-sim-step')?.addEventListener('click', () => {
            renderClinicalScenario(key, stepIndex + 1);
          });
        } else {
          btn.classList.remove('bg-slate-900', 'border-slate-800');
          btn.classList.add('bg-red-950/80', 'border-red-500', 'text-red-200');
          feedbackBox.className = 'p-3 rounded-xl text-xs leading-relaxed bg-red-950/80 border border-red-500 text-red-200';
          feedbackBox.innerHTML = `
            <div class="flex items-start gap-2">
              <span class="text-lg">❌</span>
              <div class="space-y-1">
                <strong>Atenção Clínica:</strong>
                <p>${chosen.feedback}</p>
                <div class="pt-2">
                  <button type="button" id="btn-retry-sim-step" class="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs border border-slate-700 cursor-pointer">
                    🔄 Repensar e Tentar Novamente
                  </button>
                </div>
              </div>
            </div>
          `;
          feedbackBox.classList.remove('hidden');
          container.querySelector('#btn-retry-sim-step')?.addEventListener('click', () => {
            renderClinicalScenario(key, stepIndex);
          });
        }
      });
    });
  }

  function initClinicalSimulator() {
    document.querySelectorAll('.btn-scenario-select').forEach(btn => {
      btn.addEventListener('click', () => {
        const sc = btn.dataset.scenario;
        if (sc) renderClinicalScenario(sc, 0);
      });
    });

    renderClinicalScenario('pcr_adulto', 0);

    const btnQuickSim = document.getElementById('btn-quick-simulator');
    if (btnQuickSim) {
      btnQuickSim.addEventListener('click', () => {
        const navBtn = document.querySelector('.bottom-nav button[data-target="screen-learning-hub"]');
        if (navBtn) navBtn.click();
        const ch = document.getElementById('chapter-simulator');
        if (ch) {
          ch.classList.add('open');
          setTimeout(() => ch.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
        }
      });
    }
  }

  // ========================================================
  // CONFIGURAÇÃO DE AFILIADOS AMAZON (MONETIZAÇÃO ÉTICA)
  // ========================================================
  const AMAZON_AFFILIATE_CONFIG = {
    // Tag oficial do Programa de Associados da Amazon de Hugo Fonte
    associateTag: 'hfonte-21',
    buildSearchUrl(query) {
      return `https://www.amazon.es/s?k=${encodeURIComponent(query)}&tag=${this.associateTag}`;
    },
    svgIcons: {
      kit_bag: `<svg class="w-11 h-11 shrink-0 rounded-xl p-1 bg-red-950/70 border border-red-500/50" viewBox="0 0 48 48" fill="none"><rect x="6" y="14" width="36" height="26" rx="5" fill="#dc2626"/><rect x="18" y="8" width="12" height="7" rx="2" stroke="#f87171" stroke-width="2.5" fill="none"/><rect x="22" y="20" width="4" height="14" rx="1" fill="#ffffff"/><rect x="17" y="25" width="14" height="4" rx="1" fill="#ffffff"/><path d="M6 25 L42 25" stroke="#991b1b" stroke-width="1.5" stroke-dasharray="2 2"/></svg>`,
      pocket_mask: `<svg class="w-11 h-11 shrink-0 rounded-xl p-1 bg-red-950/70 border border-amber-500/50" viewBox="0 0 48 48" fill="none"><path d="M10 24 C10 12, 38 12, 38 24 C38 34, 24 40, 24 40 C24 40, 10 34, 10 24 Z" fill="#ef4444" stroke="#fca5a5" stroke-width="1.5"/><ellipse cx="24" cy="23" rx="9" ry="11" fill="#38bdf8" fill-opacity="0.35" stroke="#bae6fd" stroke-width="1.5"/><circle cx="24" cy="22" r="4.5" fill="#ffffff" stroke="#0284c7" stroke-width="1.5"/><circle cx="24" cy="22" r="2" fill="#0284c7"/><ellipse cx="24" cy="23" rx="7" ry="9" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 1" fill="none"/></svg>`,
      tourniquet: `<svg class="w-11 h-11 shrink-0 rounded-xl p-1 bg-slate-900 border border-red-500/50" viewBox="0 0 48 48" fill="none"><rect x="6" y="20" width="36" height="8" rx="2" fill="#1e293b" stroke="#475569" stroke-width="1.5"/><rect x="18" y="16" width="12" height="16" rx="2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/><rect x="12" y="22" width="24" height="4" rx="1.5" transform="rotate(-30 24 24)" fill="#dc2626" stroke="#fca5a5" stroke-width="1"/><rect x="30" y="21" width="10" height="6" rx="1" fill="#ffffff"/><text x="31" y="25.5" font-size="3.5" font-family="sans-serif" font-weight="900" fill="#000000">TIME</text></svg>`,
      cold_pack: `<svg class="w-11 h-11 shrink-0 rounded-xl p-1 bg-sky-950/70 border border-sky-400/50" viewBox="0 0 48 48" fill="none"><rect x="8" y="10" width="32" height="28" rx="4" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/><path d="M24 16 L24 32 M16 24 L32 24 M18 18 L30 30 M18 30 L30 18" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="#bae6fd"/><text x="13" y="36" font-size="3.5" font-family="sans-serif" font-weight="bold" fill="#bae6fd">ICE PACK</text></svg>`,
      blanket: `<svg class="w-11 h-11 shrink-0 rounded-xl p-1 bg-slate-900 border border-amber-400/50" viewBox="0 0 48 48" fill="none"><polygon points="10,12 28,8 38,20 20,24" fill="#f59e0b" stroke="#fde047" stroke-width="1.2"/><polygon points="20,24 38,20 36,38 18,42" fill="#e2e8f0" stroke="#ffffff" stroke-width="1.2"/><polygon points="10,12 20,24 18,42 8,30" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1"/><path d="M22 14 L24 18 M30 26 L32 30" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>`
    },
    locationKits: {
      casa: {
        title: "Mala de Primeiros Socorros Completa para Casa (90+ Peças Homologada)",
        query: "botiquin primeiros auxilios casa homologado completo",
        priceHint: "Aprox. 15€ - 25€ • Entrega 24h Prime",
        badge: "Mais Vendido Casa"
      },
      carro: {
        title: "Estojo de Primeiros Socorros para Carro (Norma Europeia DIN 13164)",
        query: "botiquin coche din 13164 homologado obligatorio",
        priceHint: "Aprox. 12€ - 19€ • Obrigatório em Viagens",
        badge: "Certificado DIN"
      },
      erpi: {
        title: "Mala de Emergência Médica Geriátrica com Oxímetro e Tensiómetro",
        query: "botiquin geriatria primeros auxilios oximetro tensiometro",
        priceHint: "Aprox. 29€ - 49€ • Cuidados de Idosos",
        badge: "Equipamento Clínico"
      },
      creche: {
        title: "Kit de Primeiros Socorros Infantil com Bolsas de Frio e Curativos",
        query: "botiquin infantil primeros auxilios guarderia colegio",
        priceHint: "Aprox. 14€ - 22€ • Seguro para Crianças",
        badge: "Aprovado Pediátrico"
      },
      empresa: {
        title: "Posto / Armário de Primeiros Socorros SST para Empresas e Armazéns",
        query: "botiquin empresa primeros auxilios sst trabalho lava ojos",
        priceHint: "Aprox. 29€ - 55€ • Normas de Trabalho",
        badge: "Segurança no Trabalho"
      }
    },
    essentialItems: [
      {
        id: "pocket_mask",
        svgKey: "pocket_mask",
        name: "Máscara Pocket de RCP com Estojo Rígido",
        desc: "Máscara transparente com almofada de ar e válvula de 1 via para insuflações seguras boca-a-máscara.",
        visualTip: "⚠️ Como identificar na lista: Procure a máscara transparente em forma de coração/concha com estojo rígido (vermelho/laranja). NÃO compre máscaras FFP2 de poeiras/vírus!",
        query: "pocket mask rcp primeros auxilios estuche rigido"
      },
      {
        id: "tourniquet",
        svgKey: "tourniquet",
        name: "Torniquete Comercial Homologado (CAT)",
        desc: "Fita de garrote tático com molinete metálico/polímero para hemostase de emergência em membros.",
        visualTip: "⚠️ Como identificar na lista: Procure a fita de nylon preta com haste/molinete de aperto e etiqueta branca «TIME».",
        query: "torniquete cat homologado militar hemostatico primeros auxilios"
      },
      {
        id: "cold_pack",
        svgKey: "cold_pack",
        name: "Bolsas de Frio Instantâneo Descartáveis (Pack)",
        desc: "Bolsa de frio por compressão instantânea para alívio imediato de pancadas, hematomas e entorses.",
        visualTip: "⚠️ Como identificar na lista: Pacotes azuis de ativação rápida por aperto manual (sem congelador).",
        query: "bolsas frio instantaneo primeros auxilios desechable"
      },
      {
        id: "blanket",
        svgKey: "blanket",
        name: "Mantas Térmicas Aluminizadas de Sobrevivência (Pack)",
        desc: "Folha isotérmica refletora ouro/prata indispensável contra choque térmico e hipotermia pós-acidente.",
        visualTip: "⚠️ Como identificar na lista: Folhas metálicas brilhantes dobradas compactas douradas e prateadas.",
        query: "manta termica supervivencia primeros auxilios oro plata"
      }
    ]
  };

  // Mapeamento de termos específicos na Amazon.es para cada artigo
  const ITEM_AMAZON_QUERIES = {
    // Casa
    c_luvas: "luvas nitrilo descartaveis primeiros socorros",
    c_soro: "soro fisiologico monodose primeiros socorros",
    c_comp_est: "compressas esterilizadas gaze primeiros socorros",
    c_adesivo: "fita adesiva medica micropore esparadrapo",
    c_ligadura: "ligadura elastica crepe primeiros socorros",
    c_pensos: "pensos rapidos curativos primeiros socorros",
    c_tesoura: "tesoura pontas redondas primeiros socorros",
    c_pinca: "pinca primeiros socorros farpas esteril",
    c_termom: "termometro digital corporal febre",
    c_manta: "manta termica sobrevivencia ouro prata",
    c_gel_frio: "bolsas frio instantaneo descartavel primeiros socorros",
    c_pocket: "pocket mask rcp primeiros auxilios estuche rigido",

    // Carro
    v_colete: "colete refletor triangulo homologado carro",
    v_luvas: "luvas nitrilo descartaveis primeiros socorros",
    v_manta: "manta termica sobrevivencia ouro prata",
    v_tesoura: "tesoura trauma corta vestuario primeiros socorros",
    v_comp_abs: "compressas estéreis gaze absorventes primeiros socorros",
    v_ligaduras: "ligadura elastica fixacao primeiros socorros",
    v_adesivo: "fita adesiva medica resistente",
    v_soro: "soro fisiologico monodose primeiros socorros",
    v_pocket: "pocket mask rcp primeiros auxilios estuche rigido",
    v_lanterna: "lanterna led emergencia estanque alta potencia",

    // ERPI / Lar de Idosos
    e_tensio: "tensiometro digital braco omron homologado",
    e_oxim: "oximetro pulso digital dedo homologado",
    e_glic: "medidor glicemia capilar tiras teste",
    e_termom: "termometro infravermelhos digital febre",
    e_luvas: "caixa luvas nitrilo primeiros socorros",
    e_silicone: "pensos silicone atraumaticos pele senil",
    e_antiss: "clorexidina aquosa desinfetante feridas",
    e_soro: "soro fisiologico irrigacao feridas",
    e_comp: "compressas esterilizadas ligaduras primeiros socorros",
    e_manta: "manta termica sobrevivencia primeiros socorros",
    e_pocket: "pocket mask rcp primeiros auxilios estuche rigido",

    // Creche & Escola
    k_gel_frio: "bolsas frio instantaneo descartavel criancas",
    k_soro: "soro fisiologico monodose lavagem olhos nariz",
    k_pensos_inf: "pensos rapidos infantis hipoalergenicos",
    k_termom: "termometro digital ponta flexivel criancas",
    k_sro: "saquetas sais reidratacao oral criancas",
    k_luvas: "luvas nitrilo descartaveis primeiros socorros",
    k_comp: "compressas gaze esterilizada pequenas",
    k_ligaduras: "ligaduras elasticas fixacao suaves",
    k_tesoura: "tesoura infantil pontas redondas",
    k_masc_ped: "pocket mask pediatrica mascara rcp crianca",

    // Empresa / Trabalho (SST)
    w_lava_olhos: "solucao lava olhos estacao primeiros socorros",
    w_torniquete: "torniquete cat homologado militar primeiros auxilios",
    w_penso_valv: "penso toracico valvular chest seal trauma",
    w_luvas: "luvas nitrilo alta resistencia primeiros socorros",
    w_comp_grandes: "compressas absorventes esterilizadas grandes queimaduras",
    w_manta: "manta termica sobrevivencia ouro prata",
    w_tesoura: "tesoura trauma corta vestuario socorrista",
    w_ligaduras: "ligaduras compressivas primeiros socorros",
    w_pocket: "pocket mask rcp primeiros auxilios estuche rigido"
  };

  // Minutas Oficiais Descarregáveis em Formato Word (.docx)
  const ITEM_DOC_TEMPLATES = {
    e_fichas: {
      file: './assets/docs/Ficha_Medica_Individual_ERPI.docx',
      filename: 'Ficha_Medica_Individual_ERPI.docx',
      label: 'Minuta .docx',
      title: 'Descarregar Minuta Editável Word (.docx) para Utentes de Lar / ERPI'
    },
    k_alergias: {
      file: './assets/docs/Plano_Individual_Saude_Creche.docx',
      filename: 'Plano_Individual_Saude_Creche.docx',
      label: 'Minuta .docx',
      title: 'Descarregar Minuta Editável Word (.docx) do Plano Individual de Saúde para Creche & Escola'
    }
  };

  // ========================================================
  // CHECKLIST DA CAIXA DE PRIMEIROS SOCORROS POR LOCAL
  // ========================================================
  const firstAidKitData = {
    casa: {
      title: "Caixa de Primeiros Socorros • Casa (Familiar)",
      icon: "🏠",
      desc: "Material indispensável para tratamento de feridas ligeiras, queimaduras e acidentes caseiros:",
      items: [
        { id: "c_luvas", name: "Luvas de nitrilo descartáveis (3 pares)", cat: "Proteção" },
        { id: "c_soro", name: "Soro fisiológico unidose 5ml/10ml (10 un)", cat: "Lavagem" },
        { id: "c_comp_est", name: "Compressas esterilizadas 10x10cm (5 emb)", cat: "Curativo" },
        { id: "c_adesivo", name: "Fita adesiva hipoalergénica / micropore", cat: "Fixação" },
        { id: "c_ligadura", name: "Ligadura elástica de crepe 7cm e 10cm", cat: "Imobilização" },
        { id: "c_pensos", name: "Pensos rápidos adesivos sortidos", cat: "Curativo" },
        { id: "c_tesoura", name: "Tesoura de pontas redondas", cat: "Instrumental" },
        { id: "c_pinca", name: "Pinça de pontas finas para farpas/espinhos", cat: "Instrumental" },
        { id: "c_termom", name: "Termómetro digital corporal", cat: "Avaliação" },
        { id: "c_manta", name: "Manta térmica aluminizada de sobrevivência", cat: "Isolamento" },
        { id: "c_gel_frio", name: "Bolsa de frio instantâneo (contusões/torções)", cat: "Crioterapia" },
        { id: "c_pocket", name: "Máscara facial pocket com válvula para RCP", cat: "Suporte de Vida" }
      ]
    },
    carro: {
      title: "Estojo de Primeiros Socorros • Carro / Viatura",
      icon: "🚗",
      desc: "Norma europeia DIN 13164 para assistência rápida em viagens e acidentes de viação:",
      items: [
        { id: "v_colete", name: "Colete retrorrefletor extra e triângulo", cat: "Segurança" },
        { id: "v_luvas", name: "Luvas descartáveis de nitrilo (2 pares)", cat: "Proteção" },
        { id: "v_manta", name: "Manta térmica aluminizada (anti-hipotermia)", cat: "Isolamento" },
        { id: "v_tesoura", name: "Tesoura de corte romba (corta cintos/roupa)", cat: "Desencarceramento" },
        { id: "v_comp_abs", name: "Compressas estéreis absorventes grandes", cat: "Hemostase" },
        { id: "v_ligaduras", name: "Ligaduras elásticas de fixação (2 rolos)", cat: "Curativo" },
        { id: "v_adesivo", name: "Fita adesiva médica resistente", cat: "Fixação" },
        { id: "v_soro", name: "Soro fisiológico estéril unidose (5 un)", cat: "Lavagem" },
        { id: "v_pocket", name: "Máscara de reanimação pocket com filtro", cat: "Suporte de Vida" },
        { id: "v_lanterna", name: "Lanterna estanque de alta visibilidade", cat: "Segurança" }
      ]
    },
    erpi: {
      title: "Mala de Primeiros Socorros • ERPI / Lar de Idosos",
      icon: "👵",
      desc: "Adequada à fragilidade cutânea, polipatologia e controlo de sinais vitais no idoso:",
      items: [
        { id: "e_tensio", name: "Tensiómetro digital de braço calibrado", cat: "Monitorização" },
        { id: "e_oxim", name: "Oxímetro de pulso digital portátil", cat: "Monitorização" },
        { id: "e_glic", name: "Medidor de glicemia capilar + tiras no prazo", cat: "Glicemia" },
        { id: "e_termom", name: "Termómetro timpânico ou de infravermelhos", cat: "Monitorização" },
        { id: "e_luvas", name: "Luvas de nitrilo descartáveis (caixa)", cat: "Proteção" },
        { id: "e_silicone", name: "Pensos de silicone atraumáticos (pele senil)", cat: "Curativo" },
        { id: "e_antiss", name: "Solução antisséptica aquosa (clorexidina a 0,2%)", cat: "Antisepsia" },
        { id: "e_soro", name: "Frascos de soro fisiológico para irrigação", cat: "Lavagem" },
        { id: "e_comp", name: "Compressas estéreis e ligaduras tubulares", cat: "Curativo" },
        { id: "e_manta", name: "Manta térmica aluminizada", cat: "Isolamento" },
        { id: "e_pocket", name: "Máscara pocket com filtro bacteriano para RCP", cat: "Suporte de Vida" },
        { id: "e_fichas", name: "Ficha médica atualizada de cada utente (alergias/medicação)", cat: "Documentação" }
      ]
    },
    creche: {
      title: "Estojo de Primeiros Socorros • Creche & Escola",
      icon: "🧒",
      desc: "Adaptado a crianças, lactentes e acidentes infantis comuns:",
      items: [
        { id: "k_gel_frio", name: "Compressas de frio instantâneo (galos/quedas)", cat: "Crioterapia" },
        { id: "k_soro", name: "Soro fisiológico unidose em abundância", cat: "Lavagem" },
        { id: "k_pensos_inf", name: "Pensos rápidos hipoalergénicos infantis", cat: "Curativo" },
        { id: "k_termom", name: "Termómetro digital de ponta flexível rápida", cat: "Avaliação" },
        { id: "k_sro", name: "Saquetas de sais de reidratação oral (SRO)", cat: "Hidratação" },
        { id: "k_luvas", name: "Luvas descartáveis de nitrilo", cat: "Proteção" },
        { id: "k_comp", name: "Compressas de gaze estéril pequenas e médias", cat: "Curativo" },
        { id: "k_ligaduras", name: "Ligaduras elásticas macias para pulsos/tornozelos", cat: "Imobilização" },
        { id: "k_tesoura", name: "Tesoura infantil de pontas redondas", cat: "Instrumental" },
        { id: "k_masc_ped", name: "Máscara pocket pediátrica (lactente e criança)", cat: "Suporte de Vida" },
        { id: "k_alergias", name: "Plano Individual de Saúde e autorizações de emergência", cat: "Documentação" }
      ]
    },
    empresa: {
      title: "Posto de Primeiros Socorros • Empresa / Trabalho",
      icon: "🏢",
      desc: "Conforme as diretrizes de Segurança no Trabalho (SST / ACT):",
      items: [
        { id: "w_lava_olhos", name: "Frascos de solução lava-olhos estéril com ocular", cat: "Oftalmo" },
        { id: "w_torniquete", name: "Torniquete comercial homologado (risco de corte)", cat: "Hemostase Crítica" },
        { id: "w_penso_valv", name: "Penso torácico valvular / pensos hemostáticos", cat: "Trauma" },
        { id: "w_luvas", name: "Luvas de nitrilo de alta espessura", cat: "Proteção" },
        { id: "w_comp_grandes", name: "Compressas absorventes para queimaduras e feridas", cat: "Curativo" },
        { id: "w_manta", name: "Manta térmica aluminizada de sobrevivência", cat: "Isolamento" },
        { id: "w_tesoura", name: "Tesoura de trauma corta-vestuário pesada", cat: "Instrumental" },
        { id: "w_ligaduras", name: "Ligaduras elásticas de compressão", cat: "Imobilização" },
        { id: "w_pocket", name: "Máscara pocket de RCP com válvula antirretorno", cat: "Suporte de Vida" },
        { id: "w_contactos", name: "Quadro visível com socorristas internos e 112", cat: "Procedimento" }
      ]
    }
  };

  let currentKitLocation = 'casa';

  function renderKitChecklist(locationKey) {
    const container = document.getElementById('kit-checklist-container');
    if (!container) return;

    currentKitLocation = locationKey;
    const kit = firstAidKitData[locationKey];
    if (!kit) return;

    // Atualizar abas
    document.querySelectorAll('.btn-kit-location-tab').forEach(b => {
      if (b.dataset.location === locationKey) {
        b.classList.add('bg-emerald-600', 'text-white', 'active');
        b.classList.remove('bg-slate-800', 'text-slate-300');
      } else {
        b.classList.remove('bg-emerald-600', 'text-white', 'active');
        b.classList.add('bg-slate-800', 'text-slate-300');
      }
    });

    const savedState = JSON.parse(localStorage.getItem(`first_aid_kit_${locationKey}`) || '{}');
    const totalItems = kit.items.length;
    let checkedCount = 0;

    let itemsHtml = '';
    kit.items.forEach(item => {
      const isChecked = !!savedState[item.id];
      if (isChecked) checkedCount++;

      const docTemplate = ITEM_DOC_TEMPLATES[item.id];
      const query = ITEM_AMAZON_QUERIES[item.id] || (item.cat !== 'Documentação' ? `${item.name} primeiros socorros` : null);
      const buyUrl = query ? AMAZON_AFFILIATE_CONFIG.buildSearchUrl(query) : null;

      itemsHtml += `
        <div class="kit-item-row p-2.5 bg-slate-900 border ${isChecked ? 'border-emerald-500/70 is-checked' : 'border-slate-800'} rounded-xl flex items-center justify-between gap-2.5 transition" data-id="${item.id}">
          <div class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
            <span class="kit-checkbox w-5 h-5 rounded border ${isChecked ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black' : 'border-slate-600 bg-slate-950 text-transparent'} flex items-center justify-center text-xs shrink-0 transition">✓</span>
            <div class="min-w-0 flex-1">
              <strong class="text-xs text-white block truncate leading-tight">${item.name}</strong>
              <span class="text-[10px] text-slate-400 block">${item.cat}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            ${docTemplate ? `
              <a href="${docTemplate.file}" download="${docTemplate.filename}" class="btn-item-doc py-1 px-2.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shadow transition cursor-pointer" onclick="event.stopPropagation()" title="${docTemplate.title}">
                <span>📥</span> <span>${docTemplate.label}</span>
              </a>
            ` : ''}
            ${buyUrl ? `
              <a href="${buyUrl}" target="_blank" rel="noopener noreferrer nofollow" class="btn-item-buy py-1 px-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-[10px] rounded-lg flex items-center gap-1 shadow transition cursor-pointer" onclick="event.stopPropagation()" title="Ver e comprar na Amazon.es">
                <span>🛒</span> <span>Comprar</span>
              </a>
            ` : ''}
            <span class="text-[10px] px-2 py-0.5 rounded font-mono cursor-pointer ${isChecked ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/40' : 'bg-slate-800 text-slate-400'}">
              ${isChecked ? 'Conferido' : 'Falta'}
            </span>
          </div>
        </div>
      `;
    });

    const percent = Math.round((checkedCount / totalItems) * 100);
    const mainKit = AMAZON_AFFILIATE_CONFIG.locationKits[locationKey] || AMAZON_AFFILIATE_CONFIG.locationKits.casa;
    const mainKitUrl = AMAZON_AFFILIATE_CONFIG.buildSearchUrl(mainKit.query);

    let institutionDocBanner = '';
    if (locationKey === 'erpi') {
      institutionDocBanner = `
        <!-- MINUTA INSTITUCIONAL EDITÁVEL ERPI -->
        <div class="p-2.5 bg-gradient-to-r from-sky-950/80 to-slate-900 border border-sky-500/50 rounded-xl flex items-center justify-between gap-2.5 text-xs shadow-sm">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xl shrink-0">📄</span>
            <div class="min-w-0">
              <strong class="text-sky-200 text-xs block truncate">Minuta Médica Individual (.docx)</strong>
              <span class="text-[10px] text-sky-300/80 block leading-tight">Ficha editável para utentes de Lar / ERPI (normas DGS/ISS).</span>
            </div>
          </div>
          <a href="./assets/docs/Ficha_Medica_Individual_ERPI.docx" download="Ficha_Medica_Individual_ERPI.docx" class="py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg shrink-0 shadow flex items-center gap-1.5 transition cursor-pointer" title="Descarregar modelo Word para Lar / ERPI">
            <span>📥</span> <span>Descarregar .docx</span>
          </a>
        </div>
      `;
    } else if (locationKey === 'creche') {
      institutionDocBanner = `
        <!-- MINUTA INSTITUCIONAL EDITÁVEL CRECHE -->
        <div class="p-2.5 bg-gradient-to-r from-sky-950/80 to-slate-900 border border-sky-500/50 rounded-xl flex items-center justify-between gap-2.5 text-xs shadow-sm">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xl shrink-0">📋</span>
            <div class="min-w-0">
              <strong class="text-sky-200 text-xs block truncate">Plano Individual de Saúde (.docx)</strong>
              <span class="text-[10px] text-sky-300/80 block leading-tight">Minuta editável para Creche &amp; Escola com alergias e SOS.</span>
            </div>
          </div>
          <a href="./assets/docs/Plano_Individual_Saude_Creche.docx" download="Plano_Individual_Saude_Creche.docx" class="py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg shrink-0 shadow flex items-center gap-1.5 transition cursor-pointer" title="Descarregar modelo Word para Creche &amp; Escola">
            <span>📥</span> <span>Descarregar .docx</span>
          </a>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- CARTÃO DE PRONTIDÃO DA MALA -->
      <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">${kit.icon}</span>
            <div>
              <h4 class="text-xs font-bold text-white">${kit.title}</h4>
              <p class="text-[10px] text-slate-400">${kit.desc}</p>
            </div>
          </div>
          <span class="text-xs font-bold font-mono text-emerald-400">${checkedCount}/${totalItems}</span>
        </div>

        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${percent}%;"></div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-slate-400">
          <span>Prontidão da mala: <strong>${percent}%</strong></span>
          <button type="button" id="btn-reset-kit" class="text-slate-400 hover:text-white underline cursor-pointer">Limpar seleção</button>
        </div>
      </div>

      ${institutionDocBanner}

      <!-- OPÇÃO RÁPIDA: COMPRAR MALA COMPLETA HOMOLOGADA -->
      <div class="p-2.5 bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/50 rounded-xl flex items-center justify-between gap-2.5 text-xs shadow-sm">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl shrink-0">🧰</span>
          <div class="min-w-0">
            <strong class="text-white text-xs block truncate">${mainKit.title}</strong>
            <span class="text-[10px] text-amber-200/90 block truncate">${mainKit.priceHint}</span>
          </div>
        </div>
        <a href="${mainKitUrl}" target="_blank" rel="noopener noreferrer nofollow" class="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg shrink-0 shadow flex items-center gap-1.5 transition cursor-pointer">
          <span>🛒</span> <span>Mala Completa</span>
        </a>
      </div>

      <!-- LISTA DE ITENS COM BOTÃO DIRETO DE COMPRA AMAZON -->
      <div class="space-y-1.5 mt-2">
        ${itemsHtml}
      </div>

      <p class="text-[9px] text-slate-500 leading-tight pt-2 text-center">
        Transparência: Links de afiliado Amazon (tag hfonte-21). Ao encomendar o material em falta através da app, o projeto recebe uma pequena comissão sem qualquer custo adicional para si, mantendo a aplicação 100% gratuita.
      </p>
    `;

    // Listeners de alternância nos itens
    container.querySelectorAll('.kit-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('.btn-item-buy') || e.target.closest('.btn-item-doc')) return;
        const id = row.dataset.id;
        savedState[id] = !savedState[id];
        localStorage.setItem(`first_aid_kit_${locationKey}`, JSON.stringify(savedState));
        renderKitChecklist(locationKey);
      });
    });

    container.querySelector('#btn-reset-kit')?.addEventListener('click', () => {
      if (confirm('Deseja reiniciar a verificação desta mala?')) {
        localStorage.removeItem(`first_aid_kit_${locationKey}`);
        renderKitChecklist(locationKey);
      }
    });

    // Limpar qualquer elemento legado de recomendações para manter o ecrã limpo
    const legacyBox = document.getElementById('kit-amazon-recommendations');
    if (legacyBox) legacyBox.innerHTML = '';
  }

  function initFirstAidKitChecklist() {
    document.querySelectorAll('.btn-kit-location-tab').forEach(b => {
      b.addEventListener('click', () => {
        const loc = b.dataset.location;
        if (loc) renderKitChecklist(loc);
      });
    });

    renderKitChecklist('casa');

    const btnQuickKit = document.getElementById('btn-quick-kit-checklist');
    if (btnQuickKit) {
      btnQuickKit.addEventListener('click', () => {
        const navBtn = document.querySelector('.bottom-nav button[data-target="screen-learning-hub"]');
        if (navBtn) navBtn.click();
        const ch = document.getElementById('chapter-kit-checklist');
        if (ch) {
          ch.classList.add('open');
          setTimeout(() => ch.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
        }
      });
    }
  }

  // ========================================================
  // MODAL EM INGLÊS & APOIO A TURISTAS (ENGLISH GUIDE)
  // ========================================================
  const modalEnglishGuide = document.getElementById('modal-english-guide');
  const btnToggleLang = document.getElementById('btn-toggle-lang');
  const btnCloseEnglishModal = document.getElementById('btn-close-english-modal');
  const btnDismissEnglish = document.getElementById('btn-dismiss-english');
  const enLocAddress = document.getElementById('en-loc-address');
  const enLocRef = document.getElementById('en-loc-ref');

  function openEnglishModal() {
    if (!modalEnglishGuide) return;
    const loc = GeoManager.currentLocation;
    if (enLocAddress) {
      enLocAddress.textContent = (loc.address && !loc.address.includes('A obter')) ? loc.address : 'GPS coordinates in Portugal';
    }
    if (enLocRef) {
      enLocRef.textContent = loc.landmark || 'Nearby local enterprise / landmark';
    }
    modalEnglishGuide.classList.remove('hidden');
  }

  function closeEnglishModal() {
    if (modalEnglishGuide) modalEnglishGuide.classList.add('hidden');
  }

  if (btnToggleLang) btnToggleLang.addEventListener('click', openEnglishModal);
  if (btnCloseEnglishModal) btnCloseEnglishModal.addEventListener('click', closeEnglishModal);
  if (btnDismissEnglish) btnDismissEnglish.addEventListener('click', closeEnglishModal);

  if (modalEnglishGuide) {
    modalEnglishGuide.addEventListener('click', (e) => {
      if (e.target === modalEnglishGuide) closeEnglishModal();
    });
  }

  // ========================================================
  // BARRA DE PESQUISA RÁPIDA NO HUB DE FORMAÇÃO
  // ========================================================
  function initLearningHubSearch() {
    const searchInput = document.getElementById('learning-hub-search-input');
    const clearBtn = document.getElementById('btn-clear-hub-search');
    const resultsInfo = document.getElementById('learning-search-results-info');
    const countEl = document.getElementById('learning-search-count');
    const resetBtn = document.getElementById('btn-reset-search-filter');
    const chapters = document.querySelectorAll('#screen-learning-hub .chapter-accordion');

    if (!searchInput || !chapters.length) return;

    function runSearch(query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) {
        chapters.forEach(ch => ch.classList.remove('hidden'));
        if (clearBtn) clearBtn.classList.add('hidden');
        if (resultsInfo) resultsInfo.classList.add('hidden');
        return;
      }

      if (clearBtn) clearBtn.classList.remove('hidden');
      if (resultsInfo) resultsInfo.classList.remove('hidden');

      let matches = 0;
      chapters.forEach(ch => {
        const text = (ch.innerText || ch.textContent || '').toLowerCase();
        if (text.includes(q)) {
          ch.classList.remove('hidden');
          ch.classList.add('open');
          matches++;
        } else {
          ch.classList.add('hidden');
          ch.classList.remove('open');
        }
      });

      if (countEl) {
        countEl.textContent = matches === 1 ? '1 capítulo encontrado' : `${matches} capítulos encontrados`;
      }
    }

    searchInput.addEventListener('input', (e) => runSearch(e.target.value));
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        runSearch('');
        searchInput.focus();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        runSearch('');
      });
    }

    const btnCollapseAll = document.getElementById('btn-collapse-all-chapters');
    const btnExpandAll = document.getElementById('btn-expand-all-chapters');
    if (btnCollapseAll) {
      btnCollapseAll.addEventListener('click', () => {
        chapters.forEach(ch => ch.classList.remove('open'));
      });
    }
    if (btnExpandAll) {
      btnExpandAll.addEventListener('click', () => {
        chapters.forEach(ch => ch.classList.add('open'));
      });
    }
  }

  // ========================================================
  // GUIA FALADO INTERATIVO COM FEEDBACK HUMANO BIDIRECIONAL
  // ========================================================
  const VOICE_COACH_PROTOCOLS = {
    ova: {
      steps: [
        {
          id: 'step1_pancadas',
          speech: 'Incline a vítima para a frente com apoio no peito. Aplique até 5 pancadas secas entre as omoplatas. Diga "já fiz", "desobstruiu" ou "ficou inconsciente".',
          display: '1. Incline a vítima para a frente com a mão de apoio no peito.<br>2. Aplique até <strong>5 pancadas secas entre as omoplatas</strong> com a base da mão.<br><span class="text-amber-300 font-bold">👉 Diga "Já fiz", "Desobstruiu" ou "Ficou inconsciente".</span>',
          quickReplies: [
            { label: '✓ Já fiz (não saiu)', action: 'step2_heimlich', cls: 'bg-amber-600 hover:bg-amber-500' },
            { label: '🎉 Desobstruiu!', action: 'resolved', cls: 'bg-emerald-600 hover:bg-emerald-500' },
            { label: '🚨 Ficou inconsciente!', action: 'unconscious', cls: 'bg-red-600 hover:bg-red-500 col-span-2' }
          ],
          triggers: {
            step2_heimlich: ['fiz', 'ja fiz', 'já fiz', 'feito', 'continua', 'nao saiu', 'não saiu', 'proximo', 'próximo'],
            resolved: ['desobstruiu', 'saiu', 'tosse', 'já tosse', 'ja tosse', 'respira', 'está a respirar', 'resolvido', 'melhorou'],
            unconscious: ['inconsciente', 'ficou inconsciente', 'desmaiou', 'caiu', 'parou', 'chao', 'chão', 'colapso', 'apagou']
          }
        },
        {
          id: 'step2_heimlich',
          speech: 'Coloque-se atrás da vítima. Feche o punho acima do umbigo e puxe com força para dentro e para cima até 5 vezes. Diga "já fiz", "desobstruiu" ou "ficou inconsciente".',
          display: '1. Coloque-se atrás da vítima.<br>2. Punho fechado entre o umbigo e o esterno.<br>3. Puxe com força para dentro e para cima até <strong>5 vezes (Heimlich)</strong>.<br><span class="text-amber-300 font-bold">👉 Diga "Já fiz", "Desobstruiu" ou "Ficou inconsciente".</span>',
          quickReplies: [
            { label: '↻ Repetir 5 pancadas', action: 'step1_pancadas', cls: 'bg-amber-600 hover:bg-amber-500' },
            { label: '🎉 Desobstruiu!', action: 'resolved', cls: 'bg-emerald-600 hover:bg-emerald-500' },
            { label: '🚨 Ficou inconsciente!', action: 'unconscious', cls: 'bg-red-600 hover:bg-red-500 col-span-2' }
          ],
          triggers: {
            step1_pancadas: ['fiz', 'ja fiz', 'já fiz', 'feito', 'continua', 'repetir', 'mais', 'nao saiu', 'não saiu'],
            resolved: ['desobstruiu', 'saiu', 'tosse', 'já tosse', 'ja tosse', 'respira', 'está a respirar', 'resolvido'],
            unconscious: ['inconsciente', 'ficou inconsciente', 'desmaiou', 'caiu', 'parou', 'chao', 'chão', 'apagou']
          }
        },
        {
          id: 'resolved',
          speech: 'Excelente! A via aérea está desobstruída. Mantenha a vítima sentada, calma e vigie a respiração normal.',
          display: '✅ <strong>Obstrução resolvida com sucesso!</strong><br>Mantenha a pessoa sentada, calma e observe a respiração. Se foram feitas compressões abdominais, deve ser avaliada por um médico.',
          quickReplies: [
            { label: '⏹ Concluir Guia por Voz', action: 'stop', cls: 'bg-slate-700 hover:bg-slate-600 col-span-2' }
          ]
        },
        {
          id: 'unconscious',
          speech: 'Atenção: Ampara a vítima até ao chão com cuidado. Liga 112 ou coloca em alta-voz de imediato. Vou abrir o suporte básico de vida para iniciares compressões no peito!',
          display: '🚨 <strong>VÍTIMA FICOU INCONSCIENTE!</strong><br>1. Amparar a vítima até ao chão sem bater com a cabeça.<br>2. Ligar 112 em alta-voz.<br>3. A abrir o metrónomo de SBV (30 compressões no centro do peito)...',
          quickReplies: [
            { label: 'Abrir Suporte Básico de Vida (SBV) ➔', action: 'go_sbv', cls: 'bg-red-600 hover:bg-red-500 col-span-2 font-black' }
          ]
        }
      ]
    },
    trauma: {
      steps: [
        {
          id: 'step1_pressao',
          speech: 'Aplique compressão direta e firme sobre o corte com uma compressa ou pano limpo. Mantenha sem aliviar. Diga "já parou", "continua a sangrar" ou "ficou inconsciente".',
          display: '1. Coloque compressas ou pano limpo sobre o ferimento.<br>2. Pressione com firmeza contínua durante 3 a 5 minutos sem aliviar.<br><span class="text-red-300 font-bold">👉 Diga "Já parou", "Continua a sangrar" ou "Ficou inconsciente".</span>',
          quickReplies: [
            { label: '🩸 Continua a sangrar', action: 'step2_garrote', cls: 'bg-red-600 hover:bg-red-500' },
            { label: '✓ Já parou o sangue', action: 'resolved', cls: 'bg-emerald-600 hover:bg-emerald-500' },
            { label: '🚨 Ficou inconsciente!', action: 'unconscious', cls: 'bg-red-700 hover:bg-red-600 col-span-2' }
          ],
          triggers: {
            step2_garrote: ['sangra', 'continua', 'continua a sangrar', 'muito sangue', 'jato', 'não para', 'nao para', 'ensopou'],
            resolved: ['parou', 'já parou', 'ja parou', 'controlado', 'estancou', 'pouco'],
            unconscious: ['inconsciente', 'ficou inconsciente', 'desmaiou', 'pálido', 'palido', 'caiu', 'apagou']
          }
        },
        {
          id: 'step2_garrote',
          speech: 'Se for num membro e o sangue jorrar em jato sem parar, aplique o torniquete comercial 5 a 7 centímetros acima do corte. Rode o molinete até parar o sangue. Diga "já apliquei", "estancou" ou "ficou inconsciente".',
          display: '1. Se for num membro com sangramento em jato contínuo, aplique o <strong>Torniquete (CAT)</strong> 5 a 7 cm acima da ferida.<br>2. Aperte e rode o molinete até parar o sangramento.<br>3. Registe a hora da aplicação.<br><span class="text-red-300 font-bold">👉 Diga "Já apliquei", "Estancou" ou "Ficou inconsciente".</span>',
          quickReplies: [
            { label: '⏱ Registar hora do Garrote', action: 'record_tourniquet', cls: 'bg-amber-600 hover:bg-amber-500' },
            { label: '✓ Estancou!', action: 'resolved', cls: 'bg-emerald-600 hover:bg-emerald-500' },
            { label: '🚨 Ficou inconsciente!', action: 'unconscious', cls: 'bg-red-700 hover:bg-red-600 col-span-2' }
          ],
          triggers: {
            record_tourniquet: ['apliquei', 'já apliquei', 'ja apliquei', 'garrote', 'torniquete', 'apertei', 'coloquei'],
            resolved: ['parou', 'estancou', 'já parou', 'ja parou', 'controlado'],
            unconscious: ['inconsciente', 'ficou inconsciente', 'desmaiou', 'caiu', 'chão', 'apagou']
          }
        },
        {
          id: 'resolved',
          speech: 'Muito bem. Hemorragia controlada. Mantenha a compressão com ligadura sem apertar em demasia. Cubra a vítima com manta para prevenir o choque.',
          display: '✅ <strong>Hemorragia sob controlo.</strong><br>1. Mantenha a compressão com ligadura.<br>2. Aqueça a vítima com manta térmica para prevenir choque.<br>3. Vigie pulso e respiração.',
          quickReplies: [
            { label: '⏹ Concluir Guia por Voz', action: 'stop', cls: 'bg-slate-700 hover:bg-slate-600 col-span-2' }
          ]
        },
        {
          id: 'unconscious',
          speech: 'Atenção: Deite a vítima no chão imediatamente. Mantenha a compressão da hemorragia. Se não responder e não respirar normalmente, inicie compressões torácicas no peito!',
          display: '🚨 <strong>VÍTIMA INCONSCIENTE!</strong><br>1. Deitar de costas no chão.<br>2. Manter a compressão da ferida.<br>3. Se não respirar normalmente, ligue 112 e inicie compressões torácicas imediatas.',
          quickReplies: [
            { label: 'Abrir Suporte Básico de Vida (SBV) ➔', action: 'go_sbv', cls: 'bg-red-600 hover:bg-red-500 col-span-2 font-black' }
          ]
        }
      ]
    }
  };

  function initInteractiveVoiceCoach() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    let coachRecognition = null;
    let isListening = false;
    let currentProtocol = null;
    let currentStepId = null;

    if (SpeechRec) {
      try {
        coachRecognition = new SpeechRec();
        coachRecognition.lang = 'pt-PT';
        coachRecognition.continuous = true;
        coachRecognition.interimResults = false;

        coachRecognition.onresult = (event) => {
          if (!currentProtocol || !currentStepId) return;
          const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
          console.log('[Voice Coach]:', transcript);

          const proto = VOICE_COACH_PROTOCOLS[currentProtocol];
          const step = proto.steps.find(s => s.id === currentStepId);
          if (!step || !step.triggers) return;

          for (const [action, keywords] of Object.entries(step.triggers)) {
            if (keywords.some(k => transcript.includes(k))) {
              handleCoachAction(action);
              break;
            }
          }
        };

        coachRecognition.onerror = (e) => {
          console.warn('[Voice Coach Error]:', e);
        };

        coachRecognition.onend = () => {
          if (isListening) {
            try { coachRecognition.start(); } catch (_) {}
          }
        };
      } catch (e) {
        console.warn('Voice coach SpeechRec unavailable:', e);
      }
    }

    function startListening() {
      if (!coachRecognition) return;
      isListening = true;
      try { coachRecognition.start(); } catch (_) {}
    }

    function pauseListening() {
      if (!coachRecognition) return;
      isListening = false;
      try { coachRecognition.stop(); } catch (_) {}
    }

    function renderCoachStep(protocolKey, stepId) {
      currentProtocol = protocolKey;
      currentStepId = stepId;

      const widget = document.getElementById(`voice-coach-${protocolKey}`);
      if (!widget) return;

      const panel = widget.querySelector('.voice-coach-panel');
      const bubble = widget.querySelector('.voice-coach-bubble');
      const actionsBox = widget.querySelector('.voice-coach-actions');
      const statusLbl = widget.querySelector('.status-lbl');
      const toggleBtn = widget.querySelector('.btn-start-voice-coach');

      if (panel) panel.classList.remove('hidden');
      if (toggleBtn) {
        toggleBtn.textContent = '⏹ Parar Guia';
        toggleBtn.classList.replace('bg-amber-500', 'bg-slate-700');
        toggleBtn.classList.replace('bg-red-600', 'bg-slate-700');
      }

      const proto = VOICE_COACH_PROTOCOLS[protocolKey];
      const step = proto.steps.find(s => s.id === stepId);
      if (!step) return;

      if (bubble) bubble.innerHTML = step.display;

      if (actionsBox) {
        actionsBox.innerHTML = '';
        step.quickReplies.forEach(qr => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `py-2 px-2.5 rounded-xl text-white font-bold text-xs shadow transition cursor-pointer text-center ${qr.cls || 'bg-slate-800'}`;
          btn.textContent = qr.label;
          btn.addEventListener('click', () => handleCoachAction(qr.action));
          actionsBox.appendChild(btn);
        });
      }

      // Fala a instrução e escuta a resposta
      pauseListening();
      if (statusLbl) statusLbl.textContent = 'A falar instrução... Aguarde.';

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(step.speech);
        utt.lang = 'pt-PT';
        utt.rate = 1.02;
        utt.onend = () => {
          startListening();
          if (statusLbl) statusLbl.textContent = '🎤 A ouvir... Diga uma resposta ou toque num botão:';
        };
        utt.onerror = () => {
          startListening();
          if (statusLbl) statusLbl.textContent = '🎤 A ouvir... Diga uma resposta ou toque num botão:';
        };
        window.speechSynthesis.speak(utt);
      } else {
        startListening();
        if (statusLbl) statusLbl.textContent = '🎤 A ouvir... Diga uma resposta ou toque num botão:';
      }
    }

    function handleCoachAction(action) {
      if (action === 'stop') {
        stopCoach(true);
        return;
      }
      if (action === 'unconscious' || action === 'go_sbv') {
        renderCoachStep(currentProtocol, 'unconscious');
        const delay = (action === 'unconscious') ? 1600 : 0;
        setTimeout(() => {
          stopCoach(false);
          AudioManager.initContext();
          navigateTo('screen-sbv');
          startSBV();
        }, delay);
        return;
      }
      if (action === 'record_tourniquet') {
        const btnT = document.getElementById('btn-tourniquet-start');
        if (btnT) btnT.click();
        renderCoachStep(currentProtocol, 'resolved');
        return;
      }

      renderCoachStep(currentProtocol, action);
    }

    function stopCoach(cancelVoice = true) {
      pauseListening();
      if (cancelVoice && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      document.querySelectorAll('.interactive-voice-coach-card').forEach(widget => {
        const panel = widget.querySelector('.voice-coach-panel');
        if (panel) panel.classList.add('hidden');
        const toggleBtn = widget.querySelector('.btn-start-voice-coach');
        if (toggleBtn) {
          const proto = toggleBtn.dataset.protocol;
          toggleBtn.textContent = '▶ Iniciar Guia por Voz';
          if (proto === 'ova') {
            toggleBtn.className = 'btn-start-voice-coach px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1';
          } else {
            toggleBtn.className = 'btn-start-voice-coach px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1';
          }
        }
      });
      currentProtocol = null;
      currentStepId = null;
    }

    document.querySelectorAll('.btn-start-voice-coach').forEach(btn => {
      btn.addEventListener('click', () => {
        const proto = btn.dataset.protocol;
        if (currentProtocol === proto) {
          stopCoach();
        } else {
          const initialStep = proto === 'ova' ? 'step1_pancadas' : 'step1_pressao';
          renderCoachStep(proto, initialStep);
        }
      });
    });

    document.querySelectorAll('.btn-stop-voice-coach').forEach(btn => {
      btn.addEventListener('click', stopCoach);
    });
  }

  // ========================================================
  // TELEMETRIA PWA & INSTALAÇÃO NO ECRÃ PRINCIPAL (GOOGLE ANALYTICS)
  // ========================================================
  function initPWAInstallAndTracking() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const urlParams = new URLSearchParams(window.location.search);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true ||
                         urlParams.get('utm_source') === 'homescreen' ||
                         urlParams.get('source') === 'pwa';

    // 1. Registo de abertura via Ecrã Principal no Google Analytics
    if (isStandalone) {
      if (typeof gtag === 'function') {
        try {
          gtag('event', 'pwa_open_standalone', {
            event_category: 'PWA',
            event_label: 'Abertura via Ecrã Principal',
            platform: isIos ? 'ios_homescreen' : 'standalone_pwa',
            non_interaction: true
          });
          gtag('set', 'user_properties', {
            app_platform: isIos ? 'ios_pwa' : 'android_pwa',
            is_installed_pwa: 'true'
          });
        } catch (_) {}
      }
      // Se já está a correr a partir do ecrã principal, nunca exibir o banner de instalação
      return;
    }

    const installBanner = document.getElementById('pwa-install-banner');
    const btnTriggerInstall = document.getElementById('btn-trigger-pwa-install');
    const btnDismissBanner = document.getElementById('btn-dismiss-pwa-banner');
    const modalIosGuide = document.getElementById('modal-ios-install-guide');
    const btnCloseIosGuide = document.getElementById('btn-close-ios-install');
    const btnAckIosGuide = document.getElementById('btn-ack-ios-install');
    const btnManualInstall = document.getElementById('btn-manual-install-app');

    const isBannerDismissed = localStorage.getItem('pwa_banner_dismissed_v53');
    let deferredPrompt = null;

    // 2. Capturar evento nativo do navegador para instalação PWA (Android / Chrome / Edge)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBanner && !isBannerDismissed) {
        installBanner.classList.remove('hidden');
      }
      if (typeof gtag === 'function') {
        try {
          gtag('event', 'pwa_prompt_available', { event_category: 'PWA' });
        } catch (_) {}
      }
    });

    // 3. No Safari / iOS, exibir banner se ainda não foi descartado
    if (isIos && installBanner && !isBannerDismissed) {
      installBanner.classList.remove('hidden');
    }

    // 4. Ação ao carregar em "Instalar" / "Adicionar"
    async function triggerInstallFlow() {
      if (typeof gtag === 'function') {
        try {
          gtag('event', 'pwa_banner_click', {
            event_category: 'PWA',
            event_label: 'Clique em Instalar App'
          });
        } catch (_) {}
      }

      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (typeof gtag === 'function') {
          try {
            gtag('event', 'pwa_prompt_response', {
              event_category: 'PWA',
              outcome: choice.outcome
            });
          } catch (_) {}
        }
        deferredPrompt = null;
        if (installBanner) installBanner.classList.add('hidden');
      } else if (isIos) {
        if (modalIosGuide) modalIosGuide.classList.remove('hidden');
        if (typeof gtag === 'function') {
          try {
            gtag('event', 'pwa_ios_guide_viewed', { event_category: 'PWA' });
          } catch (_) {}
        }
      } else {
        alert('Para adicionar esta aplicação ao seu ecrã:\n\n• No telemóvel: abra o menu do navegador (três pontos ou partilhar) e toque em "Adicionar ao ecrã inicial" ou "Instalar aplicação".\n• No computador: clique no ícone de instalação na barra de endereço.');
      }
    }

    if (btnTriggerInstall) btnTriggerInstall.addEventListener('click', triggerInstallFlow);
    if (btnManualInstall) btnManualInstall.addEventListener('click', triggerInstallFlow);

    // 5. Descartar banner
    if (btnDismissBanner) {
      btnDismissBanner.addEventListener('click', () => {
        if (installBanner) installBanner.classList.add('hidden');
        localStorage.setItem('pwa_banner_dismissed_v53', 'true');
        if (typeof gtag === 'function') {
          try {
            gtag('event', 'pwa_banner_dismiss', { event_category: 'PWA' });
          } catch (_) {}
        }
      });
    }

    // 6. Fechar modal iOS
    if (btnCloseIosGuide) {
      btnCloseIosGuide.addEventListener('click', () => {
        if (modalIosGuide) modalIosGuide.classList.add('hidden');
      });
    }
    if (btnAckIosGuide) {
      btnAckIosGuide.addEventListener('click', () => {
        if (modalIosGuide) modalIosGuide.classList.add('hidden');
        if (installBanner) installBanner.classList.add('hidden');
        localStorage.setItem('pwa_banner_dismissed_v53', 'true');
      });
    }
    if (modalIosGuide) {
      modalIosGuide.addEventListener('click', (e) => {
        if (e.target === modalIosGuide) modalIosGuide.classList.add('hidden');
      });
    }

    // 7. Evento de instalação concluída com sucesso (Android / Chrome)
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      if (installBanner) installBanner.classList.add('hidden');
      localStorage.setItem('pwa_banner_dismissed_v53', 'true');
      if (typeof gtag === 'function') {
        try {
          gtag('event', 'pwa_install', {
            event_category: 'PWA',
            event_label: 'App Instalada com Sucesso no Ecrã Principal',
            platform: isIos ? 'ios' : 'android',
            value: 1
          });
        } catch (_) {}
      }
    });
  }

  // Inicializar novos módulos
  initCabulaSbar();
  initHandsFreeVoice();
  initClinicalSimulator();
  initFirstAidKitChecklist();
  initLearningHubSearch();
  initInteractiveVoiceCoach();
  initPWAInstallAndTracking();

  window.triggerGeoDemo = () => {
    GeoManager.simulateDemo((loc) => updateGeoUI(loc));
  };
});
