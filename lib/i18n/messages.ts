export type Locale = 'en' | 'es' | 'pt';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

type Messages = {
  nav: Record<string, string>;
  onboarding: Record<string, string>;
  library: Record<string, string>;
  products: Record<string, string>;
  common: Record<string, string>;
};

const en: Messages = {
  nav: {
    clone: 'Clone',
    products: 'Products',
    adLibrary: 'Ad Library',
    history: 'History',
    support: 'Support',
    upgrade: 'Upgrade',
    signOut: 'Sign out',
    credits: 'credits',
  },
  onboarding: {
    title: 'Welcome to admirror',
    subtitle:
      'Upload your first product so we can match packaging, copy, and branding when you clone winning static ads.',
    optional: 'Optional — you can skip and add a product later from the Products tab.',
    uploadProduct: 'Upload your first product',
    skip: 'Skip for now',
    later: 'You can always add products from the Products tab.',
  },
  library: {
    title: 'Static Ad Library',
    subtitle:
      'Curated US static ads from the Meta Ad Library. Same collection for every user, refreshed on a rolling schedule.',
    category: 'Category',
    chooseCategory: 'Choose category…',
    keywordOptional: 'Keyword (optional)',
    searchAds: 'Search ads',
    showBrands: 'Show brands',
    loading: 'Loading…',
    allAds: 'All ads in category',
    byBrand: 'By brand',
    filterBrands: 'Filter brands…',
    back: 'Back',
    brand: 'Brand',
    keyword: 'Keyword',
    adsCount: '{shown} of {total} ads',
    adsKeyword: 'Ads · keyword',
    adsBrand: 'Ads · brand',
    noAds: 'No ads match this filter yet.',
    loadMore: 'Load more',
    clone: 'Clone',
    impressions: 'impressions',
    categoryLabel: 'Category',
  },
  products: {
    title: 'Products',
    subtitle: 'Save product URLs and images for faster cloning.',
    addProduct: 'Add product',
    empty: 'No products yet. Add one to reuse in Clone.',
    editTitle: 'Edit product',
    fromUrl: 'From URL',
    manual: 'Manual',
    imagesStored: '{count} images stored',
    name: 'Product name',
    description: 'Description',
    audience: 'Target audience',
    audiencePh: 'Optional',
    palette: 'Color palette',
    price: 'Price for ads (only this may appear)',
    pricePh: 'e.g. $120 — leave empty to hide all prices',
    priceHint: 'Never copied from reference ads. Empty = no price badge in generated ads.',
    productImages: 'Product images',
    save: 'Save changes',
    saving: 'Saving…',
    delete: 'Delete',
    detectedPrice: 'Detected from page',
  },
  common: {
    close: 'Close',
    open: 'Open',
    download: 'Download',
    required: 'REQUIRED',
    optional: 'OPTIONAL',
  },
};

const es: Messages = {
  nav: {
    clone: 'Clonar',
    products: 'Productos',
    adLibrary: 'Biblioteca',
    history: 'Historial',
    support: 'Soporte',
    upgrade: 'Mejorar plan',
    signOut: 'Cerrar sesión',
    credits: 'créditos',
  },
  onboarding: {
    title: 'Bienvenido a admirror',
    subtitle:
      'Sube tu primer producto para que podamos igualar empaque, copy y branding al clonar anuncios estáticos ganadores.',
    optional: 'Opcional — puedes omitir y añadir un producto después en Productos.',
    uploadProduct: 'Sube tu primer producto',
    skip: 'Omitir por ahora',
    later: 'Siempre puedes añadir productos desde la pestaña Productos.',
  },
  library: {
    title: 'Biblioteca de anuncios',
    subtitle:
      'Anuncios estáticos US de Meta Ad Library. Misma colección para todos, actualizada periódicamente.',
    category: 'Categoría',
    chooseCategory: 'Elige categoría…',
    keywordOptional: 'Palabra clave (opcional)',
    searchAds: 'Buscar anuncios',
    showBrands: 'Ver marcas',
    loading: 'Cargando…',
    allAds: 'Todos los anuncios',
    byBrand: 'Por marca',
    filterBrands: 'Filtrar marcas…',
    back: 'Volver',
    brand: 'Marca',
    keyword: 'Palabra clave',
    adsCount: '{shown} de {total} anuncios',
    adsKeyword: 'Anuncios · palabra clave',
    adsBrand: 'Anuncios · marca',
    noAds: 'Aún no hay anuncios para este filtro.',
    loadMore: 'Cargar más',
    clone: 'Clonar',
    impressions: 'impresiones',
    categoryLabel: 'Categoría',
  },
  products: {
    title: 'Productos',
    subtitle: 'Guarda URLs e imágenes de producto para clonar más rápido.',
    addProduct: 'Añadir producto',
    empty: 'Sin productos. Añade uno para reutilizar en Clonar.',
    editTitle: 'Editar producto',
    fromUrl: 'Desde URL',
    manual: 'Manual',
    imagesStored: '{count} imágenes guardadas',
    name: 'Nombre del producto',
    description: 'Descripción',
    audience: 'Público objetivo',
    audiencePh: 'Opcional',
    palette: 'Paleta de colores',
    price: 'Precio en anuncios (solo este puede aparecer)',
    pricePh: 'ej. $120 — vacío para ocultar precios',
    priceHint: 'Nunca se copia de anuncios de referencia. Vacío = sin precio en anuncios generados.',
    productImages: 'Imágenes del producto',
    save: 'Guardar cambios',
    saving: 'Guardando…',
    delete: 'Eliminar',
    detectedPrice: 'Detectado en la página',
  },
  common: {
    close: 'Cerrar',
    open: 'Abrir',
    download: 'Descargar',
    required: 'OBLIGATORIO',
    optional: 'OPCIONAL',
  },
};

const pt: Messages = {
  nav: {
    clone: 'Clonar',
    products: 'Produtos',
    adLibrary: 'Biblioteca',
    history: 'Histórico',
    support: 'Suporte',
    upgrade: 'Upgrade',
    signOut: 'Sair',
    credits: 'créditos',
  },
  onboarding: {
    title: 'Bem-vindo ao admirror',
    subtitle:
      'Envie seu primeiro produto para combinarmos embalagem, copy e branding ao clonar anúncios estáticos vencedores.',
    optional: 'Opcional — você pode pular e adicionar um produto depois em Produtos.',
    uploadProduct: 'Envie seu primeiro produto',
    skip: 'Pular por agora',
    later: 'Você sempre pode adicionar produtos na aba Produtos.',
  },
  library: {
    title: 'Biblioteca de anúncios',
    subtitle:
      'Anúncios estáticos US da Meta Ad Library. Mesma coleção para todos, atualizada periodicamente.',
    category: 'Categoria',
    chooseCategory: 'Escolha a categoria…',
    keywordOptional: 'Palavra-chave (opcional)',
    searchAds: 'Buscar anúncios',
    showBrands: 'Ver marcas',
    loading: 'Carregando…',
    allAds: 'Todos os anúncios',
    byBrand: 'Por marca',
    filterBrands: 'Filtrar marcas…',
    back: 'Voltar',
    brand: 'Marca',
    keyword: 'Palavra-chave',
    adsCount: '{shown} de {total} anúncios',
    adsKeyword: 'Anúncios · palavra-chave',
    adsBrand: 'Anúncios · marca',
    noAds: 'Ainda não há anúncios para este filtro.',
    loadMore: 'Carregar mais',
    clone: 'Clonar',
    impressions: 'impressões',
    categoryLabel: 'Categoria',
  },
  products: {
    title: 'Produtos',
    subtitle: 'Salve URLs e imagens de produto para clonar mais rápido.',
    addProduct: 'Adicionar produto',
    empty: 'Nenhum produto. Adicione um para usar em Clonar.',
    editTitle: 'Editar produto',
    fromUrl: 'Da URL',
    manual: 'Manual',
    imagesStored: '{count} imagens salvas',
    name: 'Nome do produto',
    description: 'Descrição',
    audience: 'Público-alvo',
    audiencePh: 'Opcional',
    palette: 'Paleta de cores',
    price: 'Preço nos anúncios (só este pode aparecer)',
    pricePh: 'ex. $120 — vazio para ocultar preços',
    priceHint: 'Nunca copiado de anúncios de referência. Vazio = sem preço nos anúncios gerados.',
    productImages: 'Imagens do produto',
    save: 'Salvar alterações',
    saving: 'Salvando…',
    delete: 'Excluir',
    detectedPrice: 'Detectado na página',
  },
  common: {
    close: 'Fechar',
    open: 'Abrir',
    download: 'Baixar',
    required: 'OBRIGATÓRIO',
    optional: 'OPCIONAL',
  },
};

export const messages: Record<Locale, Messages> = { en, es, pt };

export function t(
  locale: Locale,
  section: keyof Messages,
  key: string,
  vars?: Record<string, string | number>
): string {
  const table = messages[locale][section] as Record<string, string>;
  let text = table[key] ?? (messages.en[section] as Record<string, string>)[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
