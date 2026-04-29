export interface AccessProfile {
  id?: string;
  name: string;
  permissions: string[];
}

export interface Sale {
  id?: string;
  localizador: string;
  codigo: string;
  cpf: string;
  cliente: string;
  empreendimento: string;
  valor: number;

  // Team
  captador: string;
  consultor: string;
  to: string;
  sala: string;
  pontoCaptacao: string;

  // Dates
  dataAtendimento: string;
  dataAtendimentoIso: string;

  // Status
  statusContrato: string;
  dataCancelamento?: string; // Utilizado também como Data da Solicitação
  
  // Retenção
  retido?: 'Sim' | 'Não' | '';
  dataRetencao?: number;
  usuarioRetencaoId?: string;
  usuarioRetencaoNome?: string;
  vgvRetido?: number; // Keep for legacy if there is any, but we'll transition to valorRetido
  valorRetido?: number; // The actual value retained (that would have been refunded)
  valorDevolvido?: number; // The exact value refunded to the client when retention fails

  // Pagamento de Entrada
  formaPagamentoEntrada?: 'Crédito' | 'Débito' | 'PIX' | 'Dinheiro' | '';
  valorEntradaEfetiva?: number;
  parcelasEntrada?: number;

  // Demographics / Profile
  idade1: string;
  idade2: string;
  profissao1: string;
  profissao2: string;
  estadoCivil: string;
  renda: string;
  cidade: string;
  estado: string;
  possuiVeiculo: string;
  anoVeiculo: string;
  possuiCasaPropria: string;

  // Meta
  uploadedAt: number;
}
