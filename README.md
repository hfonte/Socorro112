# Socorro 112 · TAS & Suporte Básico de Vida (PWA)

Aplicação web progressiva (PWA) de utilidade pública e suporte comunitário a situações de emergência pré-hospitalar e autoestudo clínico, desenvolvida de acordo com as diretrizes do **Conselho Europeu de Ressuscitação (ERC 2025)**, do **INEM** e os manuais de **Tripulante de Ambulância de Socorro (TAS / UFCD 9988)**.

---

## 🌟 Principais Funcionalidades

### 1. Central de Emergência & Ação Rápida
- **Acionamento 112 com 1 Toque:** Marcador rápido para o Número Europeu de Emergência (`tel:112`).
- **Geolocalização & Cábula CODU:** Apresenta a morada exata, coordenadas GPS e pontos de referência imediatos para transmissão sem pânico ao operador do 112.
- **Protocolo de Alta-Voz:** Alerta visual proeminente para colocação do telemóvel em alta-voz no chão junto à vítima, mantendo as mãos livres.

### 2. Suporte Básico de Vida (SBV) & DAE
- **Metrónomo Acústico & Visual (110 bpm):** Ritmo rigoroso segundo as normas ERC 2025 para compressões torácicas eficazes (5 a 6 cm).
- **SBV Adulto (Rácio 30:2):** Temporizador de ciclo e alerta vocal de rotação de reanimadores aos 2 minutos por fadiga muscular, mantendo compressões contínuas sem interrupções.
- **SBV Pediátrico Especializado:** 5 insuflações iniciais obrigatórias, rácio 15:2 e adaptação da profundidade e técnica (lactente vs criança).
- **Desfibrilhação Automática Externa (DAE):** Passos guiados para colocação de elétrodos e segurança no choque.

### 3. Obstrução da Via Aérea (OVA / Asfixia)
- **Despiste Tosse Eficaz vs Ineficaz:** Proteção contra manobras intempestivas.
- **Sequência 5 Pancadas Interescapulares + 5 Compressões de Heimlich.**
- **Casos Especiais 2025:** Contraindicação formal de Heimlich em lactentes (< 1 ano) e grávidas, substituindo por compressões torácicas.
- **Algoritmo de Perda de Consciência:** Transição imediata para 30 compressões de SBV.

### 4. Protocolos Clínicos de TAS
- **Dispneia & Falta de Ar:** Posicionamento de Fowler (semi-sentado a 45º), arejamento e sinais de alarme.
- **Suspeita de AVC:** Escala dos 3 Fs (Face, Força, Fala) e relógio de início de sintomas para ativação da Via Verde AVC.
- **Trauma & Hemorragia Grave:** Compressão direta, penso compressivo e protocolo de garrote/torniquete comercial (5-7 cm acima da lesão com hora).
- **Queimaduras:** Cronómetro de arrefecimento com água tépida/fria (15 min), classificação visual (1º, 2º e 3º grau) e proibições clínicas.
- **Crise Convulsiva & PLS:** Cronómetro de duração de crise, proteção craniana sem prender a língua e Posição Lateral de Segurança pós-crise.

### 5. Motor de IA Multimodal com RAG (Retrieval-Augmented Generation)
- **Base de Conhecimento Clínica Local:** Indexação direta de 12 módulos oficiais dos Manuais UFCD 9988 / TAS.
- **Triagem em 4 Blocos Rigorosos:** Diagnóstico, 3 Ações Prioritárias, Proibições Críticas e Conduta 112.
- **Afunilamento de Triagem com 1 Toque:** Botões interativos de resposta rápida para despiste de gravidade.
- **Modo de Contingência:** Se os servidores da Google estiverem offline ou em pico de tráfego, o motor RAG debita as diretrizes diretamente do manual local sem falhar.

### 6. Ficha Médica ICE (In Case of Emergency) & Partilha Familiar
- **100% Privado:** Armazenamento local no dispositivo (`localStorage`), sem criação de contas, emails ou servidores de terceiros.
- **História Clínica SAMPLE:** Tipo de sangue, alergias conhecidas, doenças crónicas e medicação habitual.
- **Personalização da IA:** A IA integra automaticamente o perfil médico nos diagnósticos.
- **Partilha Direta por SMS:** Envio com 1 toque de relatórios clínicos e localização GPS ao contacto de emergência, sem alarmismos desnecessários.

### 7. Hub de Formação & Autoestudo
- 8 capítulos interativos expandíveis em acordeão com esquemas e ilustrações.
- **Quiz Clínico Dinâmico:** Sorteio aleatório de 5 questões a partir de um banco de 22 perguntas de avaliação, com baralhamento de alternativas.

---

## 🔒 Arquitetura & Segurança
- **Tecnologia:** HTML5 semântico, Tailwind CSS, JavaScript Modular (ES6+), Web Audio API, Service Worker (PWA Cache-First / Network-First).
- **Sem Dependências Pesadas:** Funciona 100% offline em qualquer navegador moderno (Chrome, Safari, Firefox, Edge) e em qualquer smartphone (iOS e Android).
- **Isenção de Responsabilidade Médica:** Aviso legal proeminente e conformidade com as boas práticas de saúde comunitária.

---

## 👨‍🏫 Autoria e Créditos
**Thinked by Hugo Fonte**  
*Socorro 112 · Suporte Pré-Hospitalar & Primeiros Socorros*
