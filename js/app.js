// LÓGICA PRINCIPAL DA APLICAÇÃO PROTOCOLO TAS & SUPORTE CLÍNICO PRÉ-HOSPITALAR (INEM / ERC 2025)
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const AppState = {
    currentScreen: 'screen-emergency',
    isEmergencyMode: true,
    isAdult: true,
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

  function updateGeoUI(loc) {
    document.querySelectorAll('.geo-address-display').forEach(el => el.textContent = loc.address);
    document.querySelectorAll('.geo-coords-display').forEach(el => el.textContent = `${loc.lat || '--'}, ${loc.lon || '--'}`);
    document.querySelectorAll('.geo-landmark-display').forEach(el => el.textContent = loc.landmark);
    document.querySelectorAll('.geo-codu-script').forEach(el => el.textContent = GeoManager.getCoduSpeechScript('Emergência Médica / Traumatismo'));
  }

  // NAVEGAÇÃO DE ECRÃS
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
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.closest('.chapter-accordion');
      const wasOpen = parent.classList.contains('open');
      
      // Opcional: fechar outros ou permitir múltiplos
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
      question: "Perante um lactente (< 1 ano) com asfixia grave (tosse ineficaz), qual é a conduta correta de desobstrução (ERC 2025)?",
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
      question: "No Suporte Básico de Vida (SBV) Pediátrico segundo as diretrizes ERC 2025, qual é o primeiro passo obrigatório após confirmar a ausência de respiração?",
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

  window.onBeatTick = () => {
    AppState.beats++;
    if (labelBeats) labelBeats.textContent = AppState.beats;

    const cycleSize = AppState.isAdult ? 30 : 15;
    if (AppState.beats % cycleSize === 0) {
      AppState.cycles++;
      if (labelCycles) labelCycles.textContent = AppState.cycles;
    }
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

    AudioManager.speak('Iniciando compressões no centro do peito. Acompanhe o ritmo.');
  }

  function pauseSBV() {
    AppState.sbvActive = false;
    AudioManager.stopMetronome();
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
    if (labelBeats) labelBeats.textContent = '0';
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
            imgPreview.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(file);
      }
    });
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
        formattedHtml += `<div class="mt-3 mb-1 text-purple-400 font-black text-sm flex items-center gap-1.5 border-b border-purple-800/60 pb-1">❓ Afunilamento de Gravidade (Responda num toque):</div>`;
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

      if (clean.includes('Opções:') || (clean.includes('?') && clean.includes('Sim'))) {
        const questionText = clean.replace(/^-?\s*(Pergunta:)?\s*/i, '').replace(/Opções:.*$/i, '').trim();
        formattedHtml += `
          <div class="my-2 p-2 bg-slate-900 border border-slate-700 rounded-lg">
            <p class="text-xs text-yellow-300 font-semibold mb-1.5">${questionText}</p>
            <div class="flex items-center gap-2">
              <button type="button" class="triage-quick-chip bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-600 px-3 py-1 rounded text-[11px] font-bold" data-resp="Sim (${questionText})">✅ Sim</button>
              <button type="button" class="triage-quick-chip bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-3 py-1 rounded text-[11px] font-bold" data-resp="Não (${questionText})">❌ Não</button>
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

    return formattedHtml;
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
        btnAskAI.textContent = '⏳ A contactar triagem médica...';
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

          aiResponseBox.querySelectorAll('.triage-quick-chip').forEach(chip => {
            chip.addEventListener('click', () => {
              const resp = chip.dataset.resp;
              aiTextPrompt.value += `\n[Despiste de Triagem: ${resp}]`;
              btnAskAI.click();
            });
          });
        }
      } catch (err) {
        if (aiResponseBox) {
          aiResponseBox.innerHTML = `<span class="text-red-400 font-bold">Erro: ${err.message}. Em dúvida, ligue 112 imediatamente.</span>`;
        }
      } finally {
        if (aiLoading) aiLoading.classList.add('hidden');
        if (btnAskAI) {
          btnAskAI.disabled = false;
          btnAskAI.classList.remove('opacity-50', 'pointer-events-none');
          btnAskAI.textContent = '🔍 Analisar com Diretrizes Médicas';
        }
      }
    });
  }

  // GESTÃO DO DISCLAIMER MÉDICO E LEGAL
  const disclaimerBanner = document.getElementById('app-legal-disclaimer');
  const btnDismissDisclaimer = document.getElementById('btn-dismiss-disclaimer');
  const btnShowDisclaimer = document.getElementById('btn-show-disclaimer');

  if (btnDismissDisclaimer && disclaimerBanner) {
    btnDismissDisclaimer.addEventListener('click', () => {
      disclaimerBanner.classList.add('hidden');
      sessionStorage.setItem('disclaimer_closed', 'true');
    });
    if (sessionStorage.getItem('disclaimer_closed') === 'true') {
      disclaimerBanner.classList.add('hidden');
    }
  }

  if (btnShowDisclaimer && disclaimerBanner) {
    btnShowDisclaimer.addEventListener('click', () => {
      disclaimerBanner.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ========================================================
  // MÓDULO: FICHA MÉDICA ICE & PARTILHA COM FAMILIAR
  // ========================================================
  function getMedicalId() {
    try {
      return JSON.parse(localStorage.getItem('user_medical_id') || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveMedicalId(data) {
    localStorage.setItem('user_medical_id', JSON.stringify(data));
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

      if (elName) elName.textContent = data.name ? `${data.name} ${data.age ? '(' + data.age + ')' : ''}` : 'Vítima Registada';
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
      if (headerStatus) headerStatus.textContent = 'Alergias & Familiar';
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
      alert('Ficha Médica ICE guardada com sucesso no telemóvel!');
      navigateTo('screen-emergency');
    });
  }

  updateMedicalIdUI();

  // Partilha de descobertas clínicas com Familiar (ICE) com GPS, Google Maps e Waze
  function shareClinicalUpdateWithICE(mode = 'info') {
    const ice = getMedicalId();
    if (!ice.contactPhone) {
      alert('Para partilhar com o seu familiar, configure primeiro o contacto de emergência na Ficha Médica ICE.');
      navigateTo('screen-medical-id');
      return;
    }

    const aiText = document.getElementById('ai-response-box')?.innerText || '';
    let diagSummary = 'Triagem clínica efetuada.';
    const diagMatch = aiText.match(/DIAGNÓSTICO E GRAVIDADE:?([^\n\r]+)/i);
    if (diagMatch && diagMatch[1]) {
      diagSummary = diagMatch[1].replace(/\[Fonte:[^\]]+\]/gi, '').trim();
    }

    // Obter localização instantaneamente sem bloqueio assíncrono ou rede
    const loc = GeoManager.currentLocation;
    const lat = loc.lat || (typeof localStorage !== 'undefined' ? localStorage.getItem('cached_gps_lat') : null);
    const lon = loc.lon || (typeof localStorage !== 'undefined' ? localStorage.getItem('cached_gps_lon') : null);
    const address = (loc.address && !loc.address.includes('A obter') && !loc.address.includes('não suportado'))
      ? loc.address
      : (typeof localStorage !== 'undefined' ? (localStorage.getItem('cached_gps_address') || '') : '');

    let locLine = '';
    if (lat && lon) {
      const latShort = Number(lat).toFixed(4);
      const lonShort = Number(lon).toFixed(4);
      const mapPinUrl = `https://maps.google.com/?q=${latShort},${lonShort}`;
      const addressShort = address ? `\n📍 Local: ${address}` : '';
      locLine = `${addressShort}\n🗺️ Ver no Mapa: ${mapPinUrl}`;
    } else if (address) {
      locLine = `\n📍 Local: ${address}`;
    }

    const patientName = ice.name || 'Eu';
    const contactName = ice.contactName || 'Familiar';
    let messageBody = '';

    if (mode === 'urgent') {
      messageBody = `🚨 ALERTA DE EMERGÊNCIA (Protocolo TAS): Situação urgente (${patientName}).\n- Situação: ${diagSummary}${locLine}\n- 112 solicitado/em curso. Por favor vem ter comigo.`;
    } else {
      messageBody = `Olá ${contactName}, ponto de situação clínica via Protocolo TAS:\n- Avaliação: ${diagSummary}${locLine}\nEncontro-me estável a vigiar sintomas. Contactarei se precisar.`;
    }

    const rawPhone = ice.contactPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    const cleanDigits = rawPhone.replace(/\+/g, '');
    let waPhone = cleanDigits;
    if (cleanDigits.length === 9 && cleanDigits.startsWith('9')) {
      waPhone = '351' + cleanDigits;
    }

    const encoded = encodeURIComponent(messageBody);

    // Formato universal iOS vs Android
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

    // Se for smartphone / tátil, abrir logo o intent de SMS
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

  if (btnShareInfo) {
    btnShareInfo.addEventListener('click', () => shareClinicalUpdateWithICE('info'));
  }
  if (btnShareUrgent) {
    btnShareUrgent.addEventListener('click', () => shareClinicalUpdateWithICE('urgent'));
  }

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

  window.triggerGeoDemo = () => {
    GeoManager.simulateDemo((loc) => updateGeoUI(loc));
  };
});
