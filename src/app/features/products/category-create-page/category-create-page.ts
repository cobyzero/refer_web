import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ProductsService } from '../../../data/services/products';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-category-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './category-create-page.html',
  styleUrl: './category-create-page.css',
})
export class CategoryCreatePageComponent implements OnInit {
  private productsService = inject(ProductsService);
  private langService = inject(LanguageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  t = this.langService.t;
  categories = this.productsService.categories;
  catsLoading = this.productsService.isLoadingCategories;

  name = signal('');
  description = signal('');
  imageUrl = signal('');
  submitted = signal(false);
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  isUploading = signal(false);
  uploadError = signal<string | null>(null);
  exitArmed = signal(false);
  createdName = signal<string | null>(null);

  // Inline row editing
  editingCatId = signal<string | null>(null);
  editName = signal('');
  editDesc = signal('');
  editImage = signal('');
  editSubmitted = signal(false);
  isSavingEdit = signal(false);
  editError = signal<string | null>(null);
  isEditUploading = signal(false);

  // Two-tap delete
  deleteArmedCatId = signal<string | null>(null);
  private deleteTimer: ReturnType<typeof setTimeout> | null = null;

  /** Where to go back: ?returnTo=/products/new (validated, internal only). */
  returnTo = signal('/products');

  /** Back button only shows when we came from another view (e.g. new product). */
  showBack = computed(() => this.returnTo() !== '/products');

  dirty = computed(
    () =>
      this.name().trim() !== '' ||
      this.description().trim() !== '' ||
      this.imageUrl().trim() !== ''
  );

  previewUrl = computed(() => this.imageUrl().trim());

  duplicate = computed(() => {
    const value = this.name().trim().toLowerCase();
    return !!value && this.categories().some((c) => c.name.trim().toLowerCase() === value);
  });

  nameError = computed(() => {
    if (!this.submitted()) return '';
    if (this.name().trim().length < 2) return this.t().CAT_ERR_NAME;
    if (this.duplicate()) return this.t().CAT_ERR_DUP;
    return '';
  });

  valid = computed(() => !this.nameError());

  ngOnInit() {
    const requested = this.route.snapshot.queryParamMap.get('returnTo') ?? '';
    if (requested.startsWith('/') && !requested.startsWith('//')) {
      this.returnTo.set(requested);
    }
    if (!this.categories().length) {
      this.productsService.getCategories().subscribe({ error: () => undefined });
    }
  }

  save() {
    this.submitted.set(true);
    this.saveError.set(null);
    if (!this.valid()) {
      document.getElementById('c-name')?.focus();
      return;
    }

    this.isSaving.set(true);
    this.productsService
      .createCategory(this.name().trim(), this.imageUrl().trim(), this.description().trim())
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => this.createdName.set(this.name().trim()),
        error: () => this.saveError.set(this.t().CAT_SAVE_ERROR),
      });
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

  // ── Inline edit ──
  startEdit(id: string) {
    const cat = this.categories().find(c => c.id === id);
    if (!cat) return;
    this.deleteArmedCatId.set(null);
    this.editName.set(cat.name);
    this.editDesc.set(cat.description ?? '');
    this.editImage.set(cat.imageUrl ?? '');
    this.editSubmitted.set(false);
    this.editError.set(null);
    this.editingCatId.set(id);
  }

  cancelEdit() {
    this.editingCatId.set(null);
    this.editError.set(null);
  }

  editNameError = computed(() => {
    if (!this.editSubmitted()) return '';
    if (this.editName().trim().length < 2) return this.t().CAT_ERR_NAME;
    const value = this.editName().trim().toLowerCase();
    const clash = this.categories().some(
      c => c.id !== this.editingCatId() && c.name.trim().toLowerCase() === value
    );
    if (clash) return this.t().CAT_ERR_DUP;
    return '';
  });

  saveEdit() {
    const id = this.editingCatId();
    this.editSubmitted.set(true);
    this.editError.set(null);
    if (!id || this.editNameError() || this.isSavingEdit()) return;

    this.isSavingEdit.set(true);
    this.productsService
      .updateCategory(id, {
        name: this.editName().trim(),
        description: this.editDesc().trim(),
        imageUrl: this.editImage().trim(),
      })
      .pipe(finalize(() => this.isSavingEdit.set(false)))
      .subscribe({
        next: () => this.editingCatId.set(null),
        error: (err) => this.editError.set(err?.error?.message || this.t().CAT_SAVE_ERROR),
      });
  }

  onEditFileSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    this.isEditUploading.set(true);
    this.productsService
      .uploadImage(file)
      .pipe(finalize(() => this.isEditUploading.set(false)))
      .subscribe({
        next: (res) => this.editImage.set(res.imageUrl),
        error: () => this.editError.set(this.t().CREATE_UPLOAD_ERROR),
      });
  }

  // ── Delete (two-tap, products are unassigned — never deleted) ──
  askDeleteCategory(id: string) {
    if (this.deleteArmedCatId() === id) {
      this.confirmDeleteCategory(id);
      return;
    }
    this.editingCatId.set(null);
    this.deleteArmedCatId.set(id);
    if (this.deleteTimer) clearTimeout(this.deleteTimer);
    this.deleteTimer = setTimeout(() => this.deleteArmedCatId.set(null), 4000);
  }

  private confirmDeleteCategory(id: string) {
    this.deleteArmedCatId.set(null);
    this.productsService.deleteCategory(id).subscribe({
      error: () => this.saveError.set(this.t().CAT_SAVE_ERROR),
    });
  }

  /** Back with unsaved changes: arm inline confirm first, never window.confirm. */
  back() {
    if (this.dirty() && !this.exitArmed()) {
      this.exitArmed.set(true);
      return;
    }
    this.router.navigateByUrl(this.returnTo());
  }

  keepEditing() {
    this.exitArmed.set(false);
  }

  createAnother() {
    this.name.set('');
    this.description.set('');
    this.imageUrl.set('');
    this.submitted.set(false);
    this.saveError.set(null);
    this.uploadError.set(null);
    this.exitArmed.set(false);
    this.createdName.set(null);
    requestAnimationFrame(() => {
      document.getElementById('c-name')?.focus({ preventScroll: true });
    });
  }
}
