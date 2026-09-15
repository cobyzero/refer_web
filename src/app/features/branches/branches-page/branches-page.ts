import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { Branch, BranchesService } from '../../../data/services/branches';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-branches-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.css',
})
export class BranchesPageComponent implements OnInit, OnDestroy {
  private branchesService = inject(BranchesService);
  private langService = inject(LanguageService);

  t = this.langService.t;
  branches = this.branchesService.branches;
  isLoading = this.branchesService.isLoading;
  listError = this.branchesService.error;

  // Create form
  showCreate = signal(false);
  createName = signal('');
  createAddress = signal('');
  createCity = signal('');
  createState = signal('');
  createZip = signal('');
  createSubmitted = signal(false);
  isCreating = signal(false);
  createError = signal<string | null>(null);

  // Inline edit
  editingId = signal<string | null>(null);
  editName = signal('');
  editAddress = signal('');
  editCity = signal('');
  editState = signal('');
  editZip = signal('');
  editSubmitted = signal(false);
  isSavingEdit = signal(false);
  editError = signal<string | null>(null);

  // Two-tap delete
  deleteArmedId = signal<string | null>(null);
  private deleteTimer: ReturnType<typeof setTimeout> | null = null;

  actionError = signal<string | null>(null);

  createNameError = computed(() => {
    if (!this.createSubmitted()) return '';
    if (this.createName().trim().length < 2) return this.t().SEDES_ERR_NAME;
    if (this.isDuplicateName(this.createName())) return this.t().SEDES_ERR_DUP;
    return '';
  });

  createAddressError = computed(() => {
    if (!this.createSubmitted()) return '';
    return this.createAddress().trim().length < 2 ? this.t().SEDES_ERR_ADDRESS : '';
  });

  ngOnInit() {
    this.branchesService.load().subscribe({ error: () => undefined });
  }

  ngOnDestroy() {
    if (this.deleteTimer) clearTimeout(this.deleteTimer);
  }

  retry() {
    this.branchesService.retry();
  }

  toggleCreate() {
    this.showCreate.update(v => !v);
    this.createSubmitted.set(false);
    this.createError.set(null);
  }

  save() {
    this.createSubmitted.set(true);
    this.createError.set(null);
    if (this.createNameError() || this.createAddressError() || this.isCreating()) {
      document.getElementById('branch-name')?.focus();
      return;
    }
    this.isCreating.set(true);
    this.branchesService
      .create({
        name: this.createName().trim(),
        address: this.createAddress().trim(),
        city: this.createCity().trim(),
        state: this.createState().trim(),
        zipCode: this.createZip().trim(),
      })
      .subscribe({
        next: () => {
          this.isCreating.set(false);
          this.createName.set('');
          this.createAddress.set('');
          this.createCity.set('');
          this.createState.set('');
          this.createZip.set('');
          this.createSubmitted.set(false);
          this.showCreate.set(false);
        },
        error: (err) => {
          this.isCreating.set(false);
          this.createError.set(err?.error?.message || this.t().SEDES_SAVE_ERROR);
        },
      });
  }

  // ── Inline edit ──
  startEdit(branch: Branch) {
    this.deleteArmedId.set(null);
    this.editName.set(branch.name);
    this.editAddress.set(branch.address);
    this.editCity.set(branch.city ?? '');
    this.editState.set(branch.state ?? '');
    this.editZip.set(branch.zipCode ?? '');
    this.editSubmitted.set(false);
    this.editError.set(null);
    this.editingId.set(branch.id);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editError.set(null);
  }

  editNameError = computed(() => {
    if (!this.editSubmitted()) return '';
    if (this.editName().trim().length < 2) return this.t().SEDES_ERR_NAME;
    const value = this.editName().trim().toLowerCase();
    if (this.branches().some(b => b.id !== this.editingId() && b.name.trim().toLowerCase() === value)) {
      return this.t().SEDES_ERR_DUP;
    }
    return '';
  });

  editAddressError = computed(() => {
    if (!this.editSubmitted()) return '';
    return this.editAddress().trim().length < 2 ? this.t().SEDES_ERR_ADDRESS : '';
  });

  saveEdit() {
    const id = this.editingId();
    this.editSubmitted.set(true);
    this.editError.set(null);
    if (!id || this.editNameError() || this.editAddressError() || this.isSavingEdit()) return;
    this.isSavingEdit.set(true);
    this.branchesService
      .update(id, {
        name: this.editName().trim(),
        address: this.editAddress().trim(),
        city: this.editCity().trim(),
        state: this.editState().trim(),
        zipCode: this.editZip().trim(),
      })
      .pipe(finalize(() => this.isSavingEdit.set(false)))
      .subscribe({
        next: () => this.editingId.set(null),
        error: (err) => this.editError.set(err?.error?.message || this.t().SEDES_SAVE_ERROR),
      });
  }

  toggleActive(branch: Branch) {
    this.actionError.set(null);
    this.branchesService.setActive(branch.id, !branch.isActive).subscribe({
      error: () => this.actionError.set(this.t().SEDES_SAVE_ERROR),
    });
  }

  askDelete(id: string) {
    if (this.deleteArmedId() === id) {
      this.confirmDelete(id);
      return;
    }
    this.editingId.set(null);
    this.deleteArmedId.set(id);
    if (this.deleteTimer) clearTimeout(this.deleteTimer);
    this.deleteTimer = setTimeout(() => this.deleteArmedId.set(null), 4000);
  }

  private confirmDelete(id: string) {
    this.deleteArmedId.set(null);
    this.actionError.set(null);
    this.branchesService.remove(id).subscribe({
      error: (err) => {
        this.actionError.set(
          err?.status === 409 ? this.t().SEDES_DELETE_IN_USE : this.t().SEDES_SAVE_ERROR
        );
      },
    });
  }

  addressLine(branch: Branch): string {
    return [branch.address, branch.city, branch.state].filter(Boolean).join(' · ');
  }

  private isDuplicateName(name: string): boolean {
    const value = name.trim().toLowerCase();
    return !!value && this.branches().some(b => b.name.trim().toLowerCase() === value);
  }
}
