export const strings = {
  common: {
    appName: 'Folio',
    undo: 'Desfazer',
    cancel: 'Cancelar',
    save: 'Salvar',
    delete: 'Apagar',
    close: 'Fechar',
    loading: 'Carregando...',
  },
  tabs: {
    today: 'Hoje',
    decks: 'Decks',
    stats: 'Estatísticas',
    settings: 'Ajustes',
  },
  study: {
    study: 'Estudar',
    consult: 'Consultar',
    addCard: 'Adicionar card',
    again: 'Errei',
    good: 'Acertei',
    showAnswer: 'Mostrar resposta',
    openInConsulta: 'Abrir na Consulta',
  },
  consulta: {
    title: 'Modo Consulta',
    searchPlaceholder: 'Buscar no texto e tags...',
    onlyWithNotes: 'Apenas com anotações',
    annotations: 'Anotações',
    orphans: 'Órfãs',
    highlightRemoved: 'Grifo removido',
    continueReading: 'Continuar lendo',
    reviewFiltered: 'Revisar estes',
  },
  welcome: {
    title: 'Bem-vindo ao Folio',
    subtitle: 'Seus flashcards também são o seu resumo.',
    testNotice: 'Base M0 inicializada com sucesso.',
  },
} as const;

export type Strings = typeof strings;
