#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de Minutas Word (.docx) Oficiais para o Socorro 112
- Ficha Médica Individualizada de Emergência (ERPI / Lar de Idosos)
- Plano Individual de Saúde e Emergência (Creche & Escola)
Produz ficheiros standard OpenXML com escape XML rigoroso.
"""

import io
import os
import zipfile
import xml.sax.saxutils as saxutils

def esc(text):
    if text is None:
        return ""
    return saxutils.escape(str(text))

def create_docx(filename, title, subtitle, disclaimer, sections, accent_color="0F766E"):
    """
    Gera um ficheiro .docx com formatação limpa e profissional.
    accent_color: cor primária em hexadecimal (sem #)
    """
    doc_xml = []
    doc_xml.append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
    doc_xml.append('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">')
    doc_xml.append('<w:body>')

    # 1. CABEÇALHO DO DOCUMENTO
    doc_xml.append(f'''
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="18"/>
          <w:color w:val="64748B"/>
        </w:rPr>
        <w:t xml:space="preserve">SISTEMA DE EMERGÊNCIA &amp; PRIMEIROS SOCORROS • SOCORRO 112</w:t>
      </w:r>
    </w:p>
    ''')

    # Título Principal
    doc_xml.append(f'''
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="60" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="32"/>
          <w:color w:val="{accent_color}"/>
        </w:rPr>
        <w:t xml:space="preserve">{esc(title)}</w:t>
      </w:r>
    </w:p>
    ''')

    # Subtítulo
    doc_xml.append(f'''
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="160"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:i/>
          <w:sz w:val="20"/>
          <w:color w:val="475569"/>
        </w:rPr>
        <w:t xml:space="preserve">{esc(subtitle)}</w:t>
      </w:r>
    </w:p>
    ''')

    # 2. CAIXA DE DISCLAIMER (Destaque Ambar / Aviso)
    doc_xml.append(f'''
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9600" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="12" w:space="0" w:color="D97706"/>
          <w:left w:val="single" w:sz="24" w:space="0" w:color="D97706"/>
          <w:bottom w:val="single" w:sz="12" w:space="0" w:color="D97706"/>
          <w:right w:val="single" w:sz="12" w:space="0" w:color="D97706"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="140" w:type="dxa"/>
          <w:left w:w="200" w:type="dxa"/>
          <w:bottom w:w="140" w:type="dxa"/>
          <w:right w:w="200" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="9600" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="FEF3C7"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="40" w:after="40"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:b/>
                <w:sz w:val="19"/>
                <w:color w:val="92400E"/>
              </w:rPr>
              <w:t xml:space="preserve">AVISO IMPORTANTE / MODELO ORIENTATIVO: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:sz w:val="18"/>
                <w:color w:val="78350F"/>
              </w:rPr>
              <w:t xml:space="preserve">{esc(disclaimer)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    ''')

    doc_xml.append('<w:p><w:pPr><w:spacing w:before="120" w:after="80"/></w:pPr></w:p>')

    # 3. SEÇÕES DO DOCUMENTO
    for sec in sections:
        sec_title = sec.get("title", "")
        sec_type = sec.get("type", "table")
        is_alert = sec.get("alert", False)
        sec_header_bg = "DC2626" if is_alert else accent_color

        doc_xml.append(f'''
        <w:p>
          <w:pPr>
            <w:spacing w:before="180" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="22"/>
              <w:color w:val="{sec_header_bg}"/>
            </w:rPr>
            <w:t xml:space="preserve">{esc(sec_title)}</w:t>
          </w:r>
        </w:p>
        ''')

        if sec_type == "key_value_table":
            rows = sec.get("rows", [])
            doc_xml.append(f'''
            <w:tbl>
              <w:tblPr>
                <w:tblW w:w="9600" w:type="dxa"/>
                <w:tblBorders>
                  <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                  <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                </w:tblBorders>
                <w:tblCellMar>
                  <w:top w:w="100" w:type="dxa"/>
                  <w:left w:w="140" w:type="dxa"/>
                  <w:bottom w:w="100" w:type="dxa"/>
                  <w:right w:w="140" w:type="dxa"/>
                </w:tblCellMar>
              </w:tblPr>
            ''')
            for r in rows:
                k1, v1 = r[0], r[1]
                has_col2 = len(r) >= 4
                if has_col2:
                    k2, v2 = r[2], r[3]
                    doc_xml.append(f'''
                    <w:tr>
                      <w:tc>
                        <w:tcPr><w:tcW w:w="2200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
                        <w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="18"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">{esc(k1)}:</w:t></w:r></w:p>
                      </w:tc>
                      <w:tc>
                        <w:tcPr><w:tcW w:w="2600" w:type="dxa"/></w:tcPr>
                        <w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">{esc(v1)}</w:t></w:r></w:p>
                      </w:tc>
                      <w:tc>
                        <w:tcPr><w:tcW w:w="2200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
                        <w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="18"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">{esc(k2)}:</w:t></w:r></w:p>
                      </w:tc>
                      <w:tc>
                        <w:tcPr><w:tcW w:w="2600" w:type="dxa"/></w:tcPr>
                        <w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">{esc(v2)}</w:t></w:r></w:p>
                      </w:tc>
                    </w:tr>
                    ''')
                else:
                    doc_xml.append(f'''
                    <w:tr>
                      <w:tc>
                        <w:tcPr><w:tcW w:w="2600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
                        <w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="18"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">{esc(k1)}:</w:t></w:r></w:p>
                      </w:tc>
                      <w:tc>
                        <w:tcPr><w:gridSpan w:val="3"/><w:tcW w:w="7000" w:type="dxa"/></w:tcPr>
                        <w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">{esc(v1)}</w:t></w:r></w:p>
                      </w:tc>
                    </w:tr>
                    ''')
            doc_xml.append('</w:tbl>')

        elif sec_type == "data_table":
            headers = sec.get("headers", [])
            col_widths = sec.get("col_widths", [2400] * len(headers))
            rows = sec.get("rows", [])

            doc_xml.append(f'''
            <w:tbl>
              <w:tblPr>
                <w:tblW w:w="9600" w:type="dxa"/>
                <w:tblBorders>
                  <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                  <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                </w:tblBorders>
                <w:tblCellMar>
                  <w:top w:w="100" w:type="dxa"/>
                  <w:left w:w="120" w:type="dxa"/>
                  <w:bottom w:w="100" w:type="dxa"/>
                  <w:right w:w="120" w:type="dxa"/>
                </w:tblCellMar>
              </w:tblPr>
              <w:tr>
            ''')
            for i, h in enumerate(headers):
                w = col_widths[i]
                doc_xml.append(f'''
                <w:tc>
                  <w:tcPr><w:tcW w:w="{w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="{sec_header_bg}"/></w:tcPr>
                  <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="18"/><w:color w:val="FFFFFF"/></w:rPr><w:t xml:space="preserve">{esc(h)}</w:t></w:r></w:p>
                </w:tc>
                ''')
            doc_xml.append('</w:tr>')

            for r in rows:
                doc_xml.append('<w:tr>')
                for i, c in enumerate(r):
                    w = col_widths[i]
                    doc_xml.append(f'''
                    <w:tc>
                      <w:tcPr><w:tcW w:w="{w}" w:type="dxa"/></w:tcPr>
                      <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">{esc(c)}</w:t></w:r></w:p>
                    </w:tc>
                    ''')
                doc_xml.append('</w:tr>')
            doc_xml.append('</w:tbl>')

        elif sec_type == "alert_box":
            box_text = sec.get("text", "")
            bullets = sec.get("bullets", [])
            doc_xml.append(f'''
            <w:tbl>
              <w:tblPr>
                <w:tblW w:w="9600" w:type="dxa"/>
                <w:tblBorders>
                  <w:top w:val="single" w:sz="16" w:space="0" w:color="DC2626"/>
                  <w:left w:val="single" w:sz="24" w:space="0" w:color="DC2626"/>
                  <w:bottom w:val="single" w:sz="16" w:space="0" w:color="DC2626"/>
                  <w:right w:val="single" w:sz="16" w:space="0" w:color="DC2626"/>
                </w:tblBorders>
                <w:tblCellMar>
                  <w:top w:w="120" w:type="dxa"/>
                  <w:left w:w="180" w:type="dxa"/>
                  <w:bottom w:w="120" w:type="dxa"/>
                  <w:right w:w="180" w:type="dxa"/>
                </w:tblCellMar>
              </w:tblPr>
              <w:tr>
                <w:tc>
                  <w:tcPr><w:tcW w:w="9600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/></w:tcPr>
                  <w:p>
                    <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
                    <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="19"/><w:color w:val="991B1B"/></w:rPr><w:t xml:space="preserve">{esc(box_text)}</w:t></w:r>
                  </w:p>
            ''')
            for b in bullets:
                doc_xml.append(f'''
                  <w:p>
                    <w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>
                    <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="7F1D1D"/></w:rPr><w:t xml:space="preserve">• {esc(b)}</w:t></w:r>
                  </w:p>
                ''')
            doc_xml.append('''
                </w:tc>
              </w:tr>
            </w:tbl>
            ''')

        elif sec_type == "checklist":
            items = sec.get("items", [])
            for item in items:
                doc_xml.append(f'''
                <w:p>
                  <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
                  <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="18"/><w:color w:val="{accent_color}"/></w:rPr><w:t xml:space="preserve">[  ] </w:t></w:r>
                  <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">{esc(item)}</w:t></w:r>
                </w:p>
                ''')

        elif sec_type == "text_block":
            paragraphs = sec.get("paragraphs", [])
            for p in paragraphs:
                doc_xml.append(f'''
                <w:p>
                  <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
                  <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">{esc(p)}</w:t></w:r>
                </w:p>
                ''')

        doc_xml.append('<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr></w:p>')

    # 4. CONFIGURAÇÃO DA PÁGINA (A4, Margens 2cm)
    doc_xml.append('''
      <w:sectPr>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
      </w:sectPr>
    </w:body>
    </w:document>
    ''')

    final_xml = "".join(doc_xml)

    with zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>''')
        z.writestr('_rels/.rels', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''')
        z.writestr('word/document.xml', final_xml)

    print(f"[OK] Criado ficheiro {filename} ({os.path.getsize(filename)} bytes)")

def build_erpi_template(output_path):
    title = "FICHA MÉDICA INDIVIDUALIZADA DE EMERGÊNCIA"
    subtitle = "Dossier de Resposta Rápida a Emergências em Lar de Idosos / ERPI • Articulação INEM-CODU"
    disclaimer = (
        "Ficha editável com exemplo tipo de uma ficha médica individualizada de emergência para ERPI / Lar de Idosos. "
        "Não é um documento estanque: deve ser adaptada e validada pelo Diretor Técnico, Médico Assistente e Equipa de Enfermagem "
        "da instituição, em conformidade com o Regulamento Interno, as normas da Direção-Geral da Saúde (DGS) e do Instituto da "
        "Segurança Social (ISS). O presente documento deve ser mantido atualizado no posto de enfermagem / arquivo de emergência "
        "e entregue em mão à equipa de socorro (INEM / Bombeiros / VMER) aquando do acionamento via 112."
    )

    sections = [
        {
            "title": "1. DADOS DE IDENTIFICAÇÃO DO UTENTE",
            "type": "key_value_table",
            "rows": [
                ["Nome Completo", "[Inserir Nome Completo do Utente]", "Nome Habitual", "[Nome de Tratamento]"],
                ["Data de Nascimento", "[DD/MM/AAAA]", "Idade / Sexo", "[   ] Anos  |  [  ] Fem  [  ] Masc"],
                ["Nº de Utente SNS", "[9 dígitos SNS]", "NISS (Seg. Social)", "[11 dígitos NISS]"],
                ["Cartão de Cidadão", "[Nº Documento]", "NIF", "[9 dígitos NIF]"],
                ["Ala / Bloco", "[Designação da Ala]", "Quarto / Cama", "Quarto nº [    ]  /  Cama [    ]"],
                ["Data de Admissão", "[DD/MM/AAAA]", "Grau de Dependência", "[  ] Autónomo  [  ] Parcial  [  ] Total"]
            ]
        },
        {
            "title": "2. CONTACTOS DE EMERGÊNCIA & REPRESENTAÇÃO LEGAL",
            "type": "key_value_table",
            "rows": [
                ["Contacto Principal", "[Nome do Familiar / Cuidador]", "Grau de Parentesco", "[Filho/a, Cônjuge, etc.]"],
                ["Telemóvel Principal", "[9XXXXXXXX]", "Telefone Alternativo", "[Telefone fixo / trabalho]"],
                ["Contacto Secundário", "[Nome do Familiar Secundário]", "Telefone Secundário", "[9XXXXXXXX]"],
                ["Representante Legal", "[Nome do Procurador / Tutor / Curador]", "Estatuto Formal", "[Procurador Cuidados Saúde / Maior Acompanhado]"]
            ]
        },
        {
            "title": "3. EQUIPA DE SAÚDE & RECURSOS HOSPITALARES",
            "type": "key_value_table",
            "rows": [
                ["Médico Assistente", "[Nome do Médico Assistente / USF]", "Telefone do Médico", "[Contacto Telefónico]"],
                ["Enfermeiro(a) do Lar", "[Nome do Enfermeiro Responsável]", "Posto de Enfermagem", "[Contacto / Extensão Interna]"],
                ["Hospital de Referência", "[Nome do Hospital Distrital / Centro Hospitalar]", "Serviço de Urgência", "[Urgência Geral / Pediátrica]"]
            ]
        },
        {
            "title": "4. ALERGIAS CONHECIDAS & ALERTAS CRÍTICOS (INFORMAR CODU / 112)",
            "type": "alert_box",
            "alert": True,
            "text": "AVISO DE ALERGIAS MEDICAMENTOSAS E RISCOS IMEDIATOS:",
            "bullets": [
                "ALERGIA A MEDICAMENTOS: [  ] NÃO CONHECIDA  |  [  ] SIM -> Especificar: (ex: Penicilinas, AINEs/Aspirina, Sulfamidas, Tramadol)",
                "ALERGIA ALIMENTAR / OUTRAS: [  ] NÃO  |  [  ] SIM -> Especificar: (ex: Frutos secos, Iodo de contraste, Látex)",
                "HISTÓRICO DE ANAFILAXIA OU CHOQUE PRÉVIO: [  ] NÃO  |  [  ] SIM (Descrever episódio prévio)",
                "RISCO DE BRONCOASPIRAÇÃO (DISFAGIA): [  ] Dieta Normal  |  [  ] Dieta Pastosa / Batida  |  [  ] Espessante em todos os líquidos",
                "RISCO ELEVADO DE QUEDA: [  ] SIM (Manobras de mobilização com 2 cuidadores / grades de cama ativas)"
            ]
        },
        {
            "title": "5. ANTECEDENTES CLÍNICOS E DOENÇAS CRÓNICAS",
            "type": "checklist",
            "items": [
                "Hipertensão Arterial (HTA)",
                "Diabetes Mellitus: [  ] Não Insulino-dependente (Oral)  |  [  ] Insulino-dependente (Esquema de Insulina)",
                "Doença Cardíaca: [  ] EAM / Enfarte prévio  |  [  ] Insuficiência Cardíaca  |  [  ] Fibrilhação Auricular / Arritmia",
                "Dispositivos Cardíacos: [  ] Pacemaker  |  [  ] Desfibrilhador Cardíaco Implantável (CDI)",
                "Acidente Vascular Cerebral (AVC / AIT prévio): Sequelas atuais: [Hemiparésia D/E, Afasia de expressão, etc.]",
                "Doença Respiratória Crónica: [  ] DPOC  |  [  ] Asma  |  [  ] Oxigenoterapia de Longa Duração: [    ] Litros/min",
                "Doença Renal Crónica: [  ] Estádio Conservador  |  [  ] Hemodiálise (Dias da semana: ________________)",
                "Défice Cognitivo / Demência: [  ] Doença de Alzheimer  |  [  ] Demência Vascular  |  [  ] Parkinson",
                "Dispositivos / Sondas em uso: [  ] Algália / Foley  |  [  ] Sonda Nasogástrica (SNG)  |  [  ] PEG  |  [  ] Oxigénio"
            ]
        },
        {
            "title": "6. MEDICAÇÃO HABITUAL EM CURSO (CRÍTICO PARA CODU / VMER)",
            "type": "data_table",
            "headers": ["Fármaco / Substância Ativa", "Dosagem", "Horários (P.Alm / Alm / Lanche / Jantar / Deitar)", "Indicação"],
            "col_widths": [3000, 1600, 3200, 1800],
            "rows": [
                ["[Ex: Eliquis / Apixabano - ANTICOAGULANTE]", "5 mg", "1 - 0 - 0 - 1 - 0 (08h e 20h)", "Prevenção AVC"],
                ["[Ex: Enalapril + Hidroclorotiazida]", "20/12.5 mg", "1 - 0 - 0 - 0 - 0 (Manhã)", "HTA"],
                ["[Ex: Metformina]", "1000 mg", "0 - 1 - 0 - 1 - 0 (Refeições)", "Diabetes"],
                ["[Ex: Furosemida]", "40 mg", "1 - 0 - 0 - 0 - 0 (Jejum)", "Insuf. Cardíaca"],
                ["[Inserir Medicamento 5]", "[Dose]", "[Horário]", "[Indicação]"],
                ["[Inserir Medicamento 6]", "[Dose]", "[Horário]", "[Indicação]"],
                ["[Inserir Medicamento 7]", "[Dose]", "[Horário]", "[Indicação]"],
                ["[Inserir Medicamento 8]", "[Dose]", "[Horário]", "[Indicação]"]
            ]
        },
        {
            "title": "MEDICAÇÃO DE URGÊNCIA EM SOS PRESCRITA PELO MÉDICO ASSISTENTE:",
            "type": "data_table",
            "headers": ["Fármaco SOS", "Dose e Via", "Critério de Aplicação", "Procedimento Obrigatório"],
            "col_widths": [2400, 2000, 2800, 2400],
            "rows": [
                ["Paracetamol", "1000 mg Oral", "Temperatura axilar > 38.0 ºC", "Hidratar, registar e reavaliar em 1h"],
                ["Nitroglicerina SL", "0.4 mg Sublingual", "Dor forte no peito / aperto cardíaco", "SENTAR UTENTE, LIGAR 112 IMEDIATAMENTE"],
                ["Salbutamol Inalador", "200 mcg Inalatório", "Falta de ar súbita com pieira", "Aplicar com câmara expansora e ligar 112 se sem alívio"]
            ]
        },
        {
            "title": "7. DIRETIVAS ANTECIPADAS DE VONTADE (DAV) & LIMITAÇÃO TERAPÊUTICA",
            "type": "checklist",
            "items": [
                "Testamento Vital registado no RENTEV: [  ] NÃO  |  [  ] SIM (Cópia arquivada no processo clínico do utente)",
                "Diretiva de Suporte de Vida: [  ] Reanimação Total (SBV/SAV pleno com acionamento 112)",
                "Não Reanimação (DNR) formalmente prescrita por Médico Assistente e acordada com Utente/Família: [  ] SIM (Declaração médica anexa datada de ___/___/202___)",
                "Protocolo de Cuidados Paliativos e Medidas Exclusivas de Conforto: [  ] SIM  |  [  ] NÃO"
            ]
        },
        {
            "title": "8. CONTROLO DE REVISÃO E VALIDAÇÃO DA INSTITUIÇÃO",
            "type": "key_value_table",
            "rows": [
                ["Data da Última Revisão", "[DD/MM/AAAA]", "Data da Próxima Revisão", "[Revisão Semestral / Anual]"],
                ["Profissional Responsável", "[Nome do Enfermeiro(a) ou Diretor Técnico]", "Cédula Profissional", "[Nº Cédula / Ordem]"],
                ["Assinatura e Carimbo", "________________________________________________________", "", ""]
            ]
        }
    ]

    create_docx(output_path, title, subtitle, disclaimer, sections, accent_color="0F766E")

def build_creche_template(output_path):
    title = "PLANO INDIVIDUAL DE SAÚDE E EMERGÊNCIA"
    subtitle = "Protocolo de Cuidados Imediatos, Alergias e Resposta Rápida em Creche & Escola • Modelo 112"
    disclaimer = (
        "Ficha editável com exemplo tipo de um Plano Individual de Saúde e Emergência Escolar / Creche. "
        "Não é um documento estanque: deve ser adaptada pela Direção Pedagógica, Educadores e Encarregados de Educação "
        "em articulação com o Médico Assistente / Pediatra da criança, de acordo com as orientações conjuntas da "
        "Direção-Geral da Saúde (DGS) e da Direção-Geral da Educação (DGE). O presente documento deve ser arquivado na "
        "sala da criança, junto ao estojo de primeiros socorros da valência e levado nas saídas de campo / visitas de estudo."
    )

    sections = [
        {
            "title": "1. IDENTIFICAÇÃO DA CRIANÇA",
            "type": "key_value_table",
            "rows": [
                ["Nome Completo da Criança", "[Inserir Nome Completo]", "Nome de Tratamento", "[Como gosta de ser chamada]"],
                ["Data de Nascimento", "[DD/MM/AAAA]", "Idade Atual / Sexo", "[   ] Anos  |  [  ] Fem  [  ] Masc"],
                ["Nº de Utente SNS", "[9 dígitos SNS]", "Cartão de Cidadão", "[Nº Documento / Validade]"],
                ["Sala / Valência", "[Berçário / Creche / Sala 2 Anos / Jardim de Infância]", "Educador(a) Titular", "[Nome do Educador(a)]"],
                ["Auxiliar de Referência", "[Nome da Ajudante de Ação Educativa]", "Boletim de Vacinas em Dia", "[  ] SIM  |  [  ] NÃO"]
            ]
        },
        {
            "title": "2. CONTACTOS DE EMERGÊNCIA DOS ENCARREGADOS DE EDUCAÇÃO",
            "type": "key_value_table",
            "rows": [
                ["Encarregado(a) 1 (Mãe/Pai)", "[Nome Completo]", "Grau de Parentesco", "[Mãe / Pai / Encarregado]"],
                ["Telemóvel Principal 1", "[9XXXXXXXX]", "Telefone do Emprego", "[Contacto Profissional]"],
                ["Encarregado(a) 2 (Pai/Mãe)", "[Nome Completo]", "Grau de Parentesco", "[Pai / Mãe / Outro]"],
                ["Telemóvel Principal 2", "[9XXXXXXXX]", "Telefone do Emprego", "[Contacto Profissional]"],
                ["Contacto Alternativo", "[Nome de Familiar / Avô / Avó]", "Telemóvel de Emergência", "[9XXXXXXXX (Autorizado a recolher)]"]
            ]
        },
        {
            "title": "3. EQUIPA DE SAÚDE PEDIÁTRICA & HOSPITAL DE APOIO",
            "type": "key_value_table",
            "rows": [
                ["Médico Pediatra / USF", "[Nome do Pediatra / Médico de Família]", "Telefone do Consultório", "[Contacto Telefónico]"],
                ["Hospital Pediátrico", "[Nome do Hospital com Urgência Pediátrica]", "Serviço de Urgência", "[Urgência Pediátrica Distrital]"]
            ]
        },
        {
            "title": "4. ALERGIAS GRAVES & PROTOCOLO DE ANAFILAXIA (ALERTA MÁXIMO)",
            "type": "alert_box",
            "alert": True,
            "text": "AVISO DE ALERGIAS ALIMENTARES, MEDICAMENTOSAS E PICADAS COM RISCO DE VIDA:",
            "bullets": [
                "ALIMENTOS PROIBIDOS: [  ] NÃO  |  [  ] SIM -> Especificar: (ex: Amendoim, Nozes, Leite, Ovo, Peixe, Marisco, Glúten, Soja)",
                "MEDICAMENTOS: [  ] NÃO  |  [  ] SIM -> Especificar: (ex: Amoxicilina, Ibuprofeno, Paracetamol)",
                "PICADAS DE INSETOS: [  ] NÃO  |  [  ] SIM (Vespas / Abelhas - risco de edema imediato)",
                "SINTOMAS TÍPICOS DE ALERTA: Manchas vermelhas no corpo, inchaço dos lábios/olhos, pieira no peito, tosse rouca, vómitos, prostração súbita.",
                "CANETA AUTOINJETORA DE ADRENALINA (EpiPen / Jext / Anapen): [  ] SIM  |  [  ] NÃO",
                "-> Dosagem: [  ] 0.15 mg (crianças até 25-30kg)  |  [  ] 0.30 mg  |  Validade: [DD/MM/AAAA]",
                "-> Local exato na Instituição: [Especificar armário/estojo - ACESSO IMEDIATO A ADULTOS, NUNCA FECHADO À CHAVE!]",
                "-> PROTOCOLO DE SOCORRO: Aplicar na coxa lateral -> LIGAR 112 e informar 'Criança com anafilaxia e adrenalina dada' -> Ligar aos Pais!"
            ]
        },
        {
            "title": "5. DOENÇAS CRÓNICAS & PROTOCOLO DE ATUAÇÃO EM CRISE",
            "type": "checklist",
            "items": [
                "ASMA INFANTIL / BRONQUIOLITE: Inalador presente na sala: [  ] SIM (ex: Salbutamol / Ventilan com câmara expansora). Dose SOS: [    ] inalações.",
                "CONVULSÕES FEBRIS: Criança propensa a convulsões com febre alta. Atuar a partir de: [ 38.0 ºC ]. Medicação retal prescrita: [Diazepam retal ___ mg].",
                "DIABETES MELLITUS TIPO 1: Monitorização glicémica. Em caso de hipoglicemia (< 70 mg/dL): administrar imediatamente açúcar rápido / sumo.",
                "OUTRAS PATOLOGIAS OU LIMITAÇÕES FÍSICAS: [Especificar restrições a esforços, alimentação ou atividades de recreio]"
            ]
        },
        {
            "title": "6. AUTORIZAÇÃO FORMAL PARA ADMINISTRAÇÃO DE MEDICAMENTOS EM SOS",
            "type": "data_table",
            "headers": ["Fármaco Autorizado", "Dose Exata segundo o Peso", "Via / Forma", "Critério de Administração", "Condição Obrigatória"],
            "col_widths": [2200, 1800, 1400, 2400, 1800],
            "rows": [
                ["Paracetamol Xarope (24mg/ml)", "[Calcular p/ peso da criança]", "Oral (Seringa)", "Temperatura axilar > 38.2 ºC", "Contactar Encarregado"],
                ["Salbutamol Inalador (100mcg)", "[2 a 4 inalações c/ câmara]", "Inalatória", "Pieira evidente / Tosse em crise", "Ligar 112 se não aliviar"],
                ["Caneta de Adrenalina", "[0.15 mg ou 0.30 mg]", "Intramuscular", "Sinais de Choque Anafilático", "LIGAR 112 IMEDIATAMENTE"]
            ]
        },
        {
            "title": "TERMO DE CONSENTIMENTO DOS ENCARREGADOS DE EDUCAÇÃO:",
            "type": "text_block",
            "paragraphs": [
                "«Autorizo a Direção, Educadores e Colaboradores da Instituição a ministrar à criança acima identificada a medicação de urgência SOS supramencionada, em estrito cumprimento da prescrição médica anexa a este documento, sempre que ocorram os sintomas descritos.»",
                "«Em caso de acidente grave ou emergência súbita com risco de vida, autorizo a chamada imediata do número europeu de emergência 112 e o acompanhamento e transporte da criança em ambulância para a Unidade Hospitalar de referência, caso os pais não se encontrem na instituição no momento da saída da equipa de socorro.»"
            ]
        },
        {
            "title": "7. VALIDADE E ASSINATURAS DO PLANO INDIVIDUAL DE SAÚDE",
            "type": "key_value_table",
            "rows": [
                ["Ano Letivo de Vigência", "202____ / 202____", "Data de Homologação", "[DD/MM/AAAA]"],
                ["Assinatura Encarregado(a) 1", "____________________________________", "Assinatura Encarregado(a) 2", "____________________________________"],
                ["Assinatura do(a) Educador(a)", "____________________________________", "Direção da Instituição", "____________________________________"]
            ]
        }
    ]

    create_docx(output_path, title, subtitle, disclaimer, sections, accent_color="0369A1")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    docs_dir = os.path.join(base_dir, "assets", "docs")
    os.makedirs(docs_dir, exist_ok=True)

    erpi_path = os.path.join(docs_dir, "Ficha_Medica_Individual_ERPI.docx")
    creche_path = os.path.join(docs_dir, "Plano_Individual_Saude_Creche.docx")

    build_erpi_template(erpi_path)
    build_creche_template(creche_path)
    print("Sucesso! Ambas as minutas .docx foram geradas.")
