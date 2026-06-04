import { Injectable, signal, computed } from '@angular/core';

export type Language = 'es' | 'en';

export const TRANSLATIONS = {
  es: {
    // Menu & Sidebar
    MENU_DASHBOARD: 'Dashboard',
    MENU_ORDERS: 'Pedidos',
    MENU_PRODUCTS: 'Productos',
    MENU_USERS: 'Usuarios',
    MENU_POINTS: 'Puntos',
    MENU_SETTINGS: 'Configuración',
    MENU_LOGOUT: 'Cerrar Sesión',

    // Navbar
    NAVBAR_SEARCH: 'Buscar algo...',
    NAVBAR_DATE_PREFIX: 'Hoy es',

    // Products Page
    PRODUCTS_TITLE: 'Nuestros Productos',
    PRODUCTS_SUBTITLE: 'Gestiona y explora el catálogo exclusivo de especialidades y bebidas selectas',
    PRODUCTS_SEARCH_PLACEHOLDER: 'Buscar por nombre o descripción...',
    PRODUCTS_AVAILABILITY: 'Disponibilidad:',
    PRODUCTS_AVAIL_ALL: 'Todos',
    PRODUCTS_AVAIL_AVAILABLE: 'Disponibles',
    PRODUCTS_AVAIL_UNAVAILABLE: 'Agotados',
    PRODUCTS_EMPTY_STATE: 'No se encontraron productos',
    PRODUCTS_EMPTY_STATE_SUB: 'Prueba ajustando los filtros de búsqueda o categoría.',
    PRODUCTS_LOADING: 'Cargando productos exquisitos...',
    PRODUCTS_DETAIL_BTN: 'Ver Detalles',
    PRODUCTS_FALLBACK_CATEGORY: 'Bebida',

    // Modal
    MODAL_AVAILABLE: 'Disponible',
    MODAL_UNAVAILABLE: 'Agotado',
    MODAL_OPINIONS: 'opiniones',
    MODAL_REWARDS_EARN: '¡Gana {stars} estrellas!',
    MODAL_REWARDS_SUB: 'Acumula estrellas al comprar este producto y canjéalas por bebidas gratis.',
    MODAL_SIZES: 'Tamaños Disponibles',
    MODAL_TYPES: 'Tipos / Variaciones',
    MODAL_EXTRAS: 'Adiciones y Extras',
    MODAL_BASE_PRICE: 'Base',
    MODAL_NO_COST: 'Sin costo',
    
    // Editor
    EDIT_TITLE: 'Editar Producto',
    EDIT_BTN_EDIT: 'Editar Producto',
    EDIT_BTN_SAVE: 'Guardar Cambios',
    EDIT_BTN_CANCEL: 'Cancelar',
    EDIT_LABEL_NAME: 'Nombre del Producto',
    EDIT_LABEL_DESCRIPTION: 'Descripción',
    EDIT_LABEL_PRICE: 'Precio (USD)',
    EDIT_LABEL_STARS: 'Estrellas de Recompensa',
    EDIT_LABEL_AVAILABILITY: 'Disponible para la venta',
    EDIT_SUCCESS: '¡Producto guardado exitosamente!',
    
    // Add Product
    BTN_ADD_PRODUCT: 'Agregar Producto',
    ADD_TITLE: 'Nuevo Producto',
    ADD_SUCCESS: '¡Producto agregado exitosamente!',
    EDIT_LABEL_CATEGORY: 'Categoría',
    EDIT_LABEL_IMAGE: 'URL de la Imagen',
    EDIT_LABEL_UPLOAD_IMAGE: 'Subir Imagen Local',
    BTN_UPLOADING: 'Subiendo...',
    EDIT_BTN_ADD_EXTRA: 'Agregar Adicional',
    LABEL_EXTRA_NAME: 'Nombre de la Adición',
    LABEL_EXTRA_PRICE: 'Precio Adicional (USD)',
  },
  en: {
    // Menu & Sidebar
    MENU_DASHBOARD: 'Dashboard',
    MENU_ORDERS: 'Orders',
    MENU_PRODUCTS: 'Products',
    MENU_USERS: 'Users',
    MENU_POINTS: 'Points',
    MENU_SETTINGS: 'Settings',
    MENU_LOGOUT: 'Logout',

    // Navbar
    NAVBAR_SEARCH: 'Search something...',
    NAVBAR_DATE_PREFIX: 'Today is',

    // Products Page
    PRODUCTS_TITLE: 'Our Products',
    PRODUCTS_SUBTITLE: 'Manage and explore the exclusive catalog of select specialties and brews',
    PRODUCTS_SEARCH_PLACEHOLDER: 'Search by name or description...',
    PRODUCTS_AVAILABILITY: 'Availability:',
    PRODUCTS_AVAIL_ALL: 'All',
    PRODUCTS_AVAIL_AVAILABLE: 'Available',
    PRODUCTS_AVAIL_UNAVAILABLE: 'Out of Stock',
    PRODUCTS_EMPTY_STATE: 'No products found',
    PRODUCTS_EMPTY_STATE_SUB: 'Try adjusting your search or category filters.',
    PRODUCTS_LOADING: 'Loading exquisite products...',
    PRODUCTS_DETAIL_BTN: 'View Details',
    PRODUCTS_FALLBACK_CATEGORY: 'Brew',

    // Modal
    MODAL_AVAILABLE: 'Available',
    MODAL_UNAVAILABLE: 'Out of stock',
    MODAL_OPINIONS: 'reviews',
    MODAL_REWARDS_EARN: 'Earn {stars} stars!',
    MODAL_REWARDS_SUB: 'Earn stars when purchasing this product and redeem them for free drinks.',
    MODAL_SIZES: 'Available Sizes',
    MODAL_TYPES: 'Types / Variations',
    MODAL_EXTRAS: 'Additions & Extras',
    MODAL_BASE_PRICE: 'Base',
    MODAL_NO_COST: 'No cost',

    // Editor
    EDIT_TITLE: 'Edit Product',
    EDIT_BTN_EDIT: 'Edit Product',
    EDIT_BTN_SAVE: 'Save Changes',
    EDIT_BTN_CANCEL: 'Cancel',
    EDIT_LABEL_NAME: 'Product Name',
    EDIT_LABEL_DESCRIPTION: 'Description',
    EDIT_LABEL_PRICE: 'Price (USD)',
    EDIT_LABEL_STARS: 'Reward Stars',
    EDIT_LABEL_AVAILABILITY: 'Available for sale',
    EDIT_SUCCESS: 'Product saved successfully!',

    // Add Product
    BTN_ADD_PRODUCT: 'Add Product',
    ADD_TITLE: 'New Product',
    ADD_SUCCESS: 'Product added successfully!',
    EDIT_LABEL_CATEGORY: 'Category',
    EDIT_LABEL_IMAGE: 'Image URL',
    EDIT_LABEL_UPLOAD_IMAGE: 'Upload Local Image',
    BTN_UPLOADING: 'Uploading...',
    EDIT_BTN_ADD_EXTRA: 'Add Extra',
    LABEL_EXTRA_NAME: 'Extra Name',
    LABEL_EXTRA_PRICE: 'Extra Price (USD)',
  }
};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLanguage = signal<Language>('es');

  t = computed(() => TRANSLATIONS[this.currentLanguage()]);

  setLanguage(lang: Language) {
    this.currentLanguage.set(lang);
    localStorage.setItem('lang', lang);
  }

  constructor() {
    const saved = localStorage.getItem('lang') as Language;
    if (saved === 'es' || saved === 'en') {
      this.currentLanguage.set(saved);
    }
  }
}
