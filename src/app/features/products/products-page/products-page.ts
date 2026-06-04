import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductsService, Product, ProductCategory } from '../../../data/services/products';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products-page.html',
  styleUrl: './products-page.css',
})
export class ProductsPageComponent implements OnInit {
  private productsService = inject(ProductsService);
  private langService = inject(LanguageService);

  products = this.productsService.products;
  categories = this.productsService.categories;
  isLoading = this.productsService.isLoading;
  t = this.langService.t;
  currentLang = this.langService.currentLanguage;

  // Filter states
  searchTerm = signal('');
  selectedCategoryId = signal<string>('all');
  availabilityFilter = signal<'all' | 'available' | 'unavailable'>('all');

  // Detail Modal state
  selectedProduct = signal<Product | null>(null);

  // Edit State
  isEditing = signal(false);
  showToast = signal(false);
  isUploading = signal(false);
  toastTextMessage = signal('');
  editName = signal('');
  editDescription = signal('');
  editPrice = signal(0);
  editStarsReward = signal(0);
  editIsAvailable = signal(true);
  editImageUrl = signal('');

  // Add Product State
  isAdding = signal(false);
  addName = signal('');
  addDescription = signal('');
  addPrice = signal(0);
  addStarsReward = signal(0);
  addIsAvailable = signal(true);
  addCategoryId = signal('');
  addImageUrl = signal('');

  // Add Extra / Addition Form State
  extraName = signal('');
  extraPrice = signal(0);

  // Computed filtered list
  filteredProducts = computed(() => {
    const list = this.products();
    const search = this.searchTerm().toLowerCase().trim();
    const catId = this.selectedCategoryId();
    const avail = this.availabilityFilter();

    return list.filter(product => {
      // 1. Text Search Filter
      const matchesSearch = !search || 
        product.name.toLowerCase().includes(search) || 
        product.description.toLowerCase().includes(search);

      // 2. Category Filter
      const matchesCategory = catId === 'all' || product.categoryId === catId;

      // 3. Availability Filter
      const matchesAvailability = avail === 'all' || 
        (avail === 'available' && product.isAvailable) || 
        (avail === 'unavailable' && !product.isAvailable);

      return matchesSearch && matchesCategory && matchesAvailability;
    });
  });

  ngOnInit() {
    this.productsService.getProducts().subscribe();
    this.productsService.getCategories().subscribe();
  }

  selectCategory(categoryId: string) {
    this.selectedCategoryId.set(categoryId);
  }

  setAvailabilityFilter(filter: 'all' | 'available' | 'unavailable') {
    this.availabilityFilter.set(filter);
  }

  openProductDetail(product: Product) {
    this.selectedProduct.set(product);
    this.isEditing.set(false);
  }

  closeProductDetail() {
    this.selectedProduct.set(null);
    this.isEditing.set(false);
  }

  startEdit() {
    const prod = this.selectedProduct();
    if (!prod) return;
    this.editName.set(prod.name);
    this.editDescription.set(prod.description);
    this.editPrice.set(prod.price);
    this.editStarsReward.set(prod.starsReward);
    this.editIsAvailable.set(prod.isAvailable);
    this.editImageUrl.set(prod.imageUrl || '');
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
  }

  saveEdit() {
    const prod = this.selectedProduct();
    if (!prod) return;

    const data: Partial<Product> = {
      name: this.editName(),
      description: this.editDescription(),
      price: Number(this.editPrice()),
      starsReward: Number(this.editStarsReward()),
      isAvailable: this.editIsAvailable(),
      imageUrl: this.editImageUrl()
    };

    this.productsService.updateProduct(prod.id, data).subscribe({
      next: (updatedProd) => {
        this.selectedProduct.set({
          ...prod,
          ...updatedProd
        });
        this.isEditing.set(false);
        this.toastTextMessage.set(this.t().EDIT_SUCCESS);
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3000);
      },
      error: (err) => {
        console.error('Error saving product:', err);
      }
    });
  }

  openAddModal() {
    this.addName.set('');
    this.addDescription.set('');
    this.addPrice.set(0);
    this.addStarsReward.set(0);
    this.addIsAvailable.set(true);
    this.addImageUrl.set('');
    
    // Set default category to the first available category
    const cats = this.categories();
    if (cats.length > 0) {
      this.addCategoryId.set(cats[0].id);
    } else {
      this.addCategoryId.set('');
    }

    this.isAdding.set(true);
  }

  closeAddModal(force = false) {
    if (force) {
      this.isAdding.set(false);
      return;
    }

    const isDirty = this.addName().trim() !== '' || 
                    this.addDescription().trim() !== '' || 
                    this.addPrice() > 0 || 
                    this.addStarsReward() > 0 || 
                    this.addImageUrl().trim() !== '';

    if (isDirty) {
      const confirmMsg = this.currentLang() === 'es' ? 
        '¿Estás seguro de que deseas salir? Se perderán todos los cambios no guardados.' : 
        'Are you sure you want to exit? All unsaved changes will be lost.';
      
      if (confirm(confirmMsg)) {
        this.isAdding.set(false);
      }
    } else {
      this.isAdding.set(false);
    }
  }

  saveNewProduct() {
    const data: Partial<Product> = {
      name: this.addName(),
      description: this.addDescription(),
      price: Number(this.addPrice()),
      starsReward: Number(this.addStarsReward()),
      isAvailable: this.addIsAvailable(),
      categoryId: this.addCategoryId()
    };

    if (this.addImageUrl().trim()) {
      data.imageUrl = this.addImageUrl().trim();
    }

    this.productsService.createProduct(data).subscribe({
      next: (newProd) => {
        this.isAdding.set(false);
        this.toastTextMessage.set(this.t().ADD_SUCCESS);
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3000);
      },
      error: (err) => {
        console.error('Error creating product:', err);
      }
    });
  }

  onFileSelected(event: any, mode: 'edit' | 'add') {
    const file: File = event.target.files[0];
    if (!file) return;

    this.isUploading.set(true);
    this.productsService.uploadImage(file).subscribe({
      next: (res) => {
        if (mode === 'edit') {
          this.editImageUrl.set(res.imageUrl);
        } else {
          this.addImageUrl.set(res.imageUrl);
        }
        this.isUploading.set(false);
      },
      error: (err) => {
        console.error('Error uploading file:', err);
        this.isUploading.set(false);
      }
    });
  }

  addExtraProduct() {
    const prod = this.selectedProduct();
    if (!prod || !this.extraName().trim()) return;

    const data = {
      name: this.extraName().trim(),
      price: Number(this.extraPrice()) || 0
    };

    this.productsService.addEnhancement(prod.id, data).subscribe({
      next: (updatedProd) => {
        this.selectedProduct.set(updatedProd);
        this.extraName.set('');
        this.extraPrice.set(0);
      },
      error: (err) => {
        console.error('Error adding extra:', err);
      }
    });
  }

  removeExtraProduct(enhancementId: string) {
    const prod = this.selectedProduct();
    if (!prod) return;

    this.productsService.deleteEnhancement(prod.id, enhancementId).subscribe({
      next: (updatedProd) => {
        this.selectedProduct.set(updatedProd);
      },
      error: (err) => {
        console.error('Error removing extra:', err);
      }
    });
  }

  getFallbackImage(product: Product): string {
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=60';
  }
}
