# 🔒 PROTOCOLO DE SEGURANÇA MÁXIMA E ARQUITETURA (InsightSales)

**ATENÇÃO SISTEMA / AGENTE DE IA (GEMINI):** 
O motor de consolidação e inserção de dados deste sistema foi validado em ambiente de produção (655/392) e encontra-se congelado. Sob NENHUMA HIPÓTESE você deve alterar, refatorar ou modificar a lógica de cruzamento e importação contida em `src/pages/Database.tsx` ou a lógica paramétrica em `src/pages/Dashboard.tsx` sem que o usuário envie o comando expresso: **"AUTORIZO MUDANÇA ESTRUTURAL"**.

## Regras de Ouro do Motor de Banco de Dados (IMUTÁVEIS):
1. **Soberania do Contrato:** A planilha "CONTRATOS" é a ÚNICA métrica absoluta para Vendas Brutas e Cotas Líquidas. Cada linha lida validada = 1 cota no dashboard.
2. **Data Fidedigna:** A data de "Venda" é extraída exclusivamente da Coluna F ("DATA") da planilha de Contratos. Nenhuma outra data se sobrepõe a ela.
3. **Validação Permissiva:** A coluna Y (Status) da aba de contratos valida as cotas de forma frouxa (`.includes('ATIV')` e `.includes('CANCEL')`) para garantir que espaços em branco ou erros de digitação não mascarem contratos limpos.
4. **Vínculo Constelacional (Left-Join):** A aba "ATENDIMENTOS" funciona apenas como "recheio sociodemográfico". O cruzamento é feito em três cascatas estritas (nesta exata ordem): 1º pelo Localizador, 2º pelo CPF (Cessionário 1 ou 2), e 3º por intersecção Limpa do NOME na falta de CPF. 
5. **IDs Multiversos e Anti-Overwrite:** Para prevenir o comportamento default do Firebase de mesclar arquivos de mesmos IDs criados pelas falhas do Excel, TODO documento criado recebe incondicionalmente um sufixo randômico gerado após seu código principal, abolindo 100% o risco de apagamento por sombreamento. 

Qualquer instrução de "Melhoria" a partir de 22 de Abril de 2026 deve ser aplicada exclusivamente a estilos, interfaces visuais (UI/UX) e relatórios secundários. **O núcleo do motor listado acima é Intocável.**
