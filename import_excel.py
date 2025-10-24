import openpyxl
from database import add_cedente


def importar_dados_excel(file):
    """Importa dados de um arquivo Excel para o banco de dados usando openpyxl"""
    try:
        wb = openpyxl.load_workbook(filename=file.stream)
        sheet = wb.active
        
        importados = 0
        erros = 0
        
        for row_num, row in enumerate(sheet.iter_rows(min_row=3, values_only=True), start=3):
            try:
                if not row or all(cell is None for cell in row):
                    continue
                
                # Coluna B: NOME / RAZÃO SOCIAL (índice 1)
                # Coluna C: CPF / CNPJ (índice 2)  
                # Coluna D: CONTRATO (índice 3)
                # Coluna E: VALIDADE CONTRATO (índice 4) - NOVA COLUNA
                
                nome = row[1] if len(row) > 1 else ''
                cpf_cnpj = row[2] if len(row) > 2 else ''
                contrato = row[3] if len(row) > 3 else ''
                validade_contrato = row[4] if len(row) > 4 else ''  # NOVO
                
                # Limpa e valida os dados
                nome = str(nome).strip() if nome is not None else ''
                cpf_cnpj = str(cpf_cnpj).strip() if cpf_cnpj is not None else ''
                contrato = str(contrato).strip() if contrato is not None else 'Status não informado'
                validade_contrato = str(validade_contrato).strip() if validade_contrato is not None else ''
                
                # Converte data do Excel se necessário
                if validade_contrato and isinstance(validade_contrato, (int, float)):
                    # Se for número do Excel, converte para data
                    from datetime import datetime, timedelta
                    base_date = datetime(1899, 12, 30)
                    validade_contrato = (base_date + timedelta(days=validade_contrato)).strftime('%Y-%m-%d')
                
                if nome and cpf_cnpj:
                    success = add_cedente(
                        nome_razao_social=nome,
                        cpf_cnpj=cpf_cnpj,
                        contrato=contrato,
                        validade_contrato=validade_contrato if validade_contrato else None  # NOVO
                    )
                    
                    if success:
                        importados += 1
                    else:
                        print(f"Erro ao salvar cedente na linha {row_num}")
                        erros += 1
                else:
                    erros += 1
                    
            except Exception as e:
                print(f"Erro na linha {row_num}: {e}")
                erros += 1
        
        return {
            'success': True,
            'message': f'Importação concluída! {importados} cedentes importados, {erros} erros.'
        }
        
    except Exception as e:
        return {
            'success': False,
            'message': f'Erro ao processar arquivo Excel: {str(e)}'
        }
