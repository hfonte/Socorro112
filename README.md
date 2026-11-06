# Cuidar em Emergência · Guia Prático de Primeiros Socorros (PWA)

Aplicação web progressiva (PWA) inclusiva, comunitária e universal para suporte prático a situações de emergência e formação em primeiros socorros. Desenhada para ser acessível a qualquer cidadão, família, cuidadores em ERPI (Estruturas Residenciais para Pessoas Idosas), escolas e formandos, mantendo o mais rigoroso alinhamento com as diretrizes do **Conselho Europeu de Ressuscitação (Diretrizes Oficiais ERC 2025 • em vigor)** e do **INEM**.

---

## 🌟 Principais Funcionalidades

### 1. Central de Emergência & Ação Rápida
- **Acionamento 112 com 1 Toque:** Marcador rápido para o Número Europeu de Emergência (`tel:112`).
- **Geolocalização & Cábula CODU:** Apresenta a morada exata, coordenadas GPS e pontos de referência imediatos para transmissão sem pânico ao operador do 112.
- **Protocolo de Alta-Voz:** Alerta visual proeminente para colocação do telemóvel em alta-voz no chão junto à vítima, mantendo as mãos livres.

### 2. Pediatria & Lactentes (Módulo Dedicado)
- **Triângulo de Avaliação Pediátrica (TAP):** Avaliação de 30-60s da Aparência (TICOS), Trabalho Respiratório e Circulação Cutânea com matriz de decisão clínica.
- **Sinais Vitais Normais por Faixa Etária:** Seletor interativo para Lactente (<1 ano), Criança Pequena (1-5 anos), Escolar (6-12 anos) e Adolescente (>12 anos) com FC, FR, PAS e notas anatómicas.
- **Patologias Pediátricas Frequentes:** Crupe / Laringite Estridulosa, Bronquiolite Aguda (VSR), Convulsão Febril, Desidratação Aguda no Bebé, Petéquias / Púrpura (Meningite/Sépsis com Teste da Vitropressão do Copo de Vidro).
- **Asfixia & SBV Pediátrico ERC 2025 (PBLS):** 5 pancadas + 5 compressões no lactente (Heimlich estritamente proibido), e 5 insuflações iniciais de resgate.

### 3. Suporte Básico de Vida (SBV) & DAE • Framework 3-C (ERC 2025)
- **Framework Oficial 3-C:** Check (Segurança e Consciência/VOS) ➔ Call 112 (Alta-Voz e T-CPR) ➔ Compressions & AED (100-120 bpm e DAE precoce).
- **Metrónomo Acústico & Visual (110 bpm):** Ritmo sintetizado via Web Audio API para compressões torácicas eficazes (5 a 6 cm).
- **SBV Adulto (Rácio 30:2):** Temporizador de ciclo e alerta vocal de rotação de reanimadores aos 2 minutos por fadiga muscular, mantendo compressões contínuas sem interrupções.
- **SBV Pediátrico Especializado:** 5 insuflações iniciais obrigatórias, rácio 15:2 e adaptação da profundidade e técnica (lactente vs criança).
- **Desfibrilhação Automática Externa (DAE):** Passos guiados para colocação de elétrodos e segurança no choque.

### 4. Obstrução da Via Aérea (OVA / Asfixia ERC 2025)
- **Despiste Tosse Eficaz vs Ineficaz:** Proteção contra manobras intempestivas.
- **Sequência 5 Pancadas Interescapulares + 5 Compressões de Heimlich.**
- **Casos Especiais (ERC 2025):** Contraindicação formal de Heimlich em lactentes (< 1 ano) e grávidas, substituindo por compressões torácicas.
- **Algoritmo de Perda de Consciência:** Transição imediata para 30 compressões de SBV.

### 5. Motor de IA Multimodal com RAG & Follow-up com Reavaliação Clínica
- **Base de Conhecimento Clínica Local:** Indexação direta de 21 módulos oficiais dos Manuais UFCD 9988 / TAS / INEM e Diretrizes ERC 2025.
- **Triagem em 4 Blocos Rigorosos:** Diagnóstico, 3 Ações Prioritárias, Proibições Críticas e Conduta 112 / Linha SNS 24.
- **Temporizador de Monitorização & Reavaliação Clínica:** Se o algoritmo indicar repouso ou observação, ativa um temporizador configurável (5, 10, 15, 20 min) com aviso sonoro (chime) e questionário interativo de evolução clínica (🟢 Melhorou / 🟡 Mantém-se igual com SNS 24 / 🔴 Piorou com alarme sonoro e escalada 112).
- **Modo de Contingência:** Se os servidores da Google estiverem offline ou em pico de tráfego, o motor RAG debita as diretrizes diretamente do manual local sem falhar.

### 6. Ficha Médica ICE (In Case of Emergency) & Partilha Familiar
- **100% Privado:** Armazenamento local no dispositivo (`localStorage`), sem criação de contas, emails ou servidores de terceiros.
- **História Clínica SAMPLE:** Tipo de sangue, alergias conhecidas, doenças crónicas e medicação habitual.
- **Personalização da IA:** A IA integra automaticamente o perfil médico nos diagnósticos.
- **Partilha Direta por SMS:** Envio com 1 toque de relatórios clínicos e localização GPS ao contacto de emergência, sem alarmismos desnecessários.

### 7. Hub de Formação & Autoestudo
- 11 capítulos interativos expandíveis em acordeão com esquemas clínicos, ilustrações e capítulo pediátrico dedicado.
- **Quiz Clínico Dinâmico:** Sorteio aleatório de 5 questões a partir de um banco de 25 perguntas de avaliação técnica, com baralhamento de alternativas.

---

## 🔒 Arquitetura & Segurança
- **Tecnologia:** HTML5 semântico, Tailwind CSS, JavaScript Modular (ES6+), Web Audio API, Service Worker (PWA Cache-First / Network-First).
- **Sem Dependências Pesadas:** Funciona 100% offline em qualquer navegador moderno (Chrome, Safari, Firefox, Edge) e em qualquer smartphone (iOS e Android).
- **Isenção de Responsabilidade Médica:** Aviso legal proeminente e conformidade com as boas práticas de saúde comunitária.

---

## 👨‍🏫 Autoria e Créditos
**Thinked by Hugo Fonte**  
*Cuidar em Emergência · Guia Prático de Primeiros Socorros & Apoio Comunitário*
