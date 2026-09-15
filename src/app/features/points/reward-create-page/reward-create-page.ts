import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { PointsService, Reward } from '../../../data/services/points';
import { ProductsService } from '../../../data/services/products';

/**
 * Iconos Material Round disponibles para recompensas, agrupados por familia.
 * Todos verificados contra la fuente (ligaduras); la grilla los previsualiza.
 */
export const REWARD_ICON_GROUPS: { label: string; icons: { name: string; hint: string }[] }[] = [
  {
    label: 'Café y bebidas',
    icons: [
      { name: 'local_cafe', hint: 'Taza' },
      { name: 'free_breakfast', hint: 'Para llevar' },
      { name: 'local_drink', hint: 'Vaso' },
      { name: 'emoji_food_beverage', hint: 'Bebida' },
    ],
  },
  {
    label: 'Dulces y comida',
    icons: [
      { name: 'bakery_dining', hint: 'Panadería' },
      { name: 'cake', hint: 'Pastel' },
      { name: 'cookie', hint: 'Galleta' },
      { name: 'icecream', hint: 'Helado' },
      { name: 'lunch_dining', hint: 'Sándwich' },
      { name: 'breakfast_dining', hint: 'Desayuno' },
      { name: 'egg', hint: 'Huevo' },
    ],
  },
  {
    label: 'Premios',
    icons: [
      { name: 'stars', hint: 'Estrellas' },
      { name: 'star', hint: 'Estrella' },
      { name: 'card_giftcard', hint: 'Regalo' },
      { name: 'redeem', hint: 'Canje' },
      { name: 'celebration', hint: 'Fiesta' },
      { name: 'emoji_events', hint: 'Trofeo' },
      { name: 'workspace_premium', hint: 'Premium' },
      { name: 'military_tech', hint: 'Medalla' },
      { name: 'diamond', hint: 'Diamante' },
      { name: 'loyalty', hint: 'Lealtad' },
      { name: 'favorite', hint: 'Corazón' },
      { name: 'auto_awesome', hint: 'Destello' },
      { name: 'whatshot', hint: 'Popular' },
    ],
  },
];

@Component({
  selector: 'app-reward-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reward-create-page.html',
  styleUrl: './reward-create-page.css',
})
export class RewardCreatePageComponent implements OnInit {
  private pointsService = inject(PointsService);
  private productsService = inject(ProductsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  products = this.productsService.products;

  iconGroups = REWARD_ICON_GROUPS;

  /** Non-null when editing: /points/rewards/:id/edit. Null when creating. */
  rewardId = signal<string | null>(null);
  isEditMode = computed(() => this.rewardId() !== null);
  loadingReward = signal(false);
  rewardNotFound = signal(false);

  title = signal('');
  description = signal('');
  starsRequired = signal(50);
  imageUrl = signal('');
  icon = signal('stars');
  isActive = signal(true);
  productId = signal('');

  submitted = signal(false);
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  isUploading = signal(false);
  uploadError = signal<string | null>(null);
  exitArmed = signal(false);
  createdName = signal<string | null>(null);

  /** Snapshot of the pristine form to detect real unsaved changes (also in edit mode). */
  private pristine = {
    title: '',
    description: '',
    starsRequired: 50,
    imageUrl: '',
    icon: 'stars',
    isActive: true,
    productId: '',
  };

  dirty = computed(() => {
    const p = this.pristine;
    return (
      this.title() !== p.title ||
      this.description() !== p.description ||
      this.starsRequired() !== p.starsRequired ||
      this.imageUrl() !== p.imageUrl ||
      this.icon() !== p.icon ||
      this.isActive() !== p.isActive ||
      this.productId() !== p.productId
    );
  });

  titleError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.title().trim()) return 'Ponle un título a la recompensa.';
    return '';
  });

  descriptionError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.description().trim()) return 'La descripción es requerida.';
    return '';
  });

  starsError = computed(() => {
    if (!this.submitted()) return '';
    if (!Number.isFinite(this.starsRequired()) || this.starsRequired() <= 0) {
      return 'Los puntos requeridos deben ser mayor a 0.';
    }
    return '';
  });

  productError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.productId()) return 'Debe seleccionar un producto asignado.';
    return '';
  });

  valid = computed(
    () => !this.titleError() && !this.descriptionError() && !this.starsError() && !this.productError()
  );

  previewTitle = computed(() => this.title().trim() || 'Título de la recompensa');
  previewDescription = computed(() => this.description().trim() || 'La descripción aparecerá aquí…');

  ngOnInit() {
    if (!this.products().length) {
      this.productsService.getProducts().subscribe({ error: () => undefined });
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.rewardId.set(id);
      const cached = this.pointsService.rewards().find(r => r.id === id);
      if (cached) {
        this.fillForm(cached);
      } else {
        this.loadingReward.set(true);
        this.pointsService
          .getRewards()
          .pipe(finalize(() => this.loadingReward.set(false)))
          .subscribe({
            next: (rewards) => {
              const found = rewards.find(r => r.id === id);
              if (found) this.fillForm(found);
              else this.rewardNotFound.set(true);
            },
            error: () => this.rewardNotFound.set(true),
          });
      }
    }
  }

  private fillForm(reward: Reward) {
    this.title.set(reward.title);
    this.description.set(reward.description);
    this.starsRequired.set(reward.starsRequired);
    this.imageUrl.set(reward.imageUrl || '');
    this.icon.set(reward.icon || 'stars');
    this.isActive.set(reward.isActive);
    this.productId.set(reward.productId || '');
    this.submitted.set(false);
    this.pristine = {
      title: reward.title,
      description: reward.description,
      starsRequired: reward.starsRequired,
      imageUrl: reward.imageUrl || '',
      icon: reward.icon || 'stars',
      isActive: reward.isActive,
      productId: reward.productId || '',
    };
  }

  onProductChange(productId: string) {    this.productId.set(productId);
    if (productId) {
      const prod = this.products().find(p => p.id === productId);
      if (prod) {
        this.title.set(prod.name);
        this.description.set(prod.description || '');
        this.imageUrl.set(prod.imageUrl || '');
      }
    }
  }

  save() {
    this.submitted.set(true);
    this.saveError.set(null);
    if (!this.valid() || this.isSaving()) return;

    const payload = {
      title: this.title().trim(),
      description: this.description().trim(),
      starsRequired: Number(this.starsRequired()),
      imageUrl: this.imageUrl().trim() || undefined,
      icon: this.icon().trim() || 'stars',
      isActive: this.isActive(),
      productId: this.productId() || undefined,
    };

    this.isSaving.set(true);
    const id = this.rewardId();
    const request = id
      ? this.pointsService.updateReward(id, payload)
      : this.pointsService.createReward(payload);

    request.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => this.createdName.set(this.title().trim()),
      error: (err) =>
        this.saveError.set(
          err?.error?.message ||
            (id ? 'No se pudo actualizar la recompensa. Inténtalo de nuevo.' : 'No se pudo crear la recompensa. Inténtalo de nuevo.')
        ),
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
        error: () => this.uploadError.set('No se pudo subir la imagen. Inténtalo de nuevo.'),
      });
  }

  hideImg(event: Event) {
    const img = event.target as HTMLImageElement | null;
    if (img) img.style.display = 'none';
  }

  /** Volver con cambios sin guardar: confirma primero, nunca window.confirm. */
  back() {
    if (this.dirty() && !this.exitArmed()) {
      this.exitArmed.set(true);
      return;
    }
    this.router.navigate(['/points']);
  }

  keepEditing() {
    this.exitArmed.set(false);
  }

  createAnother() {
    this.title.set('');
    this.description.set('');
    this.starsRequired.set(50);
    this.imageUrl.set('');
    this.icon.set('stars');
    this.isActive.set(true);
    this.productId.set('');
    this.submitted.set(false);
    this.saveError.set(null);
    this.uploadError.set(null);
    this.exitArmed.set(false);
    this.createdName.set(null);
    requestAnimationFrame(() => {
      document.getElementById('r-title')?.focus({ preventScroll: true });
    });
  }
}
