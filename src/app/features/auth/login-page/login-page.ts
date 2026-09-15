import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../data/services/auth';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css'
})
export class LoginPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    remember: [true]
  });

  isLoading = false;
  errorMessage = '';
  infoMessage = '';
  showPassword = false;
  capsLockOn = false;

  get emailCtrl() {
    return this.loginForm.get('email')!;
  }

  get passwordCtrl() {
    return this.loginForm.get('password')!;
  }

  get emailError(): string {
    const c = this.emailCtrl;
    if (!c.touched && !c.dirty) return '';
    if (c.hasError('required')) return 'Escribe tu correo electrónico.';
    if (c.hasError('email')) return 'Ese correo no parece válido. ¿Le falta el @?';
    return '';
  }

  get passwordError(): string {
    const c = this.passwordCtrl;
    if (!c.touched && !c.dirty) return '';
    if (c.hasError('required')) return 'Escribe tu contraseña.';
    if (c.hasError('minlength')) return 'La contraseña necesita al menos 4 caracteres.';
    return '';
  }

  get passwordHintIds(): string | null {
    const ids: string[] = [];
    if (this.passwordError) ids.push('password-err');
    if (this.capsLockOn && !this.passwordError) ids.push('caps-hint');
    return ids.length ? ids.join(' ') : null;
  }

  /** Toggle password visibility */
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  /** Detect Caps Lock to warn before a failed attempt */
  onPasswordKey(event: KeyboardEvent) {
    if (typeof event.getModifierState === 'function') {
      this.capsLockOn = event.getModifierState('CapsLock');
    }
  }

  /** Dead-end recovery: there is no reset route yet, so say what to do. */
  onForgotPassword() {
    this.errorMessage = '';
    this.infoMessage =
      'Para restablecer tu contraseña, contacta a Soporte Técnico con tu correo de acceso.';
  }

  /** Submit login form — never disabled as a validation gate, only while sending. */
  onSubmit() {
    this.infoMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Revisa los campos marcados antes de continuar.';
      this.focusFirstInvalid();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    this.authService.login(email!, password!)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          // Never clear typed input on error — the user fixes, not retypes.
          this.errorMessage =
            err?.error?.message ||
            err?.message ||
            'No pudimos iniciar sesión. Revisa tus credenciales y vuelve a intentarlo.';
          console.error('Error de inicio de sesión:', err);
        }
      });
  }

  private focusFirstInvalid() {
    const target =
      document.querySelector('#email[aria-invalid="true"]') ??
      document.querySelector('#password[aria-invalid="true"]');
    (target as HTMLElement | null)?.focus();
  }
}
