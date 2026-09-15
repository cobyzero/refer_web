import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap, forkJoin, of } from 'rxjs';
import {
  ProductsService,
  Product,
  CatalogChildItem,
  ProductEnhancementOption,
  ProductTypeOption,
} from '../../../data/services/products';
import { LanguageService } from '../../../core/services/language';
import { ConfigService } from '../../../core/services/config';

export interface PendingSize {
  sizeId: string;
  name: string;
  price: number;
}

@Component({
  selector: 'app-product-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-create-page.html',
  styleUrl: './product-create-page.css',
})
export class ProductCreatePageComponent implements OnInit {
  private productsService = inject(ProductsService);
  private langService = inject(LanguageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private configService = inject(ConfigService);

  t = this.langService.t;
  currencyCode = this.configService.currency;
  categories = this.productsService.categories;
  catsLoading = this.productsService.isLoadingCategories;
  sizes = this.productsService.sizes;

  // Form state
  name = signal('');
  description = signal('');
  price = signal<number | null>(null);
  starsReward = signal<number | null>(null);
  categoryId = signal('');
  imageUrl = signal('');
  isAvailable = signal(true);

  // Pending extras: se agregan en local (igual que en editar) y se
  // persisten con addEnhancement después de crear el producto.
  pendingExtras = signal<{ name: string; price: number }[]>([]);
  extraName = signal('');
  extraPrice = signal<number | null>(null);
  extraPick = signal('');
  showNewExtra = signal(false);
  allExtras = signal<CatalogChildItem[]>([]);

  // Pending variants (tipos): mismo patrón que extras.
  pendingVariants = signal<{ name: string; price: number }[]>([]);
  variantName = signal('');
  variantPrice = signal<number | null>(null);
  variantPick = signal('');
  showNewVariant = signal(false);
  allVariants = signal<CatalogChildItem[]>([]);

  // Edit mode: misma vista que crear, precargada con el producto.
  isEditMode = signal(false);
  editingId = signal<string | null>(null);
  isLoadingProduct = signal(false);
  loadError = signal<string | null>(null);
  existingExtras = signal<ProductEnhancementOption[]>([]);
  existingVariants = signal<ProductTypeOption[]>([]);
  existingSizes = signal<PendingSize[]>([]);
  private original: {
    name: string;
    description: string;
    price: number;
    starsReward: number;
    categoryId: string;
    imageUrl: string;
    isAvailable: boolean;
  } | null = null;

  pageTitle = computed(() =>
    this.isEditMode() ? this.t().EDIT_TITLE : this.t().CREATE_TITLE
  );
  pageSub = computed(() =>
    this.isEditMode() ? this.t().EDIT_SUB : this.t().CREATE_SUB
  );
  submitLabel = computed(() =>
    this.isEditMode() ? this.t().EDIT_BTN_SAVE : this.t().CREATE_SUBMIT
  );
  savingLabel = computed(() =>
    this.isEditMode() ? this.t().EDIT_SAVING : this.t().CREATE_SAVING
  );
  successTitle = computed(() =>
    this.isEditMode()
      ? this.t().EDIT_SUCCESS_TITLE
      : this.t().CREATE_SUCCESS_TITLE
  );
  successSub = computed(() =>
    this.isEditMode() ? this.t().EDIT_SUCCESS_SUB : this.t().CREATE_SUCCESS_SUB
  );
  returnToPath = computed(() => {
    const id = this.editingId();
    return id ? `/products/${id}/edit` : '/products/new';
  });

  submitted = signal(false);
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  isUploading = signal(false);
  uploadError = signal<string | null>(null);
  exitArmed = signal(false);
  createdName = signal<string | null>(null);
  createdId = signal<string | null>(null);

  // Sizes to assign right after creation (product doesn't exist yet)
  pendingSizes = signal<PendingSize[]>([]);
  sizePick = signal('');
  sizePrice = signal<number | null>(null);
  sizeFormError = signal<string | null>(null);

  // Sizes: picker del catálogo + disclosure para crear uno nuevo aquí.
  showNewSize = signal(false);
  newSizeName = signal('');
  newSizeTouched = signal(false);
  isCreatingSize = signal(false);
  newSizeError = signal<string | null>(null);

  availableSizes = computed(() => {
    const used = new Set(this.pendingSizes().map(s => s.sizeId));
    return this.sizes().filter(s => !used.has(s.id));
  });

  addPendingSize() {
    const sizeId = this.sizePick();
    if (!sizeId) {
      this.sizeFormError.set(this.t().SIZE_ERR_PICK);
      return;
    }
    const catalog = this.sizes().find(s => s.id === sizeId);
    if (!catalog) return;
    this.pendingSizes.update(prev => [
      ...prev,
      { sizeId, name: catalog.name, price: Number(this.sizePrice()) || 0 },
    ]);
    this.sizePick.set('');
    this.sizePrice.set(null);
    this.sizeFormError.set(null);
  }

  removePendingSize(index: number) {
    this.pendingSizes.update(prev => prev.filter((_, i) => i !== index));
  }

  removeExistingSize(sizeId: string) {
    const id = this.editingId();
    if (!id) return;
    this.saveError.set(null);
    this.productsService.unassignSize(id, sizeId).subscribe({
      next: (updated) => {
        this.existingSizes.set(
          (updated.sizeOptions ?? []).map(o => ({
            sizeId: o.size.id,
            name: o.size.name,
            price: o.priceAdjustment,
          }))
        );
      },
      error: () => this.saveError.set(this.t().EDIT_SAVE_ERROR),
    });
  }

  dirty = computed(() => {
    if (!this.isEditMode()) {
      return (
        this.name().trim() !== '' ||
        this.description().trim() !== '' ||
        (this.price() ?? 0) > 0 ||
        (this.starsReward() ?? 0) > 0 ||
        this.imageUrl().trim() !== '' ||
        this.pendingExtras().length > 0 ||
        this.pendingSizes().length > 0 ||
        this.pendingVariants().length > 0 ||
        !this.isAvailable()
      );
    }
    const o = this.original;
    if (!o) return false;
    return (
      this.name().trim() !== o.name ||
      this.description().trim() !== o.description ||
      (Number(this.price()) || 0) !== o.price ||
      (Number(this.starsReward()) || 0) !== o.starsReward ||
      (this.categoryId() || '') !== o.categoryId ||
      this.imageUrl().trim() !== o.imageUrl ||
      this.isAvailable() !== o.isAvailable ||
      this.pendingExtras().length > 0 ||
      this.pendingSizes().length > 0 ||
      this.pendingVariants().length > 0
    );
  });

  errors = computed(() => {
    if (!this.submitted()) return { name: '', price: '', category: '' };
    return {
      name: !this.name().trim() ? this.t().CREATE_ERR_NAME : '',
      price: !this.price() || this.price()! <= 0 ? this.t().CREATE_ERR_PRICE : '',
      category: !this.categoryId() ? this.t().CREATE_ERR_CATEGORY : '',
    };
  });

  valid = computed(() => {
    const e = this.errors();
    return !e.name && !e.price && !e.category;
  });

  previewUrl = computed(() => this.imageUrl().trim());
  displayPrice = computed(() => this.price() ?? 0);
  displayStars = computed(() => this.starsReward() ?? 0);

  ngOnInit() {
    if (!this.categories().length) {
      this.productsService.getCategories().subscribe({
        next: (cats) => this.defaultCategory((cats ?? []).map((c) => c.id)),
        error: () => undefined,
      });
    } else {
      this.defaultCategory(this.categories().map((c) => c.id));
    }

    if (!this.sizes().length) {
      this.productsService.getSizes().subscribe({ error: () => undefined });
    }
    this.productsService.getAllEnhancements().subscribe({
      next: (items) => this.allExtras.set(items ?? []),
      error: () => undefined,
    });
    this.productsService.getAllTypes().subscribe({
      next: (items) => this.allVariants.set(items ?? []),
      error: () => undefined,
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.editingId.set(id);
      this.loadProduct(id);
    }
  }

  loadProduct(id: string) {
    this.isLoadingProduct.set(true);
    this.loadError.set(null);
    // Respuesta inmediata desde caché local, luego revalidar con el API.
    const cached = this.productsService.products().find((p) => p.id === id);
    if (cached) {
      this.fillForm(cached);
      this.isLoadingProduct.set(false);
    }
    this.productsService.getProduct(id).subscribe({
      next: (p) => {
        // El API responde MappedProductResponse (types/availableSizes):
        // normalizar igual que la lista para que el form lo entienda.
        this.fillForm(this.productsService.mapApiProduct(p));
        this.isLoadingProduct.set(false);
      },
      error: () => {
        this.isLoadingProduct.set(false);
        if (!cached) this.loadError.set(this.t().CREATE_SAVE_ERROR);
      },
    });
  }

  private fillForm(p: Product) {
    this.name.set(p.name ?? '');
    this.description.set(p.description ?? '');
    this.price.set(p.price ?? null);
    this.starsReward.set(p.starsReward ?? null);
    this.imageUrl.set(p.imageUrl ?? '');
    this.isAvailable.set(p.isAvailable ?? true);
    if (p.categoryId) this.categoryId.set(p.categoryId);
    else this.defaultCategory(this.categories().map((c) => c.id));
    this.existingExtras.set([...(p.enhancements ?? [])]);
    this.existingVariants.set([...(p.options ?? [])]);
    this.existingSizes.set(
      (p.sizeOptions ?? []).map(o => ({
        sizeId: o.size.id,
        name: o.size.name,
        price: o.priceAdjustment,
      }))
    );
    this.snapshot();
  }

  private snapshot() {
    this.original = {
      name: this.name().trim(),
      description: this.description().trim(),
      price: Number(this.price()) || 0,
      starsReward: Number(this.starsReward()) || 0,
      categoryId: this.categoryId() || '',
      imageUrl: this.imageUrl().trim(),
      isAvailable: this.isAvailable(),
    };
  }

  private defaultCategory(ids: string[]) {
    if (!this.categoryId() && ids.length) this.categoryId.set(ids[0]);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    this.uploadError.set(null);
    this.productsService
      .uploadImage(file)
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        next: (res) => this.imageUrl.set(res.imageUrl),
        error: () => this.uploadError.set(this.t().CREATE_UPLOAD_ERROR),
      });
  }

  hideImg(event: Event) {
    const img = event.target as HTMLImageElement | null;
    if (img) img.style.display = 'none';
  }

  addPendingExtra() {
    const name = this.extraName().trim();
    if (!name) return;
    this.commitExtra(name, Number(this.extraPrice()) || 0);
    this.extraName.set('');
    this.extraPrice.set(null);
  }

  /** Agregar copiando uno existente del catálogo global. */
  addPickedExtra() {
    const found = this.allExtras().find(e => e.id === this.extraPick());
    if (!found) return;
    this.commitExtra(found.name, found.price);
    this.extraPick.set('');
  }

  private commitExtra(name: string, price: number) {
    const id = this.editingId();
    // En modo edición el producto ya existe: persistir al instante,
    // igual que hacía el modal de editar.
    if (this.isEditMode() && id) {
      this.saveError.set(null);
      this.productsService.addEnhancement(id, { name, price }).subscribe({
        next: (updated) => {
          this.existingExtras.set([...(updated.enhancements ?? [])]);
        },
        error: () => this.saveError.set(this.t().EDIT_SAVE_ERROR),
      });
      return;
    }
    this.pendingExtras.update((prev) => [...prev, { name, price }]);
  }

  /** Existentes sin duplicar lo que el producto ya tiene. */
  pickableExtras = computed(() => {
    const used = new Set([
      ...this.pendingExtras().map(e => e.name.trim().toLowerCase()),
      ...(this.isEditMode() ? this.existingExtras().map(e => e.name.trim().toLowerCase()) : []),
    ]);
    return this.allExtras().filter(e => !used.has(e.name.trim().toLowerCase()));
  });

  removePendingExtra(index: number) {
    this.pendingExtras.update((prev) => prev.filter((_, i) => i !== index));
  }

  removeExistingExtra(enhancementId: string) {
    const id = this.editingId();
    if (!id) return;
    this.saveError.set(null);
    this.productsService.deleteEnhancement(id, enhancementId).subscribe({
      next: (updated) => {
        this.existingExtras.set([...(updated.enhancements ?? [])]);
      },
      error: () => this.saveError.set(this.t().EDIT_SAVE_ERROR),
    });
  }

  addPendingVariant() {
    const name = this.variantName().trim();
    if (!name) return;
    this.commitVariant(name, Number(this.variantPrice()) || 0);
    this.variantName.set('');
    this.variantPrice.set(null);
  }

  /** Agregar copiando una variante existente del catálogo global. */
  addPickedVariant() {
    const found = this.allVariants().find(v => v.id === this.variantPick());
    if (!found) return;
    this.commitVariant(found.name, found.price);
    this.variantPick.set('');
  }

  private commitVariant(name: string, price: number) {
    const id = this.editingId();
    if (this.isEditMode() && id) {
      this.saveError.set(null);
      this.productsService.addType(id, { name, price }).subscribe({
        next: (updated) => {
          this.existingVariants.set([...(updated.options ?? [])]);
        },
        error: () => this.saveError.set(this.t().EDIT_SAVE_ERROR),
      });
      return;
    }
    this.pendingVariants.update((prev) => [...prev, { name, price }]);
  }

  /** Existentes sin duplicar lo que el producto ya tiene. */
  pickableVariants = computed(() => {
    const used = new Set([
      ...this.pendingVariants().map(v => v.name.trim().toLowerCase()),
      ...(this.isEditMode() ? this.existingVariants().map(v => v.name.trim().toLowerCase()) : []),
    ]);
    return this.allVariants().filter(v => !used.has(v.name.trim().toLowerCase()));
  });

  /** Crear un tamaño nuevo aquí mismo y dejarlo seleccionado. */
  createNewSize() {
    this.newSizeTouched.set(true);
    this.newSizeError.set(null);
    const name = this.newSizeName().trim();
    if (name.length < 2) {
      this.newSizeError.set(this.t().SIZE_ERR_NAME);
      return;
    }
    if (this.sizes().some(s => s.name.trim().toLowerCase() === name.toLowerCase())) {
      this.newSizeError.set(this.t().SIZE_ERR_DUP);
      return;
    }
    this.isCreatingSize.set(true);
    this.productsService.createSize(name).subscribe({
      next: (created) => {
        this.isCreatingSize.set(false);
        this.newSizeName.set('');
        this.newSizeTouched.set(false);
        this.showNewSize.set(false);
        this.sizePick.set(created.id);
        this.sizeFormError.set(null);
      },
      error: (err) => {
        this.isCreatingSize.set(false);
        this.newSizeError.set(err?.error?.message || this.t().SIZE_SAVE_ERROR);
      },
    });
  }

  removePendingVariant(index: number) {
    this.pendingVariants.update((prev) => prev.filter((_, i) => i !== index));
  }

  removeExistingVariant(typeId: string) {
    const id = this.editingId();
    if (!id) return;
    this.saveError.set(null);
    this.productsService.deleteType(id, typeId).subscribe({
      next: (updated) => {
        this.existingVariants.set([...(updated.options ?? [])]);
      },
      error: () => this.saveError.set(this.t().EDIT_SAVE_ERROR),
    });
  }

  save() {
    this.submitted.set(true);
    this.saveError.set(null);
    if (!this.valid()) {
      this.focusFirstInvalid();
      return;
    }

    this.isSaving.set(true);
    const data: Partial<Product> = {
      name: this.name().trim(),
      description: this.description().trim(),
      price: Number(this.price()),
      starsReward: Number(this.starsReward()) || 0,
      isAvailable: this.isAvailable(),
      categoryId: this.categoryId(),
    };
    if (this.previewUrl()) data.imageUrl = this.previewUrl();

    const extras = this.pendingExtras();
    const sizes = this.pendingSizes();
    const variants = this.pendingVariants();
    const editId = this.isEditMode() ? this.editingId() : null;

    // Modo edición: PATCH + volcar pendientes (adicionales, tamaños, variantes).
    if (editId) {
      this.isSaving.set(true);
      this.productsService
        .updateProduct(editId, data)
        .pipe(
          switchMap((updated) => {
            if (updated.enhancements)
              this.existingExtras.set([...updated.enhancements]);
            if (updated.options)
              this.existingVariants.set([...updated.options]);
            const calls = [
              ...extras.map((e) => this.productsService.addEnhancement(editId, e)),
              ...sizes.map((s) => this.productsService.assignSize(editId, s.sizeId, s.price)),
              ...variants.map((v) => this.productsService.addType(editId, v)),
            ];
            if (!calls.length) return of(updated);
            return forkJoin(calls);
          }),
          finalize(() => this.isSaving.set(false))
        )
        .subscribe({
          next: (result) => {
            const finalProd = Array.isArray(result)
              ? result[result.length - 1]
              : result;
            if (finalProd && 'enhancements' in finalProd)
              this.existingExtras.set([...(finalProd.enhancements ?? [])]);
            this.pendingExtras.set([]);
            this.pendingSizes.set([]);
            this.pendingVariants.set([]);
            this.snapshot();
            this.submitted.set(false);
            this.createdName.set(this.name().trim());
          },
          error: () => this.saveError.set(this.t().EDIT_SAVE_ERROR),
        });
      return;
    }

    this.isSaving.set(true);
    this.productsService
      .createProduct(data)
      .pipe(
        switchMap((created) => {
          // Persistir adicionales, tamaños y variantes contra el recién creado.
          const calls = [
            ...extras.map((e) => this.productsService.addEnhancement(created.id, e)),
            ...sizes.map((s) => this.productsService.assignSize(created.id, s.sizeId, s.price)),
            ...variants.map((v) => this.productsService.addType(created.id, v)),
          ];
          if (!calls.length) return of(created);
          return forkJoin(calls);
        }),
        finalize(() => this.isSaving.set(false))
      )
      .subscribe({
        next: () => {
          this.pendingSizes.set([]);
          this.pendingVariants.set([]);
          this.createdName.set(this.name().trim());
        },
        error: () => this.saveError.set(this.t().CREATE_SAVE_ERROR),
      });
  }

  /** Back with unsaved changes: arm inline confirm first, never window.confirm. */
  back() {
    if (this.dirty() && !this.exitArmed()) {
      this.exitArmed.set(true);
      return;
    }
    this.router.navigate(['/products']);
  }

  keepEditing() {
    this.exitArmed.set(false);
  }

  /** En modo edición: cerrar el éxito y seguir en el formulario. */
  continueEditing() {
    this.createdName.set(null);
  }

  createAnother() {
    this.name.set('');
    this.description.set('');
    this.price.set(null);
    this.starsReward.set(null);
    this.imageUrl.set('');
    this.isAvailable.set(true);
    this.pendingExtras.set([]);
    this.extraName.set('');
    this.extraPrice.set(null);
    this.pendingSizes.set([]);
    this.sizePick.set('');
    this.sizePrice.set(null);
    this.showNewSize.set(false);
    this.newSizeName.set('');
    this.newSizeError.set(null);
    this.pendingVariants.set([]);
    this.variantName.set('');
    this.variantPrice.set(null);
    this.variantPick.set('');
    this.showNewVariant.set(false);
    this.extraPick.set('');
    this.showNewExtra.set(false);
    this.submitted.set(false);
    this.saveError.set(null);
    this.exitArmed.set(false);
    this.createdName.set(null);
    this.defaultCategory(this.categories().map((c) => c.id));
    requestAnimationFrame(() => {
      document.getElementById('f-name')?.focus({ preventScroll: true });
    });
  }

  private focusFirstInvalid() {
    const e = this.errors();
    const id = e.name ? 'f-name' : e.category ? 'f-cat' : e.price ? 'f-price' : null;
    if (id) document.getElementById(id)?.focus();
  }
}
